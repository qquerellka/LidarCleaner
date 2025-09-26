import { ipcMain } from "electron";
import { promises as fsp } from "fs";

export function registerFsIpc() {
  // Вернёт бинарь как Uint8Array (удобно передавать в рендерер)
  ipcMain.handle("fs:readFile", async (_evt, payload: { path: string }) => {
    const buf = await fsp.readFile(payload.path);
    // Возвращаем "сырой" массив без копирования
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  });
}
