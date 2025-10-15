// renderer.d.ts
export {};

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
  onProcessProgress: (cb: (p: { taskId: string; received: number; total: number | null; percent: number | null }) => void) => () => void;
      onUploadProgress: (
        cb: (p: { id: string; uploaded: number; total: number; percent: number | null }) => void
      ) => () => void;
      onMenuOpenPCD: (cb: () => void) => () => void;
      readFile: (path: string) => Promise<Uint8Array>;
       backendHealth: () => Promise<unknown>;
      backendDownloadById: (id: string, filename?: string) => Promise<string>;
  backendUploadFile: (filePath: string, objectKey?: string) => Promise<{ ok: boolean; id: string }>;
  backendProcessDynamic: (filePath: string, suggestedName?: string) => Promise<string>;
  backendCancelProcess: (taskId: string) => Promise<{ ok: boolean; message?: string }>;
  onProcessDone: (cb: (p: { taskId: string; path: string }) => void) => () => void;
  onProcessError: (cb: (p: { taskId: string; error: string }) => void) => () => void;
      onApiDebugLog: (cb: (entry: unknown) => void) => () => void;

    };
  }
}
