# Athena Clone

A desktop clone of Newton School's Athena exam app. A student logs in or signs up, passes a camera and microphone check, takes a 10-minute, 10-question MCQ test in a locked full-screen window, and sees their score. They can reattempt the test afterwards.

## Download

**[⬇ Download Athena for Mac (Apple Silicon)](https://github.com/yatinsingh2007/Newton-Athena-Clone/releases/latest/download/Athena-arm64.dmg)** · [All releases](https://github.com/yatinsingh2007/Newton-Athena-Clone/releases)

1. Open the `.dmg` and drag **Athena** into **Applications**.
2. Open Athena. Because the app isn't notarized by Apple, macOS says it can't verify the developer. Click **Done**, then go to **System Settings → Privacy & Security**, scroll down to the message about Athena, and click **Open Anyway**. You only need to do this once.

   Or, in Terminal: `xattr -dr com.apple.quarantine /Applications/Athena.app`
3. Log in with a demo account (see [Accounts](#accounts)) or create your own.

The downloaded app uses the [demo server on Vercel](#deployed-server-vercel), so there's nothing else to run.

## Project layout

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

This builds the app and writes `athena/release/Athena-arm64.dmg` (Apple Silicon Macs). The app is ad-hoc signed, which needs no Apple Developer account. Install it the same way as the [download](#download). It talks to the deployed server on Vercel, so it works without running the server locally.

To publish a new version, bump `version` in `athena/package.json`, run `npm run dist`, and attach the new `.dmg` to a [GitHub release](https://github.com/yatinsingh2007/Newton-Athena-Clone/releases).

## Deployed server (Vercel)

The server is deployed at **https://athena-server-one.vercel.app** (`server/vercel.json`, entry point `server/api/index.js`). The Vercel project's Root Directory is `server`, and every push to `main` redeploys it automatically. To deploy by hand, run this from the repo root:

```bash
npx vercel deploy --prod
```

Builds of the app (`npm run build`, `npm start`, `npm run dist`) talk to that URL, set in `athena/.env.production` as `VITE_API_URL`. `npm run dev` keeps using the local server on port 4747.

**This deployment is a demo.** Vercel only lets the server write to a temporary folder that is wiped whenever Vercel starts a fresh instance. The demo logins and questions always work, but sign-ups, answers and scores can disappear. For data that lasts, run the server somewhere with a persistent disk.

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

- **Home:** after logging in, students see when the test is live (date and time window), a live countdown, and whether they've completed it, with their score. From there they start, resume, or view their result.
- **System check:** before the test, the app asks for camera and mic access through Electron IPC (`window.athena.media`, handled in `athena/app/main.js`), then shows a live preview and a mic level bar. The camera is switched off once the test starts.
- **Test:** one question at a time, with Previous/Next, Mark for review, Clear Selection, and a question palette. Every change is saved to the server right away.
- **Exam window:** `startsAt` in `server/data/questions.json` opens the test to everyone at that time, for `durationMinutes`. After logging in, students see a live countdown to the start, then the time left, all from the server's clock (re-synced every 30 seconds). The test can't be opened before the start, everyone's time ends at the same moment, and once the window is over unstarted students see it as closed and reattempts are refused. Remove `startsAt` to give each student 10 minutes from when they open the test instead.
- **Timer:** counts down to the end of the window on the server's clock. When it runs out, the test submits automatically.
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
| `questions.json` | Test title, duration, start time (`startsAt`), and questions with correct answers (never sent to the app) |
| `attempts.json` | Each student's start time, answers, review marks, and score once submitted |
| `sessions.json` | Login tokens |

`attempts.json` and `sessions.json` are created by the server as it runs and are not tracked in git. `npm run reset` clears attempts and logins but keeps accounts.
