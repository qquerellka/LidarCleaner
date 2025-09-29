// src/main/ipc/backend.ts
import { ipcMain } from "electron";
import axios from "axios";
import { join } from "path";
import { createWriteStream } from "fs";
import { getDefaultPaths } from "../paths";
import FormData from "form-data";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export function registerBackendIpc() {
  ipcMain.handle("backend:health", async () => {
    const { data } = await axios.get(`${BACKEND_URL}/health`, { timeout: 10000 });
    return data;
  });

  ipcMain.handle(
    "backend:downloadById",
    async (_event, payload: { id: string; filename?: string }) => {
      const { id, filename } = payload;
      const tempDir = getDefaultPaths().temp;
      const safeName = filename || `file-${id}-${Date.now()}`;
      const targetPath = join(tempDir, safeName);

      const writer = createWriteStream(targetPath);
      const response = await axios.get(`${BACKEND_URL}/files/download/${encodeURIComponent(id)}`,
        { responseType: "stream", timeout: 60_000 }
      );

      await new Promise<void>((resolve, reject) => {
        response.data.pipe(writer);
        response.data.on("error", reject);
        writer.on("error", reject);
        writer.on("finish", resolve);
      });

      return targetPath;
    }
  );

  ipcMain.handle(
    "backend:uploadFile",
    async (_event, payload: { filePath: string; objectKey?: string }) => {
      const { filePath, objectKey } = payload;
      const form = new FormData();
      // backend expects field name "file" per handlers.go
      form.append("file", await import("fs").then(m => m.createReadStream(filePath)) as any);
      if (objectKey) form.append("object_key", objectKey);

      const headers = form.getHeaders();
      const { data } = await axios.post(`${BACKEND_URL}/files/upload_file`, form, { headers, timeout: 60_000 });
      return data;
    }
  );
}


