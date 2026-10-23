# Athena Clone

A desktop clone of Newton School's Athena exam app. A student logs in, passes a camera and microphone check, takes a 10-minute, 10-question MCQ test, and sees their score.

- `server/` — Express API. All data is stored in JSON files in `server/data/`; there is no database.
- `athena/` — Electron desktop app (React + Vite).

## Run it

You need Node 22+. Start the server first, then the app, each in its own terminal.

```bash
cd server
npm install
npm run dev        # http://localhost:4747
```

```bash
cd athena
npm install
npm run dev        # opens the Electron window
```

To run the built app instead of the dev server: `npm run build && npm start` in `athena/`.

## Build the Mac app (.dmg)

```bash
cd athena
npm install
npm run dist
```

This builds the app and writes `athena/release/Athena-1.0.0-arm64.dmg` (Apple Silicon Macs).

To install, open the `.dmg` and drag **Athena** into **Applications**. The app isn't signed with an Apple Developer certificate, so the first time you open it macOS will block it. Right-click Athena in Applications, choose **Open**, then **Open** again. After that it opens normally.

The `.dmg` contains only the desktop app. The exam server still has to be running (`cd server && npm run dev`) for login and tests to work.

## Accounts

Students can create their own account from **Create an account** on the login screen (name, email, password of 6+ characters). New accounts are added to `server/data/users.json` with hashed passwords.

There are also three demo logins:

| Email | Password |
| --- | --- |
| aarav@student.com | pass123 |
| diya@student.com | pass123 |
| kabir@student.com | pass123 |

After submitting, students can press **Reattempt test** on the score screen to take the test again. Earlier scores are listed under the latest one.

To clear every student's attempts and logins:

```bash
cd server && npm run reset
```

## How it works

- **System check:** before the test, the app asks for camera and mic access through Electron IPC (`window.athena.media`, handled in `athena/app/main.js`), then shows a live preview and a mic level bar. The camera is switched off once the test starts.
- **Test:** one question at a time, with Previous/Next, Mark for review, Clear Selection, and a question palette. Every change is saved to the server right away.
- **Timer:** 10 minutes from the first time the test opens, based on the server's clock. When it runs out, the test submits automatically.
- **Reattempt:** after submitting, a student can start a fresh attempt from the score screen; past scores are kept.
- **Resume:** if the app closes mid-test, log in again to pick up with the same answers and the time that's left. If time ran out meanwhile, the saved answers are graded.
- **Theme:** light and dark mode follow the OS; the toggle overrides it.
- **Security:** the window only shows the app's own page, refuses pop-ups and outside navigation, grants camera/mic only to that page, and the production build sets a Content Security Policy.

## Tests

```bash
cd server && npm test
cd athena && npm test && npm run lint
```

## Data files (`server/data/`)

| File | Contents |
| --- | --- |
| `users.json` | All students: the three demo ones plus everyone who signed up (passwords hashed) |
| `questions.json` | Test title, duration, and questions with correct answers (never sent to the app) |
| `attempts.json` | Each student's start time, answers, review marks, and score once submitted |
| `sessions.json` | Login tokens |

`attempts.json` and `sessions.json` are created by the server as it runs and are not tracked in git. `npm run reset` clears attempts and logins but keeps accounts.
