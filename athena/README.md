# Athena desktop app

Electron + React + Vite. See the [project README](../README.md) for how to run everything.

- `app/main.js` — Electron main process: window, media permission handler, IPC registration
- `app/preload.cjs` — exposes `window.athena` to the page via `contextBridge`
- `app/media.js` — OS camera/mic permission checks behind the `media:*` IPC channels
- `src/screens/` — Login, SystemCheck, Test, Result
- `src/lib/` — logic with unit tests (`npm test`)
