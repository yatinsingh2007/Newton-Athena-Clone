# Athena Exam App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Electron desktop clone of Newton Athena: login → camera/mic check → 10-minute, 10-question MCQ test (resumable) → score, backed by an Express server storing everything in JSON files.

**Architecture:** `server/` is an Express 5 app built by `createApp({ dataDir, now })` so tests run it against a temp copy of the JSON data with an injectable clock. `athena/` is a Vite + React 19 renderer loaded by an Electron main process (`athena/app/main.js`); the renderer is a small screen state machine in `App.jsx`, with all non-UI logic in pure modules under `src/lib/` that are unit-tested with `node --test`.

**Tech Stack:** Node 22, Express 5, nodemon, `node:test` + global `fetch` (no new test deps); React 19, Vite 8, Electron 45, plain CSS with custom properties.

**Spec:** `docs/superpowers/specs/2026-10-23-athena-exam-app-design.md`

## Global Constraints

- No database: all persistent data is JSON under `server/data/` (`users.json`, `questions.json`, `attempts.json`, `sessions.json`).
- Correct answers (`answerIndex`) never leave the server before or after submit.
- Test is 10 questions, 4 options each, `durationMinutes: 10`; auto-submit at 0:00; server accepts up to `GRACE_MS = 10_000` past the deadline.
- One attempt per student. `startedAt` is set on the first `GET /api/test` and never reset.
- The camera is shown only on the System Check screen; the stream is stopped before the test starts.
- Server port 4000; Vite dev port 5173 (`strictPort`); CORS allows all origins.
- Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; grant `media` permission in the session handler.
- Native abilities go through IPC: the renderer never touches Node/Electron APIs directly. It calls `window.athena.*`, exposed by `app/preload.cjs` via `contextBridge`, which `ipcRenderer.invoke`s channels handled in main with `ipcMain.handle`. Channel names: `media:status`, `media:request`, `media:open-settings`.
- Light + dark theme via CSS custom properties; default follows `prefers-color-scheme`; toggle override stored in `localStorage` key `athena-theme`.
- The plan is exactly 20 commits (Tasks 1–20), one per task, on `main`. Each commit leaves the app runnable. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Visual reference: `~/Desktop/Screenshot 2026-10-23 at 1.38.27 AM.png`. The bug icon is omitted.

## Review Focus

1. **Client/server clock skew** — the timer must count from the server's `startedAt` using the server's `now` as an offset, not the client clock alone. Test: `timer.test.js › remainingMs corrects for clock skew` (Task 18).
2. **Double submit** (auto-submit fires while the confirm dialog is open, or Submit clicked twice) — the second submit gets 409 and the client shows the saved result instead of an error. Tests: `submit.test.js › second submit is 409` (Task 7), `api.test.js › 409 on submit resolves to saved result` (Task 11).
3. **Server unreachable** at login or while saving — show a readable error and keep local answers; the final submit sends the full answers so nothing is lost. Test: `api.test.js › network failure throws ApiError with status 0` (Task 11).
4. **Camera busy or missing** (`NotReadableError`, `NotFoundError`, `NotAllowedError`) — a specific message per cause, plus Try again. Test: `mediaErrors.test.js` (Task 13).
5. **Malformed progress payloads** (unknown question id, option index 4 or -1, non-array `marked`) — 400, and the attempt stays unchanged. Test: `attempt.test.js › rejects invalid answers` (Task 6).

---

## File Structure

