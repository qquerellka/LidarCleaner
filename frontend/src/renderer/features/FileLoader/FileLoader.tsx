// src/renderer/features/FileLoader.tsx
import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../store";
import { setFilePath } from "../../store/uiSlice";

export default function FileLoader() {
  const dispatch = useDispatch();
  const filePath = useSelector((s: RootState) => s.ui.filePath);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const uploadIdRef = useRef<string | null>(null);
  const unsubUploadRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    // Подписка на прогресс один раз
    unsubUploadRef.current = window.api.onUploadProgress((p) => {
      if (uploadIdRef.current && p.id === uploadIdRef.current) {
        setUploadPct(p.percent);
      }
    });
    return () => {
      unsubUploadRef.current?.();
    };
  }, []);

  const handleOpen = async () => {
    const path = await window.api.openPCD();
    if (path) {
      dispatch(setFilePath(path));
      // Отправим на бэкенд и покажем прогресс
      try {
        setUploadPct(0);
        const { id } = await window.api.backendUploadFile(path);
        uploadIdRef.current = id;
      } catch (e) {
        console.error("Upload failed", e);
        setUploadPct(null);
      }
    }
  };

  const handleAutoClean = async () => {
    if (!filePath) return;
    setBusy(true);
    try {
      // отправляем текущий файл на /files/download и получаем путь к результату
      const newPath = await window.api.backendProcessDynamic(filePath);
      // сразу открываем обработанный файл во вьювере
      dispatch(setFilePath(newPath));
    } catch {
      alert("Не удалось обработать файл. Проверь соединение с бэкендом и логи.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button onClick={handleOpen}>Открыть PCD/PLY</button>
      {uploadPct !== null && (
        <div style={{ minWidth: 160 }} title="Загрузка файла на бэкенд">
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 2 }}>Upload</div>
          <div style={{ height: 6, background: "#333", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.round((uploadPct ?? 0) * 100)}%`,
                height: "100%",
                background: "#4caf50",
                transition: "width 160ms linear",
              }}
            />
          </div>
        </div>
      )}

      {/* Кнопка авто-очистки показывается только когда файл открыт */}
      {filePath && (
        <button onClick={handleAutoClean} disabled={busy} title="Удалить динамические объекты и открыть результат">
          {busy ? "Обработка…" : "Удалить динамические объекты"}
        </button>
      )}
    </div>
  );
}
