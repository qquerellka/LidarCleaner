// preload.ts
import { contextBridge, ipcRenderer } from "electron";

// Узкое безопасное API. Всё остальное в рендерере недоступно.
contextBridge.exposeInMainWorld("api", {
  // Диалог открытия .pcd
  openPCD: (): Promise<string | null> => ipcRenderer.invoke("dialog:openPCD"),

  // Диалог сохранения файла
  saveFile: (opts: {
    suggestedName?: string;
    data: ArrayBuffer | Uint8Array | string;
  }): Promise<string | null> => ipcRenderer.invoke("dialog:saveFile", opts),

  // Системные пути
  getPaths: (): Promise<{
    temp: string;
    userData: string;
    documents: string;
    downloads: string;
  }> => ipcRenderer.invoke("app:getPaths"),

  // Скачивание больших файлов (через main, с прогрессом)
  // Вернёт путь к временному файлу
  downloadTemp: (url: string, filename?: string): Promise<string> => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return ipcRenderer.invoke("net:downloadTemp", { id, url, filename });
  },

  // Подписка на прогресс скачивания
  onDownloadProgress: (
    cb: (p: {
      id: string;
      received: number;
      total: number;
      percent: number | null;
    }) => void
  ) => {
    const handler = (
      _: unknown,
      payload: {
        id: string;
        received: number;
        total: number;
        percent: number | null;
      }
    ) => cb(payload);
    ipcRenderer.on("download:progress", handler);
    // Возвращаем отписку
    return () => ipcRenderer.removeListener("download:progress", handler);
  },

  // Событие из меню "File/Open PCD…"
  onMenuOpenPCD: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("menu:openPCD", handler);
    return () => ipcRenderer.removeListener("menu:openPCD", handler);
  },

  readFile: (path: string): Promise<Uint8Array> =>
    ipcRenderer.invoke("fs:readFile", { path }),

  // Backend API
  backendHealth: (): Promise<unknown> => ipcRenderer.invoke("backend:health"),
  backendDownloadById: (id: string, filename?: string): Promise<string> =>
    ipcRenderer.invoke("backend:downloadById", { id, filename }),
  backendUploadFile: (filePath: string, objectKey?: string): Promise<unknown> =>
    ipcRenderer.invoke("backend:uploadFile", { filePath, objectKey }),
});

// ---- Типы для TS в рендерере ----
declare global {
  interface Window {
    api: {
      openPCD: () => Promise<string | null>;
      saveFile: (opts: {
        suggestedName?: string;
        data: ArrayBuffer | Uint8Array | string;
      }) => Promise<string | null>;
      getPaths: () => Promise<{
        temp: string;
        userData: string;
        documents: string;
        downloads: string;
      }>;
      downloadTemp: (url: string, filename?: string) => Promise<string>;
      onDownloadProgress: (
        cb: (p: {
          id: string;
          received: number;
          total: number;
          percent: number | null;
        }) => void
      ) => () => void;
      onMenuOpenPCD: (cb: () => void) => () => void;
      readFile: (path: string) => Promise<Uint8Array>;
      backendHealth: () => Promise<unknown>;
      backendDownloadById: (id: string, filename?: string) => Promise<string>;
      backendUploadFile: (filePath: string, objectKey?: string) => Promise<unknown>;
    };
  }
}