```
server/
  package.json            type: module; scripts dev/start/test/reset; nodemonConfig ignores data/
  index.js                listens on PORT||4000 with dataDir=server/data
  app.js                  createApp({ dataDir, now }) — middleware + route mounting
  lib/store.js            readJson / writeJson (atomic)
  lib/auth.js             requireAuth middleware (sessions.json lookup)
  lib/attempts.js         attempt lookup/save, deadline, finalize
  lib/grade.js            gradeAnswers
  routes/auth.js          POST /api/login
  routes/test.js          GET /api/test, PUT /api/attempt, POST /api/submit, GET /api/result
  scripts/reset.js        clears attempts.json and sessions.json
  data/{users,questions,attempts,sessions}.json
  test/helpers.js         makeDataDir(), startApp()
  test/*.test.js
athena/
  package.json            main: app/main.js; scripts dev/build/start/test
  vite.config.js          base './', server.port 5173 strictPort
  eslint.config.js        node globals for app/** and **/*.test.js
  app/main.js             Electron main process (window, permissions, IPC registration)
  app/preload.cjs         contextBridge → window.athena (CommonJS: sandboxed preloads can't be ESM)
  app/media.js            OS camera/mic access logic, injectable for tests (+ media.test.js)
  src/main.jsx, src/App.jsx, src/index.css
  src/lib/{api,theme,inlineCode,questionStatus,timer,mediaErrors}.js (+ .test.js)
  src/hooks/useTheme.js
  src/components/{ThemeToggle,QuestionText,QuestionPalette,ConfirmDialog,MicMeter,Timer}.jsx
  src/screens/{Login,SystemCheck,Test,Result}.jsx (+ co-located .css)
```

Delete: `server/questions.json` (moved to `server/data/`), `athena/src/App.css`, `athena/src/assets/{hero.png,react.svg,vite.svg}`, `athena/public/icons.svg`.

---

## Server

### Task 1: Server scaffold with health check and CORS

**Files:**
- Modify: `server/package.json`, `server/app.js`
- Create: `server/index.js`, `server/test/helpers.js`, `server/test/health.test.js`

**Interfaces:**
- Produces: `createApp({ dataDir: string, now?: () => number }) => express.Application` (default export not used; named export). `test/helpers.js` exports `makeDataDir(): Promise<string>` (mkdtemp + copy of `server/data/` if it exists, else empty dir) and `startApp(app): Promise<{ url: string, close(): Promise<void> }>` (listens on port 0).

- [ ] **Step 1:** Write `health.test.js › GET /api/health returns ok`: expects status 200, body `{ ok: true }`, and header `access-control-allow-origin: *`. Add `OPTIONS /api/login returns 204` with `access-control-allow-headers` containing `Authorization` and `Content-Type`.
- [ ] **Step 2:** Set `"type": "module"`, `"main": "index.js"`, scripts `"start": "node index.js"`, `"dev": "nodemon index.js"`, `"test": "node --test"`, and `"nodemonConfig": { "ignore": ["data/*", "test/*"] }`. Run `npm test` in `server/` → FAIL.
- [ ] **Step 3:** Implement `createApp` in `app.js` with `express.json()`, a hand-written CORS middleware (no new dependency; answers preflight with 204; allowed methods `GET,POST,PUT,OPTIONS`), and `GET /api/health`. `index.js` calls `createApp({ dataDir: <dir of index.js>/data })` and listens on `process.env.PORT || 4000`, logging the URL.
- [ ] **Step 4:** `npm test` → PASS. `npm start` then `curl localhost:4000/api/health` → `{"ok":true}`.
- [ ] **Step 5:** Commit `feat(server): scaffold express app with health check and cors`.

### Task 2: JSON file store

**Files:** Create `server/lib/store.js`, `server/test/store.test.js`

**Interfaces:**
- Produces: `readJson(dataDir, fileName, fallback) => Promise<any>` (returns `fallback` if the file is missing or empty); `writeJson(dataDir, fileName, value) => Promise<void>` (writes `<file>.tmp` with 2-space JSON, then `rename`).

