import React from "react";
import { useDispatch } from "react-redux";
import { setFilePath } from "../../store/uiSlice";

export default function FileLoader() {
  const dispatch = useDispatch();

  const handleOpen = async () => {
    const path = await window.api.openPCD();
    if (path) {
      dispatch(setFilePath(path));
      // Автозагрузка на бэкенд сразу после выбора файла
      try {
        await window.api.backendUploadFile(path);
      } catch (e) {
        // опционально: показать уведомление пользователю
        // console.error(e);
      }
    }
  };

  return (
    <div>
      <button onClick={handleOpen}>Open PCD File</button>
    </div>
  );
}
