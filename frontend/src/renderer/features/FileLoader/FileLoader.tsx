// src/renderer/features/FileLoader.tsx
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../store";
import { setFilePath } from "../../store/uiSlice";

export default function FileLoader() {
  const dispatch = useDispatch();
  const filePath = useSelector((s: RootState) => s.ui.filePath);
  const [busy, setBusy] = useState(false);

  const handleOpen = async () => {
    const path = await window.api.openPCD();
    if (path) {
      dispatch(setFilePath(path));
      // опционально: автозагрузка на бэкенд сразу после выбора файла (если нужно)
      try {
        await window.api.backendUploadFile(path);
      } catch {
        // здесь можно показать тост/уведомление
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

      {/* Кнопка авто-очистки показывается только когда файл открыт */}
      {filePath && (
        <button onClick={handleAutoClean} disabled={busy} title="Удалить динамические объекты и открыть результат">
          {busy ? "Обработка…" : "Удалить динамические объекты"}
        </button>
      )}
    </div>
  );
}
