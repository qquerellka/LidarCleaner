// src/main/ipc/backend.ts
import { ipcMain, BrowserWindow } from "electron";
import axios from "axios";
import { join, basename } from "path";
import { createWriteStream, createReadStream } from "fs";
import { promises as fsp } from "fs";
import FormData from "form-data";

// Можно переопределить через переменную окружения при старте:
// BACKEND_URL=http://localhost:9000 npm run dev
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

function broadcastLog(payload: unknown) {
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("debug:api-log", payload);
    }
  } catch {
    // noop
  }
}

// Shared axios instance with interceptors for logging
const api = axios.create({ baseURL: BACKEND_URL });

api.interceptors.request.use((config) => {
  const rid = Math.random().toString(36).slice(2, 10);
  (config as any).meta = { rid, t0: Date.now() };
  const msg = {
    phase: "request" as const,
    rid,
    method: (config.method || "GET").toUpperCase(),
    url: `${config.baseURL || ""}${config.url || ""}`,
    ts: new Date().toISOString(),
  };
  console.info("[API]", msg);
  broadcastLog(msg);
  return config;
});

api.interceptors.response.use(
  (response) => {
    const meta = (response.config as any).meta || {};
    const msg = {
      phase: "response" as const,
      rid: meta.rid,
      status: response.status,
      url: `${response.config.baseURL || ""}${response.config.url || ""}`,
      durationMs: Date.now() - (meta.t0 || Date.now()),
      contentLength: response.headers?.["content-length"] || null,
    };
    console.info("[API]", msg);
    broadcastLog(msg);
    return response;
  },
  (error) => {
    const cfg = error.config || {};
    const meta = (cfg as any).meta || {};
    const msg = {
      phase: "error" as const,
      rid: meta.rid,
      url: `${cfg.baseURL || ""}${cfg.url || ""}`,
      message: error.message,
      code: error.code || null,
      status: error.response?.status || null,
    };
    console.error("[API]", msg);
    broadcastLog(msg);
    return Promise.reject(error);
  }
);

// Если у тебя уже есть утилита путей — замени импорт на свой.
// Вариант по месту: складываем во временную папку системы.
function getTempDir() {
  // Если есть твой getDefaultPaths().temp — используй его
  return process.env.TMPDIR || process.env.TEMP || "/tmp";
}

export function registerBackendIpc() {
  ipcMain.handle("backend:health", async () => {
    const { data } = await api.get(`/health`, { timeout: 10000 });
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
  const response = await api.get(url, { responseType: "stream", timeout: 60_000 });
      await new Promise<void>((resolve, reject) => {
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
      return targetPath;
    }
  );

  // Просто загрузка файла на /files/upload_file (без ожидания результата обработки)
  ipcMain.handle(
    "backend:uploadFile",
    async (event, payload: { filePath: string; objectKey?: string; id?: string }) => {
      const { filePath } = payload;

      const id = payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const stat = await fsp.stat(filePath);
      const total = stat.size;

      const readStream = createReadStream(filePath);
      let uploaded = 0;
      readStream.on("data", (chunk: Buffer | string) => {
        uploaded += (typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length);
        const percent = total > 0 ? uploaded / total : null;
        event.sender.send("upload:progress", { id, uploaded, total, percent });
      });

      const form = new FormData();
      form.append("file", readStream);

      const response = await api.post(`/files/upload_file`, form, {
        headers: form.getHeaders(),
        responseType: "stream",
        timeout: 10 * 60_000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      // Сливаем поток ответа в "никуда": на POSIX — /dev/null, на win32 — временный файл с последующим удалением
      const isWin = process.platform === "win32";
      const sinkPath = isWin ? join(getTempDir(), `upload-discard-${Date.now()}`) : "/dev/null";

      await new Promise<void>((resolve, reject) => {
        const writer = createWriteStream(sinkPath);
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      if (isWin) {
        // Удаляем временный файл-приёмник
        try { await fsp.unlink(sinkPath); } catch { /* ignore */ }
      }

      return { ok: true, id };
    }
  );

  // Отправляем открытый файл на POST /files/download, сохраняем ответ и возвращаем путь
  ipcMain.handle(
    "backend:processDynamic",
    async (_evt, payload: { filePath: string; suggestedName?: string }) => {
      const { filePath, suggestedName } = payload;

      const form = new FormData();
      form.append("file", createReadStream(filePath));

      const response = await api.post(`/files/download`, form, {
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
