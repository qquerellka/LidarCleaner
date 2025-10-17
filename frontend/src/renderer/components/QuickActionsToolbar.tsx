import React from "react";
import { Group, ActionIcon, Paper, Tooltip, Text } from "@mantine/core";
import { IconTrash, IconEyeOff, IconFocus2, IconReplace, IconX } from "@tabler/icons-react";

interface QuickActionsToolbarProps {
  visible: boolean;
  selectedCount: number;
  onDelete: () => void;
  onHide: () => void;
  onIsolate: () => void;
  onInvert: () => void;
  onClear: () => void;
}

export default function QuickActionsToolbar({
  visible,
  selectedCount,
  onDelete,
  onHide,
  onIsolate,
  onInvert,
  onClear,
}: QuickActionsToolbarProps) {
  if (!visible) return null;

  return (
    <Paper
      p="xs"
      shadow="xl"
      radius="md"
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999,
        background: 'rgba(30, 30, 30, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Group gap="xs" align="center">
        <Text size="sm" fw={500} c="dimmed">
          {selectedCount.toLocaleString('ru-RU')} выбрано:
        </Text>
        
        <Tooltip label="Удалить (Del)" position="top">
          <ActionIcon
            onClick={onDelete}
            size="lg"
            variant="light"
            color="red"
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Скрыть (H)" position="top">
          <ActionIcon
            onClick={onHide}
            size="lg"
            variant="light"
            color="orange"
          >
            <IconEyeOff size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Изолировать (I)" position="top">
          <ActionIcon
            onClick={onIsolate}
            size="lg"
            variant="light"
            color="blue"
          >
            <IconFocus2 size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Инвертировать (Ctrl+I)" position="top">
          <ActionIcon
            onClick={onInvert}
            size="lg"
            variant="light"
            color="violet"
          >
            <IconReplace size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Снять выделение (Esc)" position="top">
          <ActionIcon
            onClick={onClear}
            size="lg"
            variant="subtle"
            color="gray"
          >
            <IconX size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Paper>
  );
}

