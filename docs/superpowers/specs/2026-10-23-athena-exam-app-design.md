# Athena Exam App — Design

## Intent

A desktop clone of Newton School's Athena online examination app, built as a
learning project. A student logs in, proves their camera and mic work, takes a
timed 10-question MCQ test, submits, and sees their score. The visual reference
is the Athena quiz screen (screenshot on the user's Desktop:
`Screenshot 2026-10-23 at 1.38.27 AM.png`), in light and dark mode.

The work will be delivered as ~20 small, sequential commits so the project's
history reads step by step.

## Goals

- Electron desktop app (React + Vite renderer) talking to a local Express server.
- Flow: **Login → System Check → Test → Result**.
- All data lives in JSON files on the server. No database.
- UI closely matches the Athena screenshot, with light and dark themes.

## Non-goals

- Anti-cheat / proctoring: no fullscreen lock, tab-switch detection, recording,
  or face detection.
- Registration, password reset, admin panel, multiple tests, question authoring UI.
- Real security (hashed passwords, HTTPS). Users are hardcoded for a demo.
- Packaging/installers for distribution.

## Anti-goals (would make it a failure even if it "works")

- Correct answers sent to the client before submission.
- Camera visible during the test (the user explicitly does not want this).
- A generic look that doesn't resemble the Athena screenshot.

## Existing state (build on this)

- `athena/` — Vite + React 19 starter (default template page still in place).
  Dev deps already installed: `electron@45`, `concurrently`, `wait-on`,
  `cross-env`. `package.json` has `"type": "module"`. `athena/app/main.js`
  exists, empty — this is the Electron main process entry.
- `server/` — Express 5 + nodemon installed. `app.js` and `questions.json` are empty.
- Git repo root is the project root (`Newton-Athena-Clone/`), branch `main`.

## Screens and behavior

### 1. Login
- Email + password form, styled like the rest of the app.
- POST to server; on failure show an inline error ("Invalid email or password").
- On success the client keeps the returned user (id, name, email) and a session
  token in memory (my call; the client does not persist login across app
  restarts — the student logs in again and resumes).
- If the user has already submitted, skip straight to the Result screen with
  their saved score (one attempt per student — my call).

### 2. System Check (before the test)
- Explains that camera and microphone access is required.
- "Allow camera & microphone" button calls `getUserMedia({ video, audio })`.
- Once granted: shows the student's live webcam preview (their face) and a
  simple mic level indicator so they can see both work.
- If denied or no device: clear error and a "Try again" button; student cannot
  proceed.
- "Start Test" is enabled only when both camera and mic are granted.
- On Start Test the media stream is stopped — the camera is **not** used or
  shown during the test.
- Electron must grant the `media` permission request from the renderer
  (`session.setPermissionRequestHandler`), so the OS-level prompt is the only
  gate. On macOS, OS camera/mic consent prompts will appear on first run.

### 3. Test
Layout follows the screenshot, centered column (~1000px max) on the page:

- **Top bar:** test title left; right side has the 10:00 countdown (mm:ss),
  a light/dark toggle, and the green **Submit Quiz** button. Timer turns red in
  the last minute (my call).
- **Question header:** spaced uppercase `QUESTION n/10` label; on the right,
  **Mark for review** (outlined, purple text; toggles and shows active state)
  and **Clear Selection** (outlined grey). The bug/report icon is omitted.
- **Question text:** large bold. Inline code in questions (backtick-wrapped in
  JSON) renders as pink monospace, like `AsyncStorage` in the screenshot.
- **Options:** 4 full-width bordered cards with a boxed letter A–D and the
  option text. Click selects; clicking another changes it; selected card is
  visibly highlighted (purple border/tint).
- **Bottom bar:** **Previous** (left, disabled on Q1), **grid button** (center),
  black **Next** (right, disabled on Q10).
- **Grid button** opens a question palette (popover/modal) with buttons 1–10
  that jump to that question, colored by status: not visited, visited but
  unanswered, answered, marked for review (marked + answered shown distinctly
  from marked only), plus a small legend.
- **Submit Quiz** opens a confirmation dialog summarizing
  "Answered X of 10 · Y marked for review" with Cancel / Submit.
- **Timer:** 10 minutes, counts down from when the test starts. At 0:00 the
  test auto-submits whatever is answered, with no confirmation.
- Timer source of truth is the server's `startedAt`; the client shows
  `startedAt + 10 min − now` (see Resume below).

### Resume after interruption (decided by the user: resume)
If the app closes, crashes, or reloads mid-test, the student logs back in and
resumes where they left off:
- `startedAt` is recorded the **first** time the test is started and never
  reset; the clock keeps running while the app is closed.
