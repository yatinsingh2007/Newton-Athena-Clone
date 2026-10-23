import { app, BrowserWindow, ipcMain, session, shell, systemPreferences } from 'electron'
import path from 'node:path'

// Set by `npm run dev`; when missing, load the built files from dist/.
const devServerUrl = process.env.VITE_DEV_SERVER_URL

// System Settings pages for camera and mic privacy, per OS.
const SETTINGS_URLS = {
  darwin: {
    camera: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera',
    microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
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
  // Camera and mic are the only browser permissions the exam needs, and only for our page.
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(permission === 'media' && isTrustedUrl(details.requestingUrl))
  })
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin) =>
      permission === 'media' && isTrustedUrl(requestingOrigin),
  )

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
