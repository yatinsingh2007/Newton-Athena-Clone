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

## Demo logins

| Email | Password |
| --- | --- |
| aarav@student.com | pass123 |
| diya@student.com | pass123 |
| kabir@student.com | pass123 |

Each student gets one attempt. To take the test again, clear all attempts and logins:

```bash
cd server && npm run reset
```

## How it works

- **System check:** before the test, the app asks for camera and mic access through Electron IPC (`window.athena.media`, handled in `athena/app/media.js`), then shows a live preview and a mic level bar. The camera is switched off once the test starts.
- **Test:** one question at a time, with Previous/Next, Mark for review, Clear Selection, and a question palette. Every change is saved to the server right away.
- **Timer:** 10 minutes from the first time the test opens, based on the server's clock. When it runs out, the test submits automatically.
- **Resume:** if the app closes mid-test, log in again to pick up with the same answers and the time that's left. If time ran out meanwhile, the saved answers are graded.
- **Theme:** light and dark mode follow the OS; the toggle overrides it.

## Tests

```bash
cd server && npm test
cd athena && npm test && npm run lint
```

## Data files (`server/data/`)

| File | Contents |
| --- | --- |
| `users.json` | Hardcoded students |
| `questions.json` | Test title, duration, and questions with correct answers (never sent to the app) |
| `attempts.json` | Each student's start time, answers, review marks, and score once submitted |
| `sessions.json` | Login tokens |
