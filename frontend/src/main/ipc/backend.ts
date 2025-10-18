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

  // Task management for processing + cancel support
  const processingTasks: Map<string, AbortController> = new Map();

  ipcMain.handle(
    "backend:cancelProcess",
    async (_evt, payload: { taskId: string }) => {
      const { taskId } = payload;
      const ctrl = processingTasks.get(taskId);
      if (!ctrl) return { ok: false, message: "unknown task" };
      
      try {
        // Отправляем запрос на бэкенд для отмены через RabbitMQ
        // Бэкенд отправит глобальное сообщение "cancel" в очередь
        try {
          await api.post("/files/cancel");
        } catch (apiError) {
          console.warn("Failed to send cancel request to backend:", apiError);
          // Продолжаем даже если бэкенд не ответил
        }
        
        // Прерываем HTTP запрос на стороне клиента
        ctrl.abort();
        processingTasks.delete(taskId);
        
        return { ok: true };
      } catch (e) {
        return { ok: false, message: String(e) };
      }
    }
  );

  // Start processing and return taskId immediately. Work runs in background and emits events:
  // 'backend:process-progress' { taskId, received, total, percent }
  // 'backend:process-done' { taskId, path }
  // 'backend:process-error' { taskId, error }
  ipcMain.handle(
    "backend:processDynamic",
    async (_evt, payload: { filePath: string; suggestedName?: string }) => {
      const { filePath, suggestedName } = payload;
      const taskId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const controller = new AbortController();
      processingTasks.set(taskId, controller);

      // run background worker
      (async () => {
        const form = new FormData();
        form.append("file", createReadStream(filePath));

        try {
          const response = await api.post(`/files/download`, form, {
            headers: form.getHeaders(),
            responseType: "stream",
            timeout: 2 * 60 * 60_000,
            maxBodyLength: Infinity,
            signal: controller.signal as any,
          });

          const sinkName = `proc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const sinkPath = join(getTempDir(), sinkName);
          const writer = createWriteStream(sinkPath);

          let received = 0;
          const contentLengthHeader = response.headers["content-length"];
          const total = contentLengthHeader ? parseInt(String(contentLengthHeader), 10) : null;

          const CHUNK_PEEK = 512;
          let firstChunk: Buffer | null = null;
          let outName: string | null = null;
          const cd = String(response.headers["content-disposition"] || "");
          const match = /filename=\"?([^\";]+)\"?/i.exec(cd);
          if (match) outName = match[1];

          await new Promise<void>((resolve, reject) => {
            response.data.on("data", (chunk: Buffer | string) => {
              try {
                const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
                if (!firstChunk) firstChunk = Buffer.from(buf.slice(0, CHUNK_PEEK));
                received += buf.length;
                writer.write(buf);

                const pct = total ? Math.round((received / total) * 100) : null;
                for (const win of BrowserWindow.getAllWindows()) {
                  win.webContents.send("backend:process-progress", { taskId, received, total, percent: pct });
                }
              } catch (e) {
                // ignore per-chunk errors
              }
            });

            response.data.on("end", () => {
              writer.end();
            });

            response.data.on("error", (e: Error) => reject(e));
            writer.on("finish", () => resolve());
            writer.on("error", (e) => reject(e));
          });

          if (!outName) {
            const hint = (suggestedName || basename(filePath)).replace(/(\.[^.]+)?$/, "");
            if (firstChunk) {
              const buf = firstChunk as Buffer;
              const head = buf.toString("utf8", 0, Math.min(buf.length, 64)).toLowerCase();
              if (head.includes("ply")) outName = `${hint}.ply`;
              else if (head.includes("# .pcd") || head.includes(".pcd") || head.includes("version")) outName = `${hint}.pcd`;
              else outName = `${hint}-cleaned.ply`;
            } else {
              outName = `${hint}-cleaned.ply`;
            }
          }

          const outPath = join(getTempDir(), outName);
          try {
            await fsp.rename(sinkPath, outPath);
          } catch (e) {
            try {
              await fsp.copyFile(sinkPath, outPath);
              await fsp.unlink(sinkPath);
            } catch (_) {
              // ignore
            }
          }

          // emit done
          for (const win of BrowserWindow.getAllWindows()) {
            win.webContents.send("backend:process-done", { taskId, path: outPath });
          }
        } catch (err: any) {
          const message = err?.message || String(err);
          for (const win of BrowserWindow.getAllWindows()) {
            win.webContents.send("backend:process-error", { taskId, error: message });
          }
        } finally {
          processingTasks.delete(taskId);
        }
      })();

      return taskId;
    }
  );
}
