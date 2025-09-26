// src/main/window.ts
import { BrowserWindow, app } from 'electron'
import { join, resolve } from 'path'

export function createMainWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#111111',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const isDev = !app.isPackaged
  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL! // плагин подставит http://localhost:5173
    win.loadURL(url)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(resolve(__dirname, '../../renderer/index.html'))
  }
  return win
}
