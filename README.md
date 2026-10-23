# Athena Clone

A desktop clone of Newton School's Athena exam app. A student logs in or signs up, passes a camera and microphone check, takes a 10-minute, 10-question MCQ test in a locked full-screen window, and sees their score. They can reattempt the test afterwards.

## Exam time

**Saturday 24 October 2026, 10:00–10:10 AM IST.** The test opens for everyone at 10:00 and closes at 10:10, when any unsubmitted answers are submitted automatically. Install Athena 1.4.0 or later before then. To change the time, edit `startsAt` in `server/data/questions.json` and push (see [Exam window](#how-it-works)).

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

**This deployment is a demo.** Vercel only lets the server write to a temporary folder that is wiped whenever Vercel starts a fresh instance. The demo logins and questions always work, but sign-ups, answers, scores and screenshots can disappear. Vercel can also run several instances at once, each with its own folder, so a proctor may not see every screenshot. For data that lasts, run the server somewhere with a persistent disk.

## Accounts

Students can create their own account from **Create an account** on the login screen (name, email, password of 6+ characters). New accounts are added to `server/data/users.json` with hashed passwords.

There are also three demo student logins:

| Email | Password |
| --- | --- |
| aarav@student.com | pass123 |
| diya@student.com | pass123 |
| kabir@student.com | pass123 |

And a demo proctor, who sees the proctor dashboard instead of the test:

| Email | Password |
| --- | --- |
| proctor@athena.com | proctor123 |

A proctor is any account in `users.json` with `"role": "proctor"`. The proctor dashboard has a tab for each test.

After submitting, students can press **Reattempt test** on the score screen to take the test again. Earlier scores are listed under the latest one.

To clear every student's attempts and logins:

```bash
cd server && npm run reset
```

## How it works

- **Tests:** there are two. The **exam** (`server/data/questions.json`) runs at a fixed time for everyone. The **practice test** (`server/data/practice.json`) has no `startsAt`, so it can be taken at any time: each student gets 10 minutes from when they open it, kept on the server so a reload doesn't reset the clock, and can retake it whenever they like. Both follow the same rules: system check, screen share, locked window, screenshots, and time away reported to the proctor. Tests are listed in `server/lib/tests.js`; each one's routes are at `/api/tests/<id>/...`, and the exam's are also at `/api/...` for older apps.
- **Home:** after logging in, students see every test: when it's live (date and time window, or "Any time"), a live countdown, and whether they've completed it, with their score. From there they start, resume, or view their result.
- **System check:** before the test, the app asks for camera and mic access through Electron IPC (`window.athena.media`, handled in `athena/app/main.js`), then shows a live preview and a mic level bar. The camera is switched off once the test starts.
- **Screen share:** the student then shares their whole screen (`getDisplayMedia`, answered in `athena/app/main.js` with the primary screen and no picker). Sharing stays on for the whole test; if it stops, or after a reload, the questions are hidden until the screen is shared again, while the timer keeps running. It stops on submit or logout. On macOS, Athena needs **Screen Recording** permission (System Settings → Privacy & Security), and must be reopened after it's turned on. While the test is on screen, the app sends a screenshot of it (JPEG, at most 1280px wide) every 15 seconds to `POST /api/screen`.
- **Locked from launch:** as soon as Athena opens it's full screen and on top of everything, takes focus back if it loses it, and ignores Cmd+W/H/M/N/T. During the test Cmd+Q and Cmd+R are blocked too and the app can't quit; outside it Cmd+Q still quits (macOS needs Athena restarted after Screen Recording is turned on). The lock steps aside while System Settings is open for a permission, and for proctors. macOS can still let some switches through (Cmd+Tab, other desktops), so during the test every time the window loses focus the student sees a warning and the time away is reported to the server (`POST /api/away`).
- **Proctor dashboard:** a proctor who logs in sees the exam window, every student's progress, and their latest screenshot, refreshed every 10 seconds. A student in the test whose screen hasn't come through for 45 seconds, or who is away from the test window, is flagged in red, and each card says how often and how long they've left the test. Click a student to see their latest screen large, with earlier screenshots below.
- **Test:** one question at a time, with Previous/Next, Mark for review, Clear Selection, and a question palette. Every change is saved to the server right away.
- **Exam window:** `startsAt` in a test's file (the exam's is `server/data/questions.json`) opens the test to everyone at that time, for `durationMinutes`. After logging in, students see a live countdown to the start, then the time left, all from the server's clock (re-synced every 30 seconds). The test can't be opened before the start, everyone's time ends at the same moment, and once the window is over unstarted students see it as closed and reattempts are refused. It's currently `2026-10-24T10:00:00+05:30`. Remove `startsAt` to give each student 10 minutes from when they open the test instead.
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
| `questions.json` | The exam: title, duration, start time (`startsAt`), and questions with correct answers (never sent to the app) |
| `practice.json` | The practice test, in the same format, with no `startsAt` |
| `attempts.json` | Each student's start time, answers, review marks, and score once submitted |
| `sessions.json` | Login tokens |
| `screens/<testId>/<userId>/<time>.jpg` | Screenshots of each student's screen during a test (newest 120 per test kept) |

`attempts.json`, `sessions.json` and `screens/` are created by the server as it runs and are not tracked in git. `npm run reset` clears attempts, logins and screenshots but keeps accounts.
