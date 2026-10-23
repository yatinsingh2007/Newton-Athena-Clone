import path from 'node:path'

const devServerUrl = process.env.VITE_DEV_SERVER_URL

// ---- Security: the window should only ever show the app's own page ----

// The Vite dev server in development, or the built files on disk in production.
export function isTrustedUrl(url, devServerUrl) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (devServerUrl) return parsed.origin === new URL(devServerUrl).origin
  return parsed.protocol === 'file:'
}

// ---- Camera and mic: OS-level access behind the media:* IPC channels ----
// Electron APIs are passed in so these can be unit tested without Electron.

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

const hasOsGate = (platform) => platform === 'darwin' || platform === 'win32'

export async function getMediaStatus({ platform, systemPreferences }) {
  // Linux has no OS permission gate; the browser-level check is all there is.
  if (!hasOsGate(platform)) return { camera: 'granted', microphone: 'granted' }
  return {
    camera: systemPreferences.getMediaAccessStatus('camera'),
    microphone: systemPreferences.getMediaAccessStatus('microphone'),
  }
}

export async function requestMediaAccess({ platform, systemPreferences }) {
  // Only macOS can prompt; askForMediaAccess shows the OS dialog on first use.
  if (platform === 'darwin') {
    await systemPreferences.askForMediaAccess('camera')
    await systemPreferences.askForMediaAccess('microphone')
  }
  const status = await getMediaStatus({ platform, systemPreferences })
  return { ...status, granted: status.camera === 'granted' && status.microphone === 'granted' }
}

// Open the pane for whichever device is blocked; the camera's if both are.
export function settingsUrl(platform, status) {
  const urls = SETTINGS_URLS[platform]
  if (!urls) return null
  const onlyMicBlocked = status.camera === 'granted' && status.microphone !== 'granted'
  return onlyMicBlocked ? urls.microphone : urls.camera
}

export function registerMediaIpc({ ipcMain, systemPreferences, shell, platform }) {
  ipcMain.handle('media:status', () => getMediaStatus({ platform, systemPreferences }))
  ipcMain.handle('media:request', () => requestMediaAccess({ platform, systemPreferences }))
  ipcMain.handle('media:open-settings', async () => {
    const url = settingsUrl(platform, await getMediaStatus({ platform, systemPreferences }))
    if (url) await shell.openExternal(url)
  })
}

// ---- App startup ----

async function start() {
  const { app, BrowserWindow, ipcMain, session, shell, systemPreferences } = await import('electron')

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
      if (!isTrustedUrl(url, devServerUrl)) event.preventDefault()
    })
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

    if (devServerUrl) win.loadURL(devServerUrl)
    else win.loadFile(path.join(import.meta.dirname, '..', 'dist', 'index.html'))
  }

  await app.whenReady()

  // Camera and mic are the only browser permissions the exam needs, and only for our page.
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(permission === 'media' && isTrustedUrl(details.requestingUrl, devServerUrl))
  })
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin) =>
      permission === 'media' && isTrustedUrl(requestingOrigin, devServerUrl),
  )

  registerMediaIpc({ ipcMain, systemPreferences, shell, platform: process.platform })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

// Only boot the app inside Electron; plain Node (the tests) just imports the helpers.
if (process.versions.electron) start()
