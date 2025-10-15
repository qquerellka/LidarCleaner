// src/renderer/features/SceneControls/AutoCleanButton.tsx
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../store";
import { setFilePath } from "../../store/uiSlice";

export default function AutoCleanButton() {
  const filePath = useSelector((s: RootState) => s.ui.filePath);
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);
  const canRun = !!filePath && !busy;

  const onClick = async () => {
    if (!filePath) return;
    setBusy(true);
    try {
      const newPath = await window.api.backendProcessDynamic(filePath);
      dispatch(setFilePath(newPath)); // сразу открываем новый файл
    } catch (e) {
      console.error(e);
      alert("Не удалось обработать файл. Проверь соединение с бэкендом и логи.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
      <button onClick={onClick} disabled={!canRun} title="Удалить динамические объекты и открыть результат">
        {busy ? "Обработка…" : "Удалить динамические объекты"}
      </button>
      {!filePath && <small style={{ opacity: 0.7 }}>Сначала открой файл</small>}
    </div>
  );
}
