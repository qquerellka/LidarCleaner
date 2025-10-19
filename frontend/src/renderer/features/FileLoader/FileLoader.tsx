// src/renderer/features/FileLoader.tsx
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Stack, Paper, Text, Group, ActionIcon, Divider, Collapse } from "@mantine/core";
import { IconFolderOpen, IconUpload, IconClock, IconX, IconTrash, IconChevronDown } from "@tabler/icons-react";
import { setFilePath, removeRecentFile } from "../../store/uiSlice";
import { showErrorWithDetails, showSuccessNotification } from "../../utils/notifications";
import type { RootState } from "../../store";

export default function FileLoader() {
  const dispatch = useDispatch();
  const recentFiles = useSelector((s: RootState) => s.ui.recentFiles);
  const [isDragging, setIsDragging] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);

  const handleOpen = async () => {
    try {
      const path = await window.api.openPCD();
      if (path) {
        dispatch(setFilePath(path));
        showSuccessNotification(`Файл выбран: ${path.split('/').pop()}`);
      }
    } catch (error) {
      showErrorWithDetails(error, 'Не удалось открыть файл');
    }
  };

  const validateFile = (filePath: string): boolean => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (ext !== 'pcd' && ext !== 'ply') {
      showErrorWithDetails('Неподдерживаемый формат', 'Поддерживаются только .pcd и .ply файлы');
      return false;
    }
    return true;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    const fileSizeMB = file.size / (1024 * 1024);

    let filePath: string;
    try {
      // Use Electron's webUtils API to get file path (works with sandbox mode)
      filePath = window.api.getPathForFile(file);
    } catch (error) {
      console.error('Failed to get file path:', error);
      showErrorWithDetails('Ошибка', 'Не удалось получить путь к файлу. Убедитесь, что файл находится на локальном диске.');
      return;
    }

    if (!validateFile(filePath)) return;

    // Проверка размера файла
    const MAX_SIZE_MB = 2048; // 2 ГБ
    const WARN_SIZE_MB = 200; // 200 МБ

    if (fileSizeMB > MAX_SIZE_MB) {
      showErrorWithDetails(
        'Файл слишком большой',
        `Размер файла: ${fileSizeMB > 1024 ? (fileSizeMB / 1024).toFixed(2) + ' ГБ' : fileSizeMB.toFixed(1) + ' МБ'}. Максимум: 2 ГБ.\n\nПопробуйте уменьшить количество точек или разделить файл.`
      );
      return;
    }

    if (fileSizeMB > WARN_SIZE_MB) {
      // Показываем предупреждение но разрешаем загрузку
      console.warn(`⚠️ Большой файл: ${fileSizeMB.toFixed(1)} МБ. Загрузка может занять время.`);
    }

    try {
      dispatch(setFilePath(filePath));
      
      const sizeStr = fileSizeMB < 1 
        ? `${(file.size / 1024).toFixed(0)} КБ` 
        : `${fileSizeMB.toFixed(1)} МБ`;
      
      showSuccessNotification(`Файл выбран: ${file.name} (${sizeStr})`);
    } catch (error) {
      showErrorWithDetails(error, 'Не удалось открыть файл');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} д назад`;
    return new Date(timestamp).toLocaleDateString('ru-RU');
  };

  const handleRecentFileClick = (path: string) => {
    dispatch(setFilePath(path));
  };

  const handleRemoveRecent = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    dispatch(removeRecentFile(path));
  };

  return (
    <Stack gap="sm">
      <Button
        onClick={handleOpen}
        leftSection={<IconFolderOpen size={18} />}
        variant="filled"
        fullWidth
      >
        Открыть файл
      </Button>

      <Paper
        p="md"
        withBorder
        style={{
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: isDragging ? '#3b82f6' : '#374151',
          backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Stack gap="xs" align="center">
          <IconUpload 
            size={32} 
            style={{ 
              opacity: 0.5,
              color: isDragging ? '#3b82f6' : undefined,
            }} 
          />
          <Text size="sm" ta="center" c="dimmed">
            или перетащите файл сюда
          </Text>
          <Text size="xs" ta="center" c="dimmed">
            PCD / PLY
          </Text>
        </Stack>
      </Paper>

      {recentFiles.length > 0 && (
        <Paper p="sm" withBorder>
          <Group
            justify="space-between"
            style={{ cursor: 'pointer' }}
            onClick={() => setRecentExpanded(!recentExpanded)}
          >
            <Group gap="xs">
              <IconClock size={16} />
              <Text size="sm" fw={500}>Недавние файлы</Text>
            </Group>
            <IconChevronDown 
              size={16} 
              style={{ 
                transform: recentExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }} 
            />
          </Group>

          <Collapse in={recentExpanded}>
            <Stack gap={4} mt="sm">
              {recentFiles.slice(0, 5).map((file, idx) => (
                <Paper
                  key={file.path}
                  p="xs"
                  withBorder
                  style={{
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onClick={() => handleRecentFileClick(file.path)}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      <Text 
                        size="xs" 
                        fw={500} 
                        truncate
                        title={file.name}
                      >
                        {file.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatTimestamp(file.timestamp)}
                      </Text>
                    </Stack>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={(e) => handleRemoveRecent(e, file.path)}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Collapse>
        </Paper>
      )}
    </Stack>
  );
}
