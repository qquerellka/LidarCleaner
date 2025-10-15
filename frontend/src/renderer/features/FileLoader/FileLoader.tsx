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
  // processPct removed — using a simple phantom loader (animated dots)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);
  const [processDots, setProcessDots] = useState<string>("");
  const uploadIdRef = useRef<string | null>(null);
  const unsubUploadRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    // Подписка на прогресс один раз
    unsubUploadRef.current = window.api.onUploadProgress((p) => {
      if (uploadIdRef.current && p.id === uploadIdRef.current) {
        setUploadPct(p.percent);
      }
    });
    // Подписка на прогресс обработки (включая taskId) — но мы показываем просто phantom loader,
    // поэтому здесь мы лишь фильтруем события, не показывая точный процент.
    const unsubProc = window.api.onProcessProgress((p) => {
      if (currentTaskIdRef.current && p.taskId !== currentTaskIdRef.current) return;
      // no-op for numeric UI progress — phantom loader will be shown while busy
    });

    const unsubDone = window.api.onProcessDone((payload) => {
      if (!currentTaskIdRef.current || payload.taskId !== currentTaskIdRef.current) return;
      // end phantom loader and open result
      setBusy(false);
      setCurrentTaskId(null);
      currentTaskIdRef.current = null;
      dispatch(setFilePath(payload.path));
    });

    const unsubErr = window.api.onProcessError((payload) => {
      if (!currentTaskIdRef.current || payload.taskId !== currentTaskIdRef.current) return;
      setBusy(false);
      setCurrentTaskId(null);
      currentTaskIdRef.current = null;
        alert(`Processing error: ${payload.error}`);
    });

    return () => {
      unsubUploadRef.current?.();
      unsubProc?.();
      unsubDone?.();
      unsubErr?.();
    };
  }, []);

  // simple dots animation while processing (phantom loader)
  useEffect(() => {
    let handle: number | null = null;
    if (busy && currentTaskId) {
      handle = window.setInterval(() => {
        setProcessDots((d) => (d.length >= 3 ? "" : d + "."));
      }, 500);
    } else {
      setProcessDots("");
    }
    return () => {
      if (handle) window.clearInterval(handle);
    };
  }, [busy, currentTaskId]);

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
      // отправляем текущий файл на /files/download и получаем taskId
      const taskId = await window.api.backendProcessDynamic(filePath);
      setCurrentTaskId(taskId);
      currentTaskIdRef.current = taskId;
      // start processing progress as indeterminate until we receive percent
        setProcessDots("");
    } catch {
      alert("Не удалось обработать файл. Проверь соединение с бэкендом и логи.");
    } finally {
      // busy остаётся true до события done/error или отмены
    }
  };

  // cancel removed: backend cancel not implemented reliably yet

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
      {/* Если uploadPct === null, это может означать indeterminate processing */}
      {uploadPct === null && busy && (
        <div style={{ minWidth: 160 }} title="Processing">
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 2 }}>Processing{processDots}</div>
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
