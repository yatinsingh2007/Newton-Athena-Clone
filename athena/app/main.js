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

ipcMain.handle('media:open-settings', async () => {
  const urls = SETTINGS_URLS[process.platform]
  if (!urls) return
  // Open the mic page if only the mic is blocked, otherwise the camera page.
  const { camera, microphone } = getMediaStatus()
  const onlyMicBlocked = camera === 'granted' && microphone !== 'granted'
  await shell.openExternal(onlyMicBlocked ? urls.microphone : urls.camera)
})

// ---- Screen sharing (called from preload.js over IPC) ----
// Only macOS asks for permission (Screen Recording). Without it the capture
// still runs but shows just the wallpaper, so the app checks this status.

ipcMain.handle('screen:status', () =>
  process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('screen') : 'granted',
)

ipcMain.handle('screen:open-settings', async () => {
  const url = SETTINGS_URLS[process.platform]?.screen
  if (url) await shell.openExternal(url)
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

// ---- Exam lock (called from preload.js over IPC) ----
// Kiosk mode makes the window full screen and, on macOS, blocks swiping to other
// desktops, Cmd+Tab, the Dock and the menu bar until the test is over.

ipcMain.handle('exam:lock', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.setKiosk(true)
})

ipcMain.handle('exam:unlock', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.setKiosk(false)
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
