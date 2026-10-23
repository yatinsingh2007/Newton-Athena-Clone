import { app, BrowserWindow, ipcMain, session, shell, systemPreferences } from 'electron'
import path from 'node:path'
import { registerMediaIpc } from './media.js'

const devServerUrl = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    autoHideMenuBar: true,
    title: 'Athena',
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (devServerUrl) win.loadURL(devServerUrl)
  else win.loadFile(path.join(import.meta.dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() => {
  // Camera and mic are the only browser permissions the exam needs.
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media')
  })
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => permission === 'media')

  registerMediaIpc({ ipcMain, systemPreferences, shell, platform: process.platform })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
