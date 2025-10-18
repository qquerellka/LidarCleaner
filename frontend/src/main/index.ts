// src/main/index.ts
import { app, BrowserWindow } from "electron";
import { initLogger } from "./logger";
import { createMainWindow } from "./window";
import { setupMenu } from "./menu";
import { registerDialogIpc } from "./ipc/dialogs";
import { registerAppPathsIpc } from "./ipc/appPaths";
import { registerNetIpc } from "./ipc/net";
import { registerFsIpc } from "./ipc/fs";
import { registerBackendIpc } from "./ipc/backend";

let mainWindow: BrowserWindow | null = null;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const log = initLogger();

// Проверка что app доступен
if (!app) {
  console.error('Electron app is not available!');
  process.exit(1);
}

// single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

function registerAllIpc() {
  registerDialogIpc();
  registerAppPathsIpc();
  registerNetIpc();
  registerFsIpc();
  registerBackendIpc();
}

app.whenReady().then(() => {
  mainWindow = createMainWindow();
  setupMenu(mainWindow);
  registerAllIpc();
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    mainWindow = createMainWindow();
    setupMenu(mainWindow);
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
