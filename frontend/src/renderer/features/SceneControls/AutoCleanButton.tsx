// src/renderer/features/SceneControls/AutoCleanButton.tsx
import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Text, Paper, Stack, Progress, Group } from "@mantine/core";
import { IconSparkles, IconAlertCircle, IconX } from "@tabler/icons-react";
import type { RootState } from "../../store";
import { setFilePath, setAutoProcessing } from "../../store/uiSlice";
import { setEditMode } from "../../store/editSlice";
import {
  showErrorWithDetails,
  showSuccessNotification,
  showWarningNotification,
} from "../../utils/notifications";

// Умный фейковый прогресс
const FAKE_TOTAL_DURATION = 15 * 60 * 1000; // 15 минут в миллисекундах
const FAKE_PROGRESS_STAGES = [
  { target: 5, duration: 0.02 },   // 2% времени (18 сек) → 5% - быстрая инициализация
  { target: 40, duration: 0.33 },  // 33% времени (5 мин) → 40% - основная обработка
  { target: 75, duration: 0.40 },  // 40% времени (6 мин) → 75% - основная обработка
  { target: 95, duration: 0.25 },  // 25% времени (3.75 мин) → 95% - финализация (застревает здесь)
];

export default function AutoCleanButton() {
  const filePath = useSelector((s: RootState) => s.ui.filePath);
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);
  
  // Фейковый прогресс
  const [fakeProgress, setFakeProgress] = useState<number>(0);
  const [hasRealProgress, setHasRealProgress] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0); // в минутах
  const fakeProgressStartRef = useRef<number>(0);
  const fakeProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const canRun = !!filePath && !busy;

  // Функция для расчета фейкового прогресса
  const calculateFakeProgress = (elapsed: number): number => {
    let accumulatedTime = 0;
    let prevProgress = 0;

    for (const stage of FAKE_PROGRESS_STAGES) {
      const stageTime = stage.duration * FAKE_TOTAL_DURATION;
      
      if (elapsed < accumulatedTime + stageTime) {
        // Находимся в этом этапе
        const stageElapsed = elapsed - accumulatedTime;
        const stagePercent = stageElapsed / stageTime;
        const progressDelta = stage.target - prevProgress;
        return prevProgress + progressDelta * stagePercent;
      }
      
      accumulatedTime += stageTime;
      prevProgress = stage.target;
    }

    // После всех этапов - остаемся на 95%
    return 95;
  };

  // Фейковый прогресс-бар
  useEffect(() => {
    if (busy && !hasRealProgress) {
      fakeProgressStartRef.current = Date.now();
      
      fakeProgressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - fakeProgressStartRef.current;
        const elapsedMinutes = Math.floor(elapsed / 60000);
        const newProgress = calculateFakeProgress(elapsed);
        
        setFakeProgress(newProgress);
        setTimeElapsed(elapsedMinutes);
      }, 500); // Обновляем каждые 500мс
      
      return () => {
        if (fakeProgressIntervalRef.current) {
          clearInterval(fakeProgressIntervalRef.current);
          fakeProgressIntervalRef.current = null;
        }
      };
    } else {
      // Сброс когда обработка завершена
      if (!busy) {
        setFakeProgress(0);
        setHasRealProgress(false);
        setTimeElapsed(0);
      }
    }
  }, [busy, hasRealProgress]);

  useEffect(() => {
    // Подписка на прогресс обработки
    const unsubProgress = window.api.onProcessProgress((p) => {
      if (currentTaskIdRef.current && p.taskId === currentTaskIdRef.current) {
        setHasRealProgress(true); // Переключаемся на реальный прогресс
        setProgress(p.percent);
      }
    });

    // Подписка на завершение обработки
    const unsubDone = window.api.onProcessDone((payload) => {
      if (!currentTaskIdRef.current || payload.taskId !== currentTaskIdRef.current) return;
      
      // Сначала показываем 100%
      setHasRealProgress(true);
      setProgress(100);
      
      // Затем через небольшую задержку завершаем
      setTimeout(() => {
        // Показываем уведомление о завершении
        showSuccessNotification('Файл успешно обработан и готов к использованию', 'Обработка завершена');
        
        setBusy(false);
        setProgress(null);
        setCurrentTaskId(null);
        currentTaskIdRef.current = null;
        dispatch(setAutoProcessing(false));
        dispatch(setFilePath(payload.path));
      }, 500);
    });

    // Подписка на ошибки обработки
    const unsubError = window.api.onProcessError((payload) => {
      if (!currentTaskIdRef.current || payload.taskId !== currentTaskIdRef.current) return;
      
      showErrorWithDetails(payload.error, 'Ошибка обработки файла');
      setBusy(false);
      setProgress(null);
      setCurrentTaskId(null);
      currentTaskIdRef.current = null;
      dispatch(setAutoProcessing(false));
    });

    return () => {
      unsubProgress?.();
      unsubDone?.();
      unsubError?.();
    };
  }, [dispatch]);

  const onClick = async () => {
    if (!filePath) return;
    
    // Отключаем режим редактирования перед началом автообработки
    dispatch(setEditMode(false));
    
    setBusy(true);
    setProgress(null);
    setFakeProgress(0);
    setHasRealProgress(false);
    setTimeElapsed(0);
    dispatch(setAutoProcessing(true));
    
    try {
      // Получаем taskId и ждем события process-done
      const taskId = await window.api.backendProcessDynamic(filePath);
      setCurrentTaskId(taskId);
      currentTaskIdRef.current = taskId;
    } catch (e) {
      showErrorWithDetails(e, 'Не удалось обработать файл');
      setBusy(false);
      setProgress(null);
      setFakeProgress(0);
      setHasRealProgress(false);
      dispatch(setAutoProcessing(false));
    }
  };

  const onCancel = async () => {
    if (!currentTaskId) return;
    
    try {
      const result = await window.api.backendCancelProcess(currentTaskId);
      if (result.ok) {
        showWarningNotification('Обработка отменена', 'Отмена');
        setBusy(false);
        setProgress(null);
        setCurrentTaskId(null);
        currentTaskIdRef.current = null;
        setFakeProgress(0);
        setHasRealProgress(false);
        dispatch(setAutoProcessing(false));
      } else {
        showErrorWithDetails(result.message || 'Не удалось отменить', 'Ошибка отмены');
      }
    } catch (e) {
      showErrorWithDetails(e, 'Не удалось отменить обработку');
    }
  };

  // Функция форматирования времени
  const formatTime = (minutes: number) => {
    if (minutes < 1) return "< 1 мин";
    if (minutes === 1) return "1 мин";
    return `${minutes} мин`;
  };

  // Определяем какой прогресс показывать
  const displayProgress = hasRealProgress && progress !== null ? progress : fakeProgress;
  const isStuck = !hasRealProgress && displayProgress >= 94.5; // Считаем "застрявшим" если >= 95%

  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        {!busy ? (
          <Button
            onClick={onClick}
            disabled={!canRun}
            leftSection={<IconSparkles size={18} />}
            fullWidth
            size="md"
            variant="gradient"
            gradient={{ from: "cyan", to: "blue", deg: 90 }}
          >
            Удалить динамику
          </Button>
        ) : (
          <Group gap="xs">
            <Button
              disabled
              loading
              leftSection={<IconSparkles size={18} />}
              size="md"
              variant="gradient"
              gradient={{ from: "cyan", to: "blue", deg: 90 }}
              style={{ flex: 1 }}
            >
              Обработка...
            </Button>
            <Button
              onClick={onCancel}
              size="md"
              color="red"
              variant="light"
              leftSection={<IconX size={18} />}
            >
              Отмена
            </Button>
          </Group>
        )}
        
        {busy && (
          <Stack gap={4}>
            <Progress 
              value={displayProgress} 
              color={
                displayProgress < 50 ? "blue" : 
                displayProgress < 80 ? "cyan" : 
                isStuck ? "yellow" : 
                "green"
              }
              size="lg"
              radius="sm"
              striped={displayProgress < 100}
              animated={displayProgress < 100}
            />
            
            <Stack gap={2}>
              <Text size="xs" c="dimmed" ta="center">
                {Math.round(displayProgress)}% • Прошло: {formatTime(timeElapsed)}
              </Text>
              
              {isStuck && (
                <Text size="xs" c="yellow" ta="center" fs="italic">
                  ⏳ Обработка больших файлов может занять время...
                </Text>
              )}
              
              {!isStuck && displayProgress < 95 && (
                <Text size="xs" c="dimmed" ta="center">
                  ~{formatTime(15 - timeElapsed)} осталось
                </Text>
              )}
            </Stack>
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
