// src/renderer/features/SceneControls/AutoCleanButton.tsx
import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Text, Paper, Stack, Progress } from "@mantine/core";
import { IconSparkles, IconAlertCircle } from "@tabler/icons-react";
import type { RootState } from "../../store";
import { setFilePath } from "../../store/uiSlice";
import {
  showErrorWithDetails,
  showSuccessNotification,
  showLoadingNotification,
  updateLoadingToSuccess,
  updateLoadingToError,
} from "../../utils/notifications";

export default function AutoCleanButton() {
  const filePath = useSelector((s: RootState) => s.ui.filePath);
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);
  const canRun = !!filePath && !busy;

  useEffect(() => {
    // Подписка на прогресс обработки
    const unsubProgress = window.api.onProcessProgress((p) => {
      if (currentTaskIdRef.current && p.taskId === currentTaskIdRef.current) {
        setProgress(p.percent);
      }
    });

    // Подписка на завершение обработки
    const unsubDone = window.api.onProcessDone((payload) => {
      if (!currentTaskIdRef.current || payload.taskId !== currentTaskIdRef.current) return;
      
      // Обработка завершена - открываем новый файл
      updateLoadingToSuccess('auto-clean', 'Облако точек успешно очищено');
      setBusy(false);
      setProgress(null);
      setCurrentTaskId(null);
      currentTaskIdRef.current = null;
      dispatch(setFilePath(payload.path));
    });

    // Подписка на ошибки обработки
    const unsubError = window.api.onProcessError((payload) => {
      if (!currentTaskIdRef.current || payload.taskId !== currentTaskIdRef.current) return;
      
      updateLoadingToError('auto-clean', payload.error);
      setBusy(false);
      setProgress(null);
      setCurrentTaskId(null);
      currentTaskIdRef.current = null;
    });

    return () => {
      unsubProgress?.();
      unsubDone?.();
      unsubError?.();
    };
  }, [dispatch]);

  const onClick = async () => {
    if (!filePath) return;
    setBusy(true);
    setProgress(null);
    
    try {
      showLoadingNotification('Отправка файла на обработку...', 'auto-clean');
      // Получаем taskId и ждем события process-done
      const taskId = await window.api.backendProcessDynamic(filePath);
      setCurrentTaskId(taskId);
      currentTaskIdRef.current = taskId;
    } catch (e) {
      showErrorWithDetails(e, 'Не удалось обработать файл');
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Button
          onClick={onClick}
          disabled={!canRun}
          loading={busy}
          leftSection={<IconSparkles size={18} />}
          fullWidth
          size="md"
          variant="gradient"
          gradient={{ from: "cyan", to: "blue", deg: 90 }}
        >
          {busy ? "Обработка..." : "Удалить динамику"}
        </Button>
        
        {busy && progress !== null && (
          <Stack gap={4}>
            <Text size="xs" c="dimmed" ta="center">
              Прогресс: {Math.round(progress)}%
            </Text>
            <Progress value={progress} color="cyan" size="sm" striped animated />
          </Stack>
        )}
        
        {busy && progress === null && (
          <Stack gap={4}>
            <Text size="xs" c="dimmed" ta="center">
              Обработка на сервере...
            </Text>
            <Progress value={100} color="cyan" size="sm" striped animated />
          </Stack>
        )}
        
        {!filePath && (
          <Text size="xs" c="dimmed" ta="center">
            <IconAlertCircle size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Сначала откройте файл
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
