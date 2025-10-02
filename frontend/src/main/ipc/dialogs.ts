// src/main/ipc/dialogs.ts
import { dialog, ipcMain } from "electron";
import { join } from "path";
import { promises as fsp } from "fs";
import { getDefaultPaths } from "../paths";

export function registerDialogIpc() {
  // Open PCD/PLY
  ipcMain.handle("dialog:openPCD", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Open Point Cloud",
      properties: ["openFile"],
      filters: [
        { name: "Point Clouds", extensions: ["pcd", "ply"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  // Save file
  ipcMain.handle(
    "dialog:saveFile",
    async (_evt, payload: { suggestedName?: string; data: ArrayBuffer | Uint8Array | string }) => {
      const { suggestedName = "file.pcd", data } = payload || {};
      const ext = suggestedName.toLowerCase().endsWith(".ply")
        ? "ply"
        : suggestedName.toLowerCase().endsWith(".pcd")
        ? "pcd"
        : undefined;
      const filters = ext
        ? [{ name: ext.toUpperCase(), extensions: [ext] }]
        : [
            { name: "Point Clouds", extensions: ["pcd", "ply"] },
            { name: "All Files", extensions: ["*"] },
          ];
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: "Save File",
        defaultPath: join(getDefaultPaths().downloads, suggestedName),
        filters,
      });
      if (canceled || !filePath) return null;

      let buf: Buffer;
      if (data instanceof Uint8Array) {
        buf = Buffer.from(data);
      } else if (typeof data === "string") {
        if (data.startsWith("data:")) {
          // Data URL: decode base64 content part only
          const base64Part = data.split(",")[1] ?? "";
          buf = Buffer.from(base64Part, "base64");
        } else {
          // Plain text (e.g., ASCII PLY) should be saved as UTF-8
          buf = Buffer.from(data, "utf8");
        }
      } else {
        buf = Buffer.from(new Uint8Array(data as ArrayBuffer));
      }

      await fsp.writeFile(filePath, buf);
      return filePath;
    }
  );
}
