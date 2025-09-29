// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electronRenderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig({
  // фронт хранится тут
  root: 'src/renderer',
  plugins: [
    react(),
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
  server: { host: true, port: 5173, strictPort: true },
})
