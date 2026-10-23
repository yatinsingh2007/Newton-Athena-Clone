const { contextBridge, ipcRenderer } = require('electron')

// The only native abilities the renderer gets, each one an IPC call into main.
contextBridge.exposeInMainWorld('athena', {
  platform: process.platform,
  media: {
    getStatus: () => ipcRenderer.invoke('media:status'),
    request: () => ipcRenderer.invoke('media:request'),
    openSettings: () => ipcRenderer.invoke('media:open-settings'),
  },
  screen: {
    getStatus: () => ipcRenderer.invoke('screen:status'),
    openSettings: () => ipcRenderer.invoke('screen:open-settings'),
  },
  kiosk: {
    release: () => ipcRenderer.invoke('kiosk:release'),
    lock: () => ipcRenderer.invoke('kiosk:lock'),
  },
  exam: {
    lock: () => ipcRenderer.invoke('exam:lock'),
    unlock: () => ipcRenderer.invoke('exam:unlock'),
  },
})
