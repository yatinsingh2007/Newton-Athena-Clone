# Athena desktop app

Electron + React + Vite. See the [project README](../README.md) for how to run everything.

- `app/main.js` — Electron main process: window, security rules, and the `media:*` IPC handlers for OS camera/mic permission
- `app/preload.js` — exposes `window.athena` to the page via `contextBridge`
- `src/screens/` — Login, SystemCheck, Test, Result
- `src/lib/` — logic with unit tests (`npm test`)