- Every answer change, clear, and mark-for-review toggle is saved to the server
  immediately, so nothing lives only in client memory.
- On re-login with an unsubmitted attempt, the student goes through System
  Check again (my call), then lands on the test with saved answers, marks, and the remaining time.
- If the deadline already passed while they were away, the server
  auto-submits the saved answers and the student goes straight to Result.
- Attempt state and sessions are stored in JSON files, so a server restart
  doesn't lose them.

### 4. Result
- Shows score as "7 / 10" prominently, with the student's name and a short
  message. Optionally a per-question correct/incorrect list (builder's call).
- Logout button returns to Login.

### Theme
- Light is the screenshot: white background, thin grey borders, near-black
  text, purple accent, green submit, black primary Next button.
- Dark: same layout, dark background, light text, adjusted borders.
- Defaults to the OS setting (`prefers-color-scheme`); the toggle overrides it
  and the choice is remembered in `localStorage`.
- Implemented with CSS custom properties; plain CSS (no UI framework) is fine.

## Server (Express, JSON storage)

Files under `server/data/` (or `server/` root — builder's call), all JSON:

- `users.json` — hardcoded students: `{ id, name, email, password }`. Seed 3.
- `questions.json` — the test: `{ title, durationMinutes: 10, questions: [{ id,
  text, options: [4 strings], answerIndex }] }`. Seed 10 real MCQs (React /
  JavaScript topics fit the Athena theme).
- `attempts.json` — one entry per student: `{ userId, startedAt, answers:
  { [questionId]: optionIndex }, marked: [questionId], submittedAt, score,
  total }`. `submittedAt`/`score` are null until submitted. This replaces a
  separate results file (my call): an attempt with `submittedAt` set is the
  result. Written with read-modify-write.
- `sessions.json` — `{ [token]: userId }`, so logins survive server restarts.

Endpoints (JSON, CORS allows all origins so both the Vite dev server and the
production `file://` page (origin `null`) work — my call):

- `POST /api/login` `{ email, password }` → `{ token, user }` or 401.
- `GET /api/test` (auth) → title, duration, questions **without**
  `answerIndex`, plus the attempt's `startedAt`, server `now`, saved `answers`
  and `marked`. Creates the attempt with `startedAt` on first call only. If the
  deadline has passed, auto-submits and returns the result instead.
- `PUT /api/attempt` (auth) `{ answers, marked }` → saves in-progress state.
  Rejected after submission or after the deadline (plus a ~10s grace).
- `POST /api/submit` (auth) `{ answers: { [questionId]: optionIndex } }` →
  grades, saves to `attempts.json`, returns `{ score, total }`. Rejects a second
  submission; accepts up to ~10s past the deadline so the 0:00 auto-submit lands.
- `GET /api/result` (auth) → saved result or 404 (used to skip to Result on
  re-login).

Auth: `Authorization: Bearer <token>`, tokens stored in `sessions.json`.

Port: 4000 (my call). Add `start` / `dev` (nodemon) scripts to `server/package.json`.
nodemon must ignore the data JSON files the server writes, so a save doesn't
restart the server mid-request (my call). Add a `reset` script
that clears `attempts.json` and `sessions.json`, since each seeded student can only submit once
(my call).

## Electron + dev workflow

- `athena/app/main.js` creates a BrowserWindow (~1280×800), loads the Vite dev
  URL in development and `dist/index.html` in production, with
  `contextIsolation: true`, `nodeIntegration: false`.
- Media permission handler as described above.
- Native abilities (OS camera/mic permission status and prompts, opening
  System Settings) go through IPC: a `contextBridge` preload exposes
  `window.athena.media.*`, handled in main with `ipcMain.handle` using
  `systemPreferences` (decided by the user).
- Vite `base: './'` so the built `dist/index.html` loads from disk; the
  production path should be checked once with a build (my call).
- `npm run dev` in `athena/` runs Vite and Electron together via
  `concurrently` + `wait-on`. Set `"main": "app/main.js"` in `package.json`.
- Server runs separately (`npm run dev` in `server/`).
- Remove the Vite starter content (hero image, counter, docs links).

## Commit plan constraint

About 20 small, coherent commits on `main`, each leaving the app runnable,
roughly in this order: server scaffolding → data files → each endpoint →
Electron wiring → theme/base styles → each screen → palette → timer →
submit/result → polish. Exact split is the builder's call.

## Left to the builder

- Component/file structure, state management (React state/context is enough),
  routing approach (simple state machine is fine; no router needed).
- Exact colors, spacing, and status colors for the palette.
- Question content.
- Whether the Result screen lists per-question correctness.
