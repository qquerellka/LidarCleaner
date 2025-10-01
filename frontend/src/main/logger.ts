// src/main/logger.ts
import log from "electron-log";

export function initLogger() {
  process.on("uncaughtException", (err) => {
    log.error("[uncaughtException]", err);
  });
  process.on("unhandledRejection", (reason) => {
    log.error("[unhandledRejection]", reason);
  });
  return log;
}
