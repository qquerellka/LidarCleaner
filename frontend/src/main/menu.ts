// src/main/menu.ts
import { Menu, shell, BrowserWindow } from "electron";
import log from "electron-log";

export function setupMenu(win: BrowserWindow) {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "Open PCD…",
          accelerator: "CmdOrCtrl+O",
          click: () => win.webContents.send("menu:openPCD"),
        },
        { type: "separator" },
        {
          label: "Open DevTools",
          accelerator: process.platform === "darwin" ? "Alt+Cmd+I" : "Ctrl+Shift+I",
          click: () => win.webContents.openDevTools({ mode: "detach" }),
        },
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => win.webContents.reload(),
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
