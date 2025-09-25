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
      onMenuOpenPCD: (cb: () => void) => () => void;
      readFile: (path: string) => Promise<Uint8Array>;
    };
  }
}
