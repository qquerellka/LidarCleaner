// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import electronRenderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig({
  // фронт хранится тут
  root: 'src/renderer',
  plugins: [
    react(),
    electron({
      // сборка main-процесса
      main: {
        entry: 'src/main/index.ts',
        vite: { build: { outDir: resolve(__dirname, 'dist-electron/main'), target: 'node18', watch: {} } },
        onstart({ startup }) {
          // запускаем Electron в dev-режиме
          startup()
        },
      },
      // сборка preload
      preload: {
        input: { preload: 'src/main/preload.ts' },
        vite: { build: { outDir: resolve(__dirname, 'dist-electron/preload'), target: 'node18', watch: {} } },
      },
    }),
    // чтобы импортировать из 'electron' и нативных модулей в рендерере
    electronRenderer(),
  ],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared':   resolve(__dirname, 'src/shared'),
      '@main':     resolve(__dirname, 'src/main'),
      '@ipc':      resolve(__dirname, 'src/main/ipc'),
    },
  },
  build: {
    // складываем рендерер вместе в dist-electron/renderer
    outDir: resolve(__dirname, 'dist-electron/renderer'),
    emptyOutDir: true,
  },
  server: { port: 5173, strictPort: true },
})
