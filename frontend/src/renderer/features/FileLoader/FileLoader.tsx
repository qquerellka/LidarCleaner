// src/renderer/features/FileLoader.tsx
import React from "react";
import { useDispatch } from "react-redux";
import { Button, Stack } from "@mantine/core";
import { IconFolderOpen } from "@tabler/icons-react";
import { setFilePath } from "../../store/uiSlice";
import { showErrorWithDetails, showSuccessNotification } from "../../utils/notifications";

export default function FileLoader() {
  const dispatch = useDispatch();

  const handleOpen = async () => {
    try {
      const path = await window.api.openPCD();
      if (path) {
        dispatch(setFilePath(path));
        showSuccessNotification(`Файл загружен: ${path.split('/').pop()}`);
      }
    } catch (error) {
      showErrorWithDetails(error, 'Не удалось открыть файл');
    }
  };

  return (
    <Stack gap="sm">
      <Button
        onClick={handleOpen}
        leftSection={<IconFolderOpen size={18} />}
        variant="filled"
        fullWidth
      >
        Открыть PCD/PLY
      </Button>
    </Stack>
  );
}
