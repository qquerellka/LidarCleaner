// src/main/window.ts
import { BrowserWindow, app } from 'electron'
import { join, resolve } from 'path'
import { existsSync } from 'fs'

export function createMainWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#111111',
    autoHideMenuBar: true,
    show: false, // Не показываем пока не загрузится контент
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Определяем режим: если есть собранный renderer, то production
  const rendererPath = resolve(__dirname, '../renderer/index.html')
  const isDev = !existsSync(rendererPath)
  
  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    console.log('[Dev] Loading from Vite:', url)
    win.loadURL(url)
    
    // Показываем окно когда контент загружен
    win.webContents.on('did-finish-load', () => {
      win.show()
      win.focus()
    })
    
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Production: main в dist-electron/main/, renderer в dist-electron/renderer/
    console.log('[Production] Loading from file:', rendererPath)
    win.loadFile(rendererPath)
    
    // Показываем окно когда контент загружен
    win.webContents.on('did-finish-load', () => {
      win.show()
      win.focus()
    })
  }
  
  return win
}
