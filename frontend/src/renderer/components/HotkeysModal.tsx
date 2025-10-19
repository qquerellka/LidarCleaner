import React from "react";
import { Modal, Stack, Text, Group, Badge, Divider, Grid, Paper } from "@mantine/core";
import { IconKeyboard } from "@tabler/icons-react";

interface HotkeyItem {
  keys: string;
  description: string;
}

interface HotkeyCategory {
  title: string;
  icon?: string;
  hotkeys: HotkeyItem[];
}

interface HotkeysModalProps {
  opened: boolean;
  onClose: () => void;
}

const HOTKEYS: HotkeyCategory[] = [
  {
    title: "Камера",
    icon: "🎥",
    hotkeys: [
      { keys: "R", description: "Сброс камеры" },
      { keys: "F", description: "Вписать в экран" },
      { keys: "Alt + F", description: "Вписать к курсору" },
      { keys: "H", description: "Домашний вид" },
      { keys: "T", description: "Fly Mode (WASD + QE)" },
      { keys: "O", description: "Авто-вращение" },
      { keys: "Double Click", description: "Фокус на точке" },
      { keys: "Shift + Double Click", description: "Аддитивный фокус" },
      { keys: "Ctrl + Click", description: "Установить таргет" },
    ],
  },
  {
    title: "Пресеты камеры",
    icon: "📸",
    hotkeys: [
      { keys: "Alt + 1-5", description: "Загрузить пресет" },
      { keys: "Ctrl + Alt + 1-5", description: "Сохранить пресет" },
    ],
  },
  {
    title: "Редактирование",
    icon: "✏️",
    hotkeys: [
      { keys: "Ctrl + Shift + Drag", description: "Выделить прямоугольник (добавить к существующему)" },
      { keys: "Alt + Ctrl + Shift + Drag", description: "Вычесть из выделения" },
      { keys: "Ctrl (hold)", description: "Блокировка камеры" },
      { keys: "Esc", description: "Снять выделение" },
      { keys: "Del / Backspace", description: "Удалить выделенное" },
      { keys: "Ctrl + Z", description: "Отменить удаление" },
      { keys: "Ctrl + I", description: "Инвертировать выделение" },
    ],
  },
  {
    title: "Режим кисти",
    icon: "🖌️",
    hotkeys: [
      { keys: "B", description: "Включить/выключить кисть" },
      { keys: "Click / Drag", description: "Выделить кистью" },
      { keys: "Alt + Click", description: "Вычесть кистью" },
      { keys: "[ ]", description: "Размер кисти ±5 см" },
      { keys: "+ -", description: "Размер кисти ±2 см" },
    ],
  },
  {
    title: "Элементы сцены",
    icon: "🔧",
    hotkeys: [
      { keys: "G", description: "Показать/скрыть сетку" },
      { keys: "X", description: "Показать/скрыть оси" },
      { keys: "Alt + Wheel", description: "Размер точек" },
    ],
  },
  {
    title: "Общее",
    icon: "⚙️",
    hotkeys: [
      { keys: "?", description: "Показать это окно" },
      { keys: "Ctrl + S", description: "Сохранить (экспорт)" },
    ],
  },
];

const HotkeysModal = React.memo(({ opened, onClose }: HotkeysModalProps) => {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconKeyboard size={24} />
          <Text size="lg" fw={600}>Горячие клавиши</Text>
        </Group>
      }
      size="xl"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Используйте эти комбинации клавиш для быстрой работы с приложением
        </Text>
        
        <Divider />

        <Grid gutter="md">
          {HOTKEYS.map((category, idx) => (
            <Grid.Col key={idx} span={{ base: 12, md: 6 }}>
              <Paper p="md" withBorder>
                <Stack gap="sm">
                  <Group gap="xs">
                    <Text size="xs">{category.icon}</Text>
                    <Text size="sm" fw={600}>{category.title}</Text>
                  </Group>
                  
                  <Stack gap={6}>
                    {category.hotkeys.map((hotkey, hIdx) => (
                      <Group key={hIdx} justify="space-between" wrap="nowrap">
                        <Text size="xs" c="dimmed" style={{ flex: 1 }}>
                          {hotkey.description}
                        </Text>
                        <Badge 
                          variant="light" 
                          size="sm"
                          style={{ 
                            fontFamily: 'monospace',
                            flexShrink: 0,
                          }}
                        >
                          {hotkey.keys}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                </Stack>
              </Paper>
            </Grid.Col>
          ))}
        </Grid>

        <Divider />
        
        <Text size="xs" c="dimmed" ta="center">
          💡 Нажмите <Badge size="xs" variant="light">?</Badge> в любое время чтобы открыть это окно
        </Text>
      </Stack>
    </Modal>
  );
});

HotkeysModal.displayName = 'HotkeysModal';

export default HotkeysModal;

