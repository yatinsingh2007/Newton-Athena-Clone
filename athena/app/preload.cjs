const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('athena', {
  platform: process.platform,
})
