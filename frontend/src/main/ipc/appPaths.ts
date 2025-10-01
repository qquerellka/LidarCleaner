// src/main/ipc/appPaths.ts
import { ipcMain } from "electron";
import { getDefaultPaths } from "../paths";

export function registerAppPathsIpc() {
  ipcMain.handle("app:getPaths", async () => getDefaultPaths());
}
