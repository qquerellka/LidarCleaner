// src/main/paths.ts
import { app } from "electron";

export function getDefaultPaths() {
  return {
    temp: app.getPath("temp"),
    userData: app.getPath("userData"),
    documents: app.getPath("documents"),
    downloads: app.getPath("downloads"),
  };
}
