// // src/main/env.ts
// export const isDev =
//   process.env.NODE_ENV === "development" ||
//   process.env.ELECTRON_IS_DEV === "1" ||
//   !!process.env.VITE_DEV_SERVER_URL;

// export const DEV_URL = process.env.VITE_DEV_SERVER_URL || "";
// src/main/env.ts
import { app } from 'electron'

// dev, пока приложение не упаковано
export const isDev = !app.isPackaged

// когда Electron собирается через "build --watch", переменной VITE_DEV_SERVER_URL нет,
// поэтому даём дефолт на порт Vite-рендера (5173)
export const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
