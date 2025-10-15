// preload.ts
import { contextBridge, ipcRenderer } from "electron";

// Simple structured logger for renderer DevTools
const API_DEBUG = true;
function logWrap<TArgs extends Record<string, unknown> | undefined, TResult = unknown>(
  name: string,
  payload?: TArgs
) {
  if (!API_DEBUG) {
    return {
      done: (_result?: TResult, _error?: unknown) => {}
    };
  }
  const label = `[API] ${name}`;
  console.groupCollapsed(label);
  if (payload !== undefined) console.log("payload:", payload);
  console.time(label);
  return {
    done: (result?: TResult, error?: unknown) => {
      if (error) {
        console.error("error:", error);
      } else if (result !== undefined) {
        console.log("result:", result);
      }
      console.timeEnd(label);
      console.groupEnd();
    },
  };
}

// Узкое безопасное API. Всё остальное в рендерере недоступно.
contextBridge.exposeInMainWorld("api", {
  // Диалог открытия .pcd
  openPCD: async (): Promise<string | null> => {
    const log = logWrap("dialog:openPCD");
    try {
      const res = await ipcRenderer.invoke("dialog:openPCD");
      log.done(res);
      return res as string | null;
    } catch (e) {
      log.done(undefined, e);
      throw e;
    }
  },

  // Debug stream from main-process axios interceptors
  onApiDebugLog: (cb: (entry: unknown) => void) => {
    const handler = (_: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on("debug:api-log", handler);
    return () => ipcRenderer.removeListener("debug:api-log", handler);
  },

  // Диалог сохранения файла
  saveFile: (opts: {
    suggestedName?: string;
    data: ArrayBuffer | Uint8Array | string;
  }): Promise<string | null> => {
    const log = logWrap("dialog:saveFile", opts);
    return ipcRenderer
      .invoke("dialog:saveFile", opts)
      .then((res) => {
        log.done(res);
        return res as string | null;
      })
      .catch((e) => {
        log.done(undefined, e);
        throw e;
      });
  },

  // Системные пути
  getPaths: (): Promise<{
    temp: string;
    userData: string;
    documents: string;
    downloads: string;
  }> => {
    const log = logWrap("app:getPaths");
    return ipcRenderer
      .invoke("app:getPaths")
      .then((res) => {
        log.done(res);
        return res as {
          temp: string;
          userData: string;
          documents: string;
          downloads: string;
        };
      })
      .catch((e) => {
        log.done(undefined, e);
        throw e;
      });
  },

  // Скачивание больших файлов (через main, с прогрессом)
  // Вернёт путь к временному файлу
  downloadTemp: (url: string, filename?: string): Promise<string> => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const log = logWrap("net:downloadTemp", { id, url, filename });
    return ipcRenderer
      .invoke("net:downloadTemp", { id, url, filename })
      .then((res) => {
        log.done(res);
        return res as string;
      })
      .catch((e) => {
        log.done(undefined, e);
        throw e;
      });
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

  // Подписка на прогресс загрузки (upload)
  onUploadProgress: (
    cb: (p: { id: string; uploaded: number; total: number; percent: number | null }) => void
  ) => {
    const handler = (_: unknown, payload: { id: string; uploaded: number; total: number; percent: number | null }) =>
      cb(payload);
    ipcRenderer.on("upload:progress", handler);
    return () => ipcRenderer.removeListener("upload:progress", handler);
  },

  // Событие из меню "File/Open PCD…"
  onMenuOpenPCD: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("menu:openPCD", handler);
    return () => ipcRenderer.removeListener("menu:openPCD", handler);
  },

  readFile: (path: string): Promise<Uint8Array> => {
    const log = logWrap("fs:readFile", { path });
    return ipcRenderer
      .invoke("fs:readFile", { path })
      .then((res) => {
        log.done({ byteLength: (res as Uint8Array)?.byteLength ?? 0 } as unknown as Uint8Array);
        return res as Uint8Array;
      })
      .catch((e) => {
        log.done(undefined, e);
        throw e;
      });
  },

  // Backend API
  backendHealth: async (): Promise<unknown> => {
    const log = logWrap("backend:health");
    try {
      const res = await ipcRenderer.invoke("backend:health");
      log.done(res);
      return res;
    } catch (e) {
      log.done(undefined, e);
      throw e;
    }
  },
  backendDownloadById: (id: string, filename?: string): Promise<string> => {
    const log = logWrap("backend:downloadById", { id, filename });
    return ipcRenderer
      .invoke("backend:downloadById", { id, filename })
      .then((res) => {
        log.done(res);
        return res as string;
      })
      .catch((e) => {
        log.done(undefined, e);
        throw e;
      });
  },
  backendUploadFile: (filePath: string, objectKey?: string): Promise<unknown> => {
    const log = logWrap("backend:uploadFile", { filePath, objectKey });
    return ipcRenderer
      .invoke("backend:uploadFile", { filePath, objectKey })
      .then((res) => {
        log.done(res);
        return res as unknown;
      })
      .catch((e) => {
        log.done(undefined, e);
        throw e;
      });
  },
  backendProcessDynamic: (filePath: string, suggestedName?: string): Promise<string> => {
    const log = logWrap("backend:processDynamic", { filePath, suggestedName });
    return ipcRenderer
      .invoke("backend:processDynamic", { filePath, suggestedName })
      .then((res) => {
        log.done(res);
        return res as string;
      })
      .catch((e) => {
        log.done(undefined, e);
        throw e;
      });
  },

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
      backendProcessDynamic: (filePath: string, suggestedName?: string) => Promise<string>;
      onApiDebugLog: (cb: (entry: unknown) => void) => () => void;
    };
  }
}
