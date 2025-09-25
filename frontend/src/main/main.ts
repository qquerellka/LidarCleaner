// main.ts
import { app, BrowserWindow, dialog, ipcMain, shell, Menu } from "electron";
import { join } from "path";
import { createWriteStream, promises as fsp } from "fs";
import axios from "axios";
import log from "electron-log";

// ---- Env / dev detection (Vite) ----
const isDev =
  process.env.NODE_ENV === "development" ||
  process.env.ELECTRON_IS_DEV === "1" ||
  !!process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;

// ---- Single instance lock ----
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// ---- Logging & crash guards ----
process.on("uncaughtException", (err) => {
  log.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (reason) => {
  log.error("[unhandledRejection]", reason);
});

// ---- Create window ----
async function createMainWindow() {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    show: false,
    backgroundColor: "#111111",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // webSecurity оставляем по умолчанию (ВКЛ) ради безопасности
    },
  });

  // Во весь экран при первом запуске (или можно .maximize())
  mainWindow.maximize();

  // DevTools доступны, но открываются по хоткею / меню
  // mainWindow.webContents.openDevTools({ mode: "detach" });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (isDev && devUrl) {
    await mainWindow.loadURL(devUrl);
  } else {
    // Путь к index.html после сборки Vite (настрой при необходимости)
    // Часто это ../renderer/index.html, если используешь vite-electron шаблон
    await mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  setupMenu();
}

// ---- App lifecycle ----
app.whenReady().then(createMainWindow);

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
});

app.on("window-all-closed", () => {
  // На macOS обычно оставляют приложение висеть; везде — закрываем
  app.quit();
});

// ---- Menu / Shortcuts ----
function setupMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "Open PCD…",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            mainWindow?.webContents.send("menu:openPCD");
          },
        },
        { type: "separator" },
        {
          label: "Open DevTools",
          accelerator: process.platform === "darwin" ? "Alt+Cmd+I" : "Ctrl+Shift+I",
          click: () => mainWindow?.webContents.openDevTools({ mode: "detach" }),
        },
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow?.webContents.reload(),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "View",
      submenu: [{ role: "togglefullscreen" }, { role: "zoomin" }, { role: "zoomout" }, { role: "resetzoom" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Open Logs Folder",
          click: async () => {
            const logPath = log.transports.file.getFile().path;
            await shell.showItemInFolder(logPath);
          },
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ---- Helpers ----
function getDefaultPaths() {
  return {
    temp: app.getPath("temp"),
    userData: app.getPath("userData"),
    documents: app.getPath("documents"),
    downloads: app.getPath("downloads"),
  };
}

// ---- IPC: dialogs & fs wrappers ----

// Open PCD
ipcMain.handle("dialog:openPCD", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Open PCD",
    properties: ["openFile"],
    filters: [{ name: "Point Cloud Data", extensions: ["pcd"] }],
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

// Save file (renderer передаёт { suggestedName, data } где data — ArrayBuffer/Uint8Array/base64)
ipcMain.handle("dialog:saveFile", async (_evt, payload: { suggestedName?: string; data: ArrayBuffer | Uint8Array | string }) => {
  const { suggestedName = "file.pcd", data } = payload || {};
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Save File",
    defaultPath: join(getDefaultPaths().downloads, suggestedName),
  });
  if (canceled || !filePath) return null;

  let buf: Buffer;
  if (data instanceof Uint8Array) buf = Buffer.from(data);
  else if (typeof data === "string") {
    // если пришёл base64 — можно распознать и декодировать; иначе сохраним как текст
    const maybeBase64 = data.startsWith("data:") ? data.split(",")[1] : data;
    try {
      buf = Buffer.from(maybeBase64, "base64");
    } catch {
      buf = Buffer.from(data, "utf8");
    }
  } else {
    buf = Buffer.from(new Uint8Array(data as ArrayBuffer));
  }

  await fsp.writeFile(filePath, buf);
  return filePath;
});

// Expose app paths
ipcMain.handle("app:getPaths", async () => getDefaultPaths());

// ---- IPC: network download in main with progress ----
// downloadTemp(url, filename?) -> returns absoluteFilePath; emits "download:progress" events {id, received, total, percent}
type ProgressEvent = { id: string; received: number; total: number; percent: number | null };

ipcMain.handle("net:downloadTemp", async (event, payload: { id: string; url: string; filename?: string }) => {
  const { id, url, filename } = payload;
  const tempDir = getDefaultPaths().temp;
  const safeName = filename || `download-${Date.now()}`;
  const targetPath = join(tempDir, safeName);

  const writer = createWriteStream(targetPath);
  const response = await axios.get(url, { responseType: "stream", timeout: 60_000 });

  const total = Number(response.headers["content-length"] || 0);
  let received = 0;

  await new Promise<void>((resolve, reject) => {
    response.data.on("data", (chunk: Buffer) => {
      received += chunk.length;
      const percent = total > 0 ? received / total : null;
      const msg: ProgressEvent = { id, received, total, percent };
      event.sender.send("download:progress", msg);
    });
    response.data.on("error", reject);
    writer.on("error", reject);
    writer.on("finish", resolve);
    response.data.pipe(writer);
  });

  return targetPath;
});
