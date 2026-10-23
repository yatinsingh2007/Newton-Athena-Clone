// OS-level camera/mic access. Electron APIs are passed in so this can be unit tested.

const SETTINGS_URLS = {
  darwin: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera',
  win32: 'ms-settings:privacy-webcam',
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

export function registerMediaIpc({ ipcMain, systemPreferences, shell, platform }) {
  ipcMain.handle('media:status', () => getMediaStatus({ platform, systemPreferences }))
  ipcMain.handle('media:request', () => requestMediaAccess({ platform, systemPreferences }))
  ipcMain.handle('media:open-settings', async () => {
    const url = SETTINGS_URLS[platform]
    if (url) await shell.openExternal(url)
  })
}
