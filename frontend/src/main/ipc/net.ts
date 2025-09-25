// src/main/ipc/net.ts
import { ipcMain } from "electron";
import { join } from "path";
import { createWriteStream } from "fs";
import axios from "axios";
import { getDefaultPaths } from "../paths";

type ProgressEvent = { id: string; received: number; total: number; percent: number | null };

export function registerNetIpc() {
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
}