- [ ] **Step 1:** Tests: `readJson returns fallback for missing file`, `readJson returns fallback for empty file`, `writeJson then readJson round-trips`, `writeJson leaves no .tmp file behind`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** Implement. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(server): add atomic json file store`.

### Task 3: Seed data

**Files:** Create `server/data/users.json`, `server/data/questions.json`, `server/data/attempts.json` (`[]`), `server/data/sessions.json` (`{}`), `server/test/data.test.js`. Delete `server/questions.json`.

**Interfaces:**
- Produces: `users.json` is `[{ id, name, email, password }]` with exactly these logins (used by later tests and the README): `u1 / Aarav Sharma / aarav@student.com / pass123`, `u2 / Diya Patel / diya@student.com / pass123`, `u3 / Kabir Singh / kabir@student.com / pass123`. `questions.json` is `{ title, durationMinutes: 10, questions: [{ id: "q1".."q10", text, options: [4 strings], answerIndex: 0-3 }] }`. Title: `"React Fundamentals, Hooks, State Management & JavaScript Basics - Revision"`. Question text may use backticks for inline code (e.g. "What does `useEffect` with an empty dependency array do?"). Write 10 real React/JS MCQs and spread the correct answers across A–D.

- [ ] **Step 1:** `data.test.js` asserts: 10 questions, ids `q1`…`q10` unique, each has 4 non-empty options, `answerIndex` is an integer 0–3, `durationMinutes === 10`, ≥3 users with unique emails.
- [ ] **Step 2:** FAIL → write the files → `npm test` PASS.
- [ ] **Step 3:** Commit `feat(server): seed users and questions json`.

### Task 4: Login and sessions

**Files:** Create `server/routes/auth.js`, `server/lib/auth.js`, `server/test/login.test.js`. Modify `server/app.js`.

**Interfaces:**
- Produces: `POST /api/login { email, password }` → 200 `{ token, user: { id, name, email } }` (token from `crypto.randomUUID()`, stored in `sessions.json` as `{ [token]: userId }`); 400 `{ error: "Email and password are required" }`; 401 `{ error: "Invalid email or password" }`. Email match is case-insensitive and trimmed. `requireAuth(dataDir)` middleware: reads `Authorization: Bearer <token>`, sets `req.user` (without password) or responds 401 `{ error: "Not logged in" }`.

- [ ] **Step 1:** Tests: `valid login returns token and user without password`, `email is case-insensitive`, `wrong password is 401`, `missing fields is 400`, `token is persisted in sessions.json` (read the temp dataDir).
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit `feat(server): add login endpoint with json sessions`.

### Task 5: Start/fetch the test

**Files:** Create `server/lib/attempts.js`, `server/routes/test.js`, `server/test/test-route.test.js`. Modify `server/app.js`.

**Interfaces:**
- Produces in `lib/attempts.js`: `GRACE_MS = 10_000`; `findAttempt(dataDir, userId) => Promise<Attempt|undefined>`; `saveAttempt(dataDir, attempt) => Promise<void>` (upsert by `userId`); `deadlineOf(attempt, durationMinutes) => number` (`startedAt + durationMinutes*60_000`). `Attempt = { userId, startedAt: number(ms), answers: { [qid]: number }, marked: string[], submittedAt: number|null, score: number|null, total: number|null }`.
- `GET /api/test` (auth) → creates the attempt with `startedAt = now()` only if none exists; returns 200 `{ status: "in_progress", title, durationMinutes, startedAt, now, answers, marked, questions: [{ id, text, options }] }`.

- [ ] **Step 1:** Tests: `401 without token`, `questions never include answerIndex` (check every question object's keys), `first call sets startedAt to now()` (inject `now`), `second call keeps the original startedAt` (advance the fake clock), `returns saved answers and marked`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit `feat(server): add test endpoint that starts an attempt`.

### Task 6: Save progress

**Files:** Modify `server/routes/test.js`. Create `server/test/attempt.test.js`.

**Interfaces:**
- `PUT /api/attempt { answers, marked }` (auth) → 200 `{ ok: true }` and replaces `answers`/`marked` on the attempt. 400 `{ error: "Invalid answers" }` if `answers` is not an object, has an unknown question id, or a value that isn't an integer 0–3; 400 `{ error: "Invalid marked list" }` if `marked` isn't an array of known ids. 404 if there's no attempt; 409 `{ error: "Already submitted" }` if submitted; 410 `{ error: "Time is up" }` if `now() > deadline + GRACE_MS`.

- [ ] **Step 1:** Tests: `saves answers and marked`, `rejects invalid answers` (cases: `{ q99: 0 }`, `{ q1: 4 }`, `{ q1: -1 }`, `{ q1: "a" }`, `marked: "q1"`, each 400 and the stored attempt unchanged), `404 before test started`, `410 after deadline plus grace`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit `feat(server): save in-progress answers and review marks`.

### Task 7: Grading, submit, result, and expiry auto-submit

**Files:** Create `server/lib/grade.js`, `server/test/grade.test.js`, `server/test/submit.test.js`. Modify `server/lib/attempts.js`, `server/routes/test.js`.

**Interfaces:**
- `gradeAnswers(questions, answers) => { score, total }` (`total = questions.length`; unanswered counts as wrong).
- `finalizeAttempt(attempt, questions, now) => Attempt` (sets `submittedAt`, `score`, `total`).
- `POST /api/submit { answers? }` (auth) → 200 `{ score, total, submittedAt }`. Within the deadline + grace, body `answers` (validated like Task 6) replace the saved ones before grading; past that, the body is ignored and the saved answers are graded. 404 if no attempt; 409 `{ error: "Already submitted" }` if already submitted.
- `GET /api/result` (auth) → 200 `{ score, total, submittedAt }` or 404 `{ error: "No result" }`.
- `GET /api/test` when submitted → 200 `{ status: "submitted", result: { score, total, submittedAt } }`; when unsubmitted and `now() > deadline + GRACE_MS` → finalize with saved answers, then the same submitted response.

- [ ] **Step 1:** `grade.test.js`: all correct = 10/10, none answered = 0/10, mixed = expected count.
- [ ] **Step 2:** `submit.test.js`: `submit grades body answers`, `submit within grace is accepted`, `submit after grace grades saved answers only`, `second submit is 409`, `result is 404 before submit and 200 after`, `GET /api/test after expiry auto-submits saved answers`, `submit response has no answerIndex`.
- [ ] **Step 3:** FAIL → implement → PASS.
- [ ] **Step 4:** Commit `feat(server): grade submissions and auto-submit expired attempts`.

### Task 8: Reset script

**Files:** Create `server/scripts/reset.js`. Modify `server/package.json` (`"reset": "node scripts/reset.js"`).

- [ ] **Step 1:** `reset.js` writes `[]` to `data/attempts.json` and `{}` to `data/sessions.json` using `writeJson`, then prints `Reset attempts and sessions.`
- [ ] **Step 2:** Verify: log in and start a test via curl, run `npm run reset`, and check that both files are back to empty.
- [ ] **Step 3:** Commit `chore(server): add reset script for attempts and sessions`.

---

## Desktop app

### Task 9: Electron shell and dev workflow

**Files:** Modify `athena/package.json`, `athena/vite.config.js`, `athena/eslint.config.js`, `athena/index.html` (title `Athena`), `athena/src/App.jsx` (placeholder `<h1>Athena</h1>` plus `window.athena?.platform`), `athena/src/index.css` (strip the starter styles to a minimal reset). Create content in `athena/app/main.js` and create `athena/app/preload.cjs`. Delete starter assets (see File Structure).

**Interfaces:**
- `package.json`: `"main": "app/main.js"`; scripts `"dev": "concurrently -k -n vite,electron \"vite\" \"wait-on tcp:5173 && cross-env VITE_DEV_SERVER_URL=http://localhost:5173 electron .\""`, `"build": "vite build"`, `"start": "electron ."`, `"test": "node --test src/lib app"`.
- `main.js` (ESM): a 1280×800 window with `minWidth 900`, `minHeight 650` and `autoHideMenuBar`. It loads `process.env.VITE_DEV_SERVER_URL` if set, else `dist/index.html` (path resolved from `import.meta.dirname`). The handler is `session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(permission === 'media'))`, plus `setPermissionCheckHandler` returning true for `media`. Quit when all windows close, except on macOS. `webPreferences.preload` points at `app/preload.cjs`.
- `preload.cjs`: `contextBridge.exposeInMainWorld('athena', { platform: process.platform })`. Task 13 adds the media methods.
- `vite.config.js`: add `base: './'`, `server: { port: 5173, strictPort: true }`.
- `eslint.config.js`: a block for `app/**/*.js` and `**/*.test.js` with `globals.node`.

- [ ] **Step 1:** `npm run dev` in `athena/` → an Electron window opens showing "Athena" and the platform string (which proves the preload bridge works), with hot reload.
- [ ] **Step 2:** `npm run build && npm start` → the same page loads from `dist/` with no blank screen or console 404s.
- [ ] **Step 3:** `npm run lint` → clean.
- [ ] **Step 4:** Commit `feat(app): wire electron shell to vite dev server`.

### Task 10: Theme tokens and light/dark toggle

**Files:** Create `src/lib/theme.js`, `src/lib/theme.test.js`, `src/hooks/useTheme.js`, `src/components/ThemeToggle.jsx`. Modify `src/index.css`, `src/App.jsx`.

**Interfaces:**
- `THEME_KEY = 'athena-theme'`; `resolveTheme(stored: string|null, prefersDark: boolean) => 'light'|'dark'` (`stored` wins only if it's `'light'` or `'dark'`).
- `useTheme() => { theme, toggle }`: sets `document.documentElement.dataset.theme`, persists the choice on toggle (wrap `localStorage` in try/catch), and follows OS changes while there's no stored choice.
- `<ThemeToggle />`: an icon button (sun/moon inline SVG) with `aria-label="Switch to dark mode"` or `"Switch to light mode"`.
- CSS tokens on `:root[data-theme=light]` / `[data-theme=dark]`: `--bg, --surface, --text, --text-muted, --border, --accent (#5b3fd6-ish purple), --accent-soft, --success (#3a9a62-ish green), --primary (near-black; near-white in dark), --primary-text, --danger, --code (pink, #d63384-ish), --radius: 8px`, plus the font stack `Inter, system-ui, sans-serif` and `ui-monospace` for code.

- [ ] **Step 1:** `theme.test.js`: stored `'dark'` + prefersDark false → `'dark'`; null + true → `'dark'`; `'garbage'` + false → `'light'`.
- [ ] **Step 2:** `npm test` FAIL → implement → PASS. Check in the app that toggling flips the colors and survives a reload.
- [ ] **Step 3:** Commit `feat(app): add light and dark theme with toggle`.

### Task 11: API client and screen state machine

**Files:** Create `src/lib/api.js`, `src/lib/api.test.js`. Modify `src/App.jsx`.

**Interfaces:**
- `API_URL = 'http://localhost:4000'`; `class ApiError extends Error { status }`; `createApi(baseUrl = API_URL, fetchImpl = fetch)` returns `{ login(email, password), getTest(token), saveAttempt(token, { answers, marked }), submit(token, answers), getResult(token) }`. Non-2xx responses throw `ApiError(body.error ?? 'Request failed', status)`. A network failure throws `ApiError('Cannot reach the exam server. Is it running?', 0)`. `submit` turns a 409 into `getResult(token)`, so a double submit resolves to the saved result.
- `App.jsx` state: `screen: 'login'|'check'|'test'|'result'`, `session: { token, user } | null`, `result: { score, total, submittedAt } | null`. Handlers: `onLoggedIn(session, result)` (go to `'result'` if a result exists, else `'check'`), `onReady()` → `'test'`, `onSubmitted(result)` → `'result'`, `onLogout()` → clears everything → `'login'`. Screens are placeholders until their own tasks.

- [ ] **Step 1:** `api.test.js` with a fake `fetchImpl`: `login sends JSON body and returns data`, `adds bearer token`, `non-2xx throws ApiError with server message`, `network failure throws ApiError with status 0`, `409 on submit resolves to saved result`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit `feat(app): add api client and screen flow`.

### Task 12: Login screen

**Files:** Create `src/screens/Login.jsx`, `src/screens/Login.css`. Modify `src/App.jsx`.

**Interfaces:** `<Login api onLoggedIn />`. On submit: `api.login`, then `api.getResult` (a 404 means no result yet), then `onLoggedIn({ token, user }, result|null)`.

- [ ] **Step 1:** Build a centered card with the app name "Athena", a subtitle, labelled Email/Password inputs, a full-width black primary "Log in" button (disabled and showing "Logging in…" while pending), an inline error from `ApiError.message`, and the theme toggle in the corner. The style matches the screenshot: thin borders, 8px radius.
- [ ] **Step 2:** Verify with the server running: a wrong password shows "Invalid email or password"; with the server stopped, it shows the "Cannot reach…" message; `aarav@student.com / pass123` moves on to the check placeholder.
- [ ] **Step 3:** Commit `feat(app): add login screen`.

### Task 13: System check — camera preview

**Files:** Create `src/screens/SystemCheck.jsx`, `src/screens/SystemCheck.css`, `src/lib/mediaErrors.js`, `src/lib/mediaErrors.test.js`, `app/media.js`, `app/media.test.js`. Modify `src/App.jsx`, `app/main.js`, `app/preload.cjs`.

**Interfaces:**
- `mediaErrorMessage(errorName: string) => string`: `NotAllowedError` → "Camera and microphone access was blocked. Allow access and try again."; `NotFoundError` → "No camera or microphone was found."; `NotReadableError` → "Your camera or microphone is being used by another app."; anything else → "Could not start camera and microphone."
- `app/media.js` (main process, `systemPreferences` and `shell` injected so it's testable):
  - `getMediaStatus({ platform, systemPreferences }) => Promise<{ camera, microphone }>`. Each value is `'granted'|'denied'|'restricted'|'not-determined'|'unknown'`. On `darwin` and `win32` it uses `systemPreferences.getMediaAccessStatus('camera'|'microphone')`; elsewhere it returns `'granted'` for both, since Linux has no OS-level gate.
  - `requestMediaAccess({ platform, systemPreferences }) => Promise<{ camera, microphone, granted: boolean }>`. On `darwin` it awaits `systemPreferences.askForMediaAccess('camera')`, then `('microphone')`, which shows the OS prompt only on first use. Elsewhere it returns the status. `granted` is true only if both are `'granted'`.
  - `registerMediaIpc({ ipcMain, systemPreferences, shell, platform })` handles `media:status`, `media:request`, and `media:open-settings`. On `darwin`, `media:open-settings` opens `x-apple.systempreferences:com.apple.preference.security?Privacy_Camera`; on `win32` it opens `ms-settings:privacy-webcam`.
- `preload.cjs` adds `media: { getStatus: () => ipcRenderer.invoke('media:status'), request: () => ipcRenderer.invoke('media:request'), openSettings: () => ipcRenderer.invoke('media:open-settings') }` to `window.athena`.
- `<SystemCheck user onReady />`: holds a `stream` state. On mount it calls `window.athena.media.getStatus()` to show the current state. The "Allow camera & microphone" button first calls `window.athena.media.request()` over IPC. If `granted` is false, it shows the `NotAllowedError` message with an "Open System Settings" button (which calls `media.openSettings()`) and "Try again". If granted, it calls `getUserMedia({ video: true, audio: true })` and attaches the stream to a mirrored `<video autoPlay muted playsInline>`. A status row shows Camera ✓ / Microphone ✓. Errors show the message and a "Try again" button. Stop all tracks on unmount.

- [ ] **Step 1:** `mediaErrors.test.js` covers the four cases. `app/media.test.js` uses a fake `systemPreferences` to cover: `linux status is granted for both`, `darwin request asks for camera then microphone`, `granted is false if microphone is denied`, `registerMediaIpc registers the three channels` (fake `ipcMain` records `handle` calls). FAIL → implement → PASS.
- [ ] **Step 2:** Build the screen: heading "System check", a "Hi {name}" line, a short explanation, a 16:9 preview box with a placeholder icon before access is granted. Verify in Electron that the face appears. Then deny access in macOS Settings: the error shows, and "Open System Settings" opens the Camera privacy pane.
- [ ] **Step 3:** Commit `feat(app): add system check with camera preview and media ipc`.

### Task 14: System check — mic level and start gating

**Files:** Create `src/components/MicMeter.jsx`. Modify `src/screens/SystemCheck.jsx`, `SystemCheck.css`.

**Interfaces:** `<MicMeter stream />`: Web Audio `AnalyserNode` on the stream's audio track, RMS level read via `requestAnimationFrame` and drawn as a horizontal bar (0–100%). It closes the `AudioContext` on unmount. "Start Test" (black primary) is enabled only when the stream has a live video **and** a live audio track. On click: stop all tracks, then `onReady()`.

- [ ] **Step 1:** Verify: speaking moves the bar, "Start Test" stays disabled until access is granted, and after Start the macOS camera indicator light turns off.
- [ ] **Step 2:** Commit `feat(app): add mic level meter and gate test start`.

### Task 15: Test screen — layout, question, options

**Files:** Create `src/screens/Test.jsx`, `src/screens/Test.css`, `src/components/QuestionText.jsx`, `src/lib/inlineCode.js`, `src/lib/inlineCode.test.js`. Modify `src/App.jsx`.

**Interfaces:**
- `splitInlineCode(text) => Array<{ type: 'text'|'code', value }>` (backtick pairs → code; an unmatched backtick stays as text).
- `<QuestionText text />` renders code segments as `<code className="inline-code">` (pink, monospace).
- `<Test api session onSubmitted />`: on mount it calls `api.getTest`; if `status === 'submitted'` it calls `onSubmitted(result)`. State: `test`, `index`, `answers`, `marked`, `visited: Set` (starts as {q1} ∪ answered ∪ marked ids). Layout follows the screenshot: a header with the title (2-line clamp), a right-hand slot for the timer and toggle, and a green "Submit Quiz" button (no-op for now). Below that, a body with `QUESTION {n}/10` (uppercase, letter-spaced, muted), the question text, and 4 option cards with a boxed letter A–D. Clicking an option sets `answers[qid]`. The selected card gets an accent border, a soft background and a filled letter box. Option cards are `<button>`s with `aria-pressed`.

- [ ] **Step 1:** `inlineCode.test.js`: plain text → one text segment; "What does \`useEffect\` do?" → text/code/text; an unmatched backtick stays as text.
- [ ] **Step 2:** FAIL → implement → PASS. Build the screen, then compare it side by side with the screenshot in both themes.
- [ ] **Step 3:** Commit `feat(app): add test screen with question and options`.

### Task 16: Navigation, clear, mark for review, autosave

**Files:** Modify `src/screens/Test.jsx`, `Test.css`.

**Interfaces:**
- The bottom bar has "‹ Previous" (ghost, disabled on Q1), a center grid button (wired in Task 17), and "Next ›" (black, disabled on Q10). Going to a question adds it to `visited`.
- The header buttons are "Mark for review" (outlined purple, toggles `marked`, filled when active) and "Clear Selection" (outlined grey, disabled when unanswered).
- Autosave: every change to `answers`/`marked` calls `api.saveAttempt(token, { answers, marked })`. If a save fails, keep local state and show a small muted "Not saved — will retry" note. The next change re-sends the full state.

- [ ] **Step 1:** Verify: answer Q1, mark Q2, quit the app with ⌘Q, relaunch and log in → System Check → Q1's answer and Q2's mark are still there.
- [ ] **Step 2:** Commit `feat(app): add navigation, review marks and autosave`.

### Task 17: Question palette

**Files:** Create `src/lib/questionStatus.js`, `src/lib/questionStatus.test.js`, `src/components/QuestionPalette.jsx`. Modify `src/screens/Test.jsx`, `Test.css`.

**Interfaces:**
- `questionStatus(qid, { answers, marked, visited }) => 'not-visited'|'not-answered'|'answered'|'marked'|'answered-marked'`.
- `summarize(questions, answers, marked) => { answered: number, marked: number, total: number }`.
- `<QuestionPalette questions current statusOf onJump onClose />`: a popover above the grid button with a 5×2 grid of numbered buttons colored by status (the current question gets an outline ring), plus a legend. It closes on Esc, an outside click, or a jump.

- [ ] **Step 1:** `questionStatus.test.js` covers all five statuses (answered + marked → `answered-marked`) and the `summarize` counts.
- [ ] **Step 2:** FAIL → implement → PASS. Verify that jumping works and the colors update live.
- [ ] **Step 3:** Commit `feat(app): add question palette with status colors`.

### Task 18: Countdown timer and auto-submit

**Files:** Create `src/lib/timer.js`, `src/lib/timer.test.js`, `src/components/Timer.jsx`. Modify `src/screens/Test.jsx`.

**Interfaces:**
- `remainingMs({ startedAt, durationMinutes, serverNow, clientNowAtFetch, clientNow }) => number`: `max(0, startedAt + durationMinutes*60_000 - (clientNow + (serverNow - clientNowAtFetch)))`.
- `formatClock(ms) => 'mm:ss'` (round seconds up, so 0:00 shows only at the end).
- `<Timer remaining />` shows a clock icon with `mm:ss`, turns `--danger` when under 60 000 ms, and sets `aria-live="polite"` only once per minute.
- `Test.jsx` ticks every 500 ms. When `remainingMs` hits 0, it calls `api.submit(token, answers)` exactly once (guarded by a ref), then `onSubmitted`.

- [ ] **Step 1:** `timer.test.js`: `full duration at start`, `remainingMs corrects for clock skew` (client 5 min behind → still 10:00 at start), `never negative`, `formatClock(600000) === '10:00'`, `formatClock(59001) === '01:00'`, `formatClock(0) === '00:00'`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Verify auto-submit quickly: temporarily set `durationMinutes` to 1 in `server/data/questions.json`, run `npm run reset`, take the test, and watch it auto-submit at 0:00. Restore it to 10.
- [ ] **Step 4:** Commit `feat(app): add countdown timer with auto-submit`.

### Task 19: Submit confirmation and result screen

**Files:** Create `src/components/ConfirmDialog.jsx`, `src/screens/Result.jsx`, `src/screens/Result.css`. Modify `src/screens/Test.jsx`, `src/App.jsx`.

**Interfaces:**
- `<ConfirmDialog open title body confirmLabel onConfirm onCancel busy />` is a native `<dialog>` with `showModal()`. Esc cancels.
- Submit Quiz opens it with body "You've answered {answered} of {total} questions. {marked} marked for review." and buttons Cancel and "Submit" (green, shows "Submitting…" while busy). Confirm calls `api.submit`, then `onSubmitted`. If auto-submit fires while the dialog is open, the dialog closes and the result shows.
- `<Result user result onLogout />` shows "Test submitted", "{name}", a large `{score} / {total}`, a percentage, a one-line message (≥8 "Excellent work!", ≥5 "Good effort!", else "Keep practicing!"), the submitted time, and a "Log out" button.

- [ ] **Step 1:** Verify the full flow as `diya@student.com`: answer 6 → Submit → the dialog shows correct counts → the result shows the right score. Logging out and back in goes straight to Result. `curl` of `GET /api/result` with that token matches the screen.
- [ ] **Step 2:** Commit `feat(app): add submit confirmation and result screen`.

### Task 20: Polish, production check, README

**Files:** Modify `athena/README.md` (replace the template text), `src/**/*.css` as needed. Create a root `README.md`.

- [ ] **Step 1:** README covers: what it is, how to run (`cd server && npm install && npm run dev`, `cd athena && npm install && npm run dev`), demo logins, `npm run reset`, and running tests in both packages.
- [ ] **Step 2:** Polish pass against the screenshot in both themes: focus rings, hover states, button disabled styles, and the 900px minimum window width.
- [ ] **Step 3:** Run `npm test` in `server/` and `athena/` → all pass; `npm run lint` → clean; `npm run build && npm start` → the full flow works against the running server.
- [ ] **Step 4:** Commit `docs: add readme and polish ui`.
