// src/main/ipc/backend.ts
import { ipcMain } from "electron";
import axios from "axios";
import { join, basename } from "path";
import { createWriteStream, createReadStream } from "fs";
import FormData from "form-data";

// Можно переопределить через переменную окружения при старте:
// BACKEND_URL=http://localhost:9000 npm run dev
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Если у тебя уже есть утилита путей — замени импорт на свой.
// Вариант по месту: складываем во временную папку системы.
function getTempDir() {
  // Если есть твой getDefaultPaths().temp — используй его
  return process.env.TMPDIR || process.env.TEMP || "/tmp";
}

export function registerBackendIpc() {
  ipcMain.handle("backend:health", async () => {
    const { data } = await axios.get(`${BACKEND_URL}/health`, { timeout: 10000 });
    return data;
  });

  // (опционально) пример скачивания по id — если пригодится в будущем
  ipcMain.handle(
    "backend:downloadById",
    async (_evt, payload: { id: string; filename?: string }) => {
      const { id, filename } = payload;
      const url = `${BACKEND_URL}/files/download_by_id?id=${encodeURIComponent(id)}`;
      const targetName = filename || `file-${id}`;
      const targetPath = join(getTempDir(), targetName);
      const writer = createWriteStream(targetPath);
      const response = await axios.get(url, { responseType: "stream", timeout: 60_000 });
      await new Promise<void>((resolve, reject) => {
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
      return targetPath;
    }
  );

  // Отправляем открытый файл на POST /files/download, сохраняем ответ и возвращаем путь
  ipcMain.handle(
    "backend:processDynamic",
    async (_evt, payload: { filePath: string; suggestedName?: string }) => {
      const { filePath, suggestedName } = payload;

      const form = new FormData();
      form.append("file", createReadStream(filePath));

      const response = await axios.post(`${BACKEND_URL}/files/download`, form, {
        headers: form.getHeaders(),
        responseType: "stream",
        timeout: 10 * 60_000,
      });

      // Пытаемся вытащить имя из Content-Disposition
      const cd = String(response.headers["content-disposition"] || "");
      const match = /filename="?([^"]+)"?/i.exec(cd);

      let outName = suggestedName || (match ? match[1] : null);
      if (!outName) {
        const orig = basename(filePath);
        outName = orig.replace(/(\.[^.]+)?$/, "-cleaned$1");
      }

      const outPath = join(getTempDir(), outName);
      await new Promise<void>((resolve, reject) => {
        const writer = createWriteStream(outPath);
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      return outPath;
    }
  );
}
