import { app, BrowserWindow, desktopCapturer, ipcMain, screen, session, shell, systemPreferences } from 'electron'
import path from 'node:path'

// Set by `npm run dev`; when missing, load the built files from dist/.
const devServerUrl = process.env.VITE_DEV_SERVER_URL

// App icon for the window and the macOS Dock (instead of Electron's).
const iconPath = path.join(import.meta.dirname, '..', 'build', 'icon.png')

// System Settings pages for camera, mic and screen recording privacy, per OS.
const SETTINGS_URLS = {
  darwin: {
    camera: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera',
    microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  },
  win32: {
    camera: 'ms-settings:privacy-webcam',
    microphone: 'ms-settings:privacy-microphone',
  },
}

// Locked windows are kept full screen, on top and focused. A window is locked
// from the moment the app opens; it's only released for a proctor, or while
// System Settings is open to grant a permission.
const locked = new Set()
// Windows with a test in progress: these also can't quit or reload.
const inTest = new Set()

// With Cmd (or Ctrl): close, hide, minimise, new window, new tab. During the
// test, quit and reload too; outside it Cmd+Q still quits, since macOS needs
// Athena restarted after Screen Recording is turned on.
const BLOCKED_KEYS = new Set(['w', 'h', 'm', 'n', 't'])
const BLOCKED_IN_TEST = new Set(['q', 'r'])

// The window should only ever show the app's own page.
function isTrustedUrl(url) {
  try {
    const parsed = new URL(url)
    if (devServerUrl) return parsed.origin === new URL(devServerUrl).origin
    return parsed.protocol === 'file:'
  } catch {
    return false
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    autoHideMenuBar: true,
    title: 'Athena',
    icon: iconPath,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  lock(win)

  // While locked, losing focus (Cmd+Tab, a notification, another desktop)
  // snaps straight back to Athena.
  win.on('blur', () => {
    if (!locked.has(win)) return
    setTimeout(() => {
      if (!locked.has(win) || win.isDestroyed()) return
      win.show()
      win.focus()
      app.focus({ steal: true })
    }, 100)
  })

  // While locked, shortcuts that would close, hide or minimise the window (and,
  // during the test, quit or reload) do nothing.
  win.webContents.on('before-input-event', (event, input) => {
    if (!locked.has(win) || input.type !== 'keyDown' || !(input.meta || input.control)) return
    const key = input.key.toLowerCase()
    if (BLOCKED_KEYS.has(key) || (inTest.has(win) && BLOCKED_IN_TEST.has(key))) event.preventDefault()
  })
  win.on('closed', () => {
    locked.delete(win)
    inTest.delete(win)
  })

  // Never leave the app's own page or open new windows.
  win.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault()
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (devServerUrl) win.loadURL(devServerUrl)
  else win.loadFile(path.join(import.meta.dirname, '..', 'dist', 'index.html'))
}

// ---- Camera and mic permissions (called from preload.js over IPC) ----

function getMediaStatus() {
  // Only macOS and Windows have an OS-level permission switch.
  if (process.platform !== 'darwin' && process.platform !== 'win32') {
    return { camera: 'granted', microphone: 'granted' }
  }
  return {
    camera: systemPreferences.getMediaAccessStatus('camera'),
    microphone: systemPreferences.getMediaAccessStatus('microphone'),
  }
}

ipcMain.handle('media:status', () => getMediaStatus())

ipcMain.handle('media:request', async () => {
  // macOS shows its permission dialog the first time we ask.
  if (process.platform === 'darwin') {
    await systemPreferences.askForMediaAccess('camera')
    await systemPreferences.askForMediaAccess('microphone')
  }
  const status = getMediaStatus()
  return { ...status, granted: status.camera === 'granted' && status.microphone === 'granted' }
})

// System Settings has to come to the front, so Athena steps back until the
// student returns to it, then locks again. During the test that time away is
// still reported to the proctor.
async function openSettings(event, url) {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win && locked.has(win)) {
    release(win)
    win.once('focus', () => lock(win))
  }
  await shell.openExternal(url)
}

ipcMain.handle('media:open-settings', async (event) => {
  const urls = SETTINGS_URLS[process.platform]
  if (!urls) return
  // Open the mic page if only the mic is blocked, otherwise the camera page.
  const { camera, microphone } = getMediaStatus()
  const onlyMicBlocked = camera === 'granted' && microphone !== 'granted'
  await openSettings(event, onlyMicBlocked ? urls.microphone : urls.camera)
})

// ---- Screen sharing (called from preload.js over IPC) ----
// Only macOS asks for permission (Screen Recording). Without it the capture
// still runs but shows just the wallpaper, so the app checks this status.

ipcMain.handle('screen:status', () =>
  process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('screen') : 'granted',
)

ipcMain.handle('screen:open-settings', async (event) => {
  const url = SETTINGS_URLS[process.platform]?.screen
  if (url) await openSettings(event, url)
})

// getDisplayMedia() from our page always gets the whole primary screen, with no
// picker: sharing a single window would hide everything else on screen.
async function shareScreen(request, callback) {
  if (!isTrustedUrl(request.frame?.url ?? request.securityOrigin)) return callback(null)
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    const primaryId = String(screen.getPrimaryDisplay().id)
    const source = sources.find((s) => s.display_id === primaryId) ?? sources[0]
    callback(source ? { video: source } : null)
  } catch {
    callback(null)
  }
}

// ---- Lock (called from preload.js over IPC) ----
// Kiosk mode makes the window full screen and, on macOS, hides the Dock and
// menu bar and asks the system to block Cmd+Tab and swiping to other desktops.
// macOS doesn't always honour that, so the window also stays on top of
// everything and takes focus back if it loses it (see createWindow). During
// the test the app reports any time away to the proctor as well.

function lock(win) {
  if (win.isDestroyed() || locked.has(win)) return
  locked.add(win)
  win.setKiosk(true)
  win.setAlwaysOnTop(true, 'screen-saver')
}

function release(win) {
  locked.delete(win)
  if (win.isDestroyed()) return
  win.setAlwaysOnTop(false)
  win.setKiosk(false)
}

const senderWindow = (event) => BrowserWindow.fromWebContents(event.sender)

// The test screen opens and closes: no quitting or reloading in between.
ipcMain.handle('exam:lock', (event) => {
  const win = senderWindow(event)
  if (!win) return
  inTest.add(win)
  lock(win)
})

ipcMain.handle('exam:unlock', (event) => {
  const win = senderWindow(event)
  if (win) inTest.delete(win)
})

// A proctor's dashboard isn't locked; logging out locks the app again.
ipcMain.handle('kiosk:release', (event) => {
  const win = senderWindow(event)
  if (win && !inTest.has(win)) release(win)
})

ipcMain.handle('kiosk:lock', (event) => {
  const win = senderWindow(event)
  if (win) lock(win)
})

// ---- App lifecycle ----

app.whenReady().then(() => {
  // On macOS the Dock icon comes from the app, not the window.
  app.dock?.setIcon(iconPath)

  // Camera, mic and screen capture are the only browser permissions the exam
  // needs, and only for our page.
  const allowed = (permission) => permission === 'media' || permission === 'display-capture'
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(allowed(permission) && isTrustedUrl(details.requestingUrl))
  })
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin) => allowed(permission) && isTrustedUrl(requestingOrigin),
  )
  session.defaultSession.setDisplayMediaRequestHandler(shareScreen)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// No quitting mid-test (Cmd+Q from the menu, the Dock, or logging out).
app.on('before-quit', (event) => {
  if (inTest.size > 0) event.preventDefault()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
