// renderer.d.ts
export {};

// ============ IPC API Types ============

export interface AppPaths {
  temp: string;
  userData: string;
  documents: string;
  downloads: string;
}

export interface SaveFileOptions {
  suggestedName?: string;
  data: ArrayBuffer | Uint8Array | string;
}

export interface DownloadProgress {
  id: string;
  received: number;
  total: number;
  percent: number | null;
}

export interface ProcessProgress {
  taskId: string;
  received: number;
  total: number | null;
  percent: number | null;
}

export interface UploadProgress {
  id: string;
  uploaded: number;
  total: number;
  percent: number | null;
}

export interface BackendUploadResult {
  ok: boolean;
  id: string;
}

export interface BackendCancelResult {
  ok: boolean;
  message?: string;
}

export interface ProcessDone {
  taskId: string;
  path: string;
}

export interface ProcessError {
  taskId: string;
  error: string;
}

export interface BackendHealthResponse {
  status: 'ok' | 'error';
  version?: string;
  uptime?: number;
}

// ============ Global Window API ============

declare global {
  interface Window {
    api: {
      // File operations
      openPCD: () => Promise<string | null>;
      readFile: (path: string) => Promise<Uint8Array>;
      saveFile: (opts: SaveFileOptions) => Promise<string | null>;
      
      // Path utilities
      getPaths: () => Promise<AppPaths>;
      
      // Download
      downloadTemp: (url: string, filename?: string) => Promise<string>;
      onDownloadProgress: (cb: (progress: DownloadProgress) => void) => () => void;
      
      // Backend operations
      backendHealth: () => Promise<BackendHealthResponse>;
      backendDownloadById: (id: string, filename?: string) => Promise<string>;
      backendUploadFile: (filePath: string, objectKey?: string) => Promise<BackendUploadResult>;
      backendProcessDynamic: (filePath: string, suggestedName?: string) => Promise<string>;
      backendCancelProcess: (taskId: string) => Promise<BackendCancelResult>;
      
      // Event listeners
      onProcessProgress: (cb: (progress: ProcessProgress) => void) => () => void;
      onUploadProgress: (cb: (progress: UploadProgress) => void) => () => void;
      onProcessDone: (cb: (result: ProcessDone) => void) => () => void;
      onProcessError: (cb: (error: ProcessError) => void) => () => void;
      onMenuOpenPCD: (cb: () => void) => () => void;
      onApiDebugLog: (cb: (entry: unknown) => void) => () => void;
    };
  }
}
