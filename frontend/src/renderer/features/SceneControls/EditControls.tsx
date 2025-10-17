import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Paper, Stack, Text, Switch, Group, Badge, Divider, Slider } from "@mantine/core";
import { IconEdit, IconTrash, IconEyeOff, IconFocus2, IconArrowBack, IconEye, IconReplace, IconBrush } from "@tabler/icons-react";
import type { RootState } from "../../store";
import { setEditMode, clearSelection, invertSelection, setBrushMode, setBrushRadius } from "../../store/editSlice";

export default function EditControls() {
  const dispatch = useDispatch();
  const { isEditMode, selectedIndices, hiddenIndices, selectionStats, brushMode, brushRadius, canUndo } = useSelector((s: RootState) => s.edit);
  const { filePath, pointCount } = useSelector((s: RootState) => s.ui);

  const selectedCount = selectedIndices.length;
  const hiddenCount = hiddenIndices.length;
  const hasSelection = selectedCount > 0;
  const hasHidden = hiddenCount > 0;
  const hasFile = !!filePath;
  
  const formatNumber = (num: number) => num.toLocaleString('ru-RU');

  const toggleEditMode = (checked: boolean) => {
    dispatch(setEditMode(checked));
  };

  const handleDelete = () => {
    window.dispatchEvent(new CustomEvent("edit-delete-selected"));
  };

  const handleHide = () => {
    window.dispatchEvent(new CustomEvent("edit-hide-selected"));
  };

  const handleIsolate = () => {
    window.dispatchEvent(new CustomEvent("edit-isolate-selected"));
  };

  const handleUndo = () => {
    window.dispatchEvent(new CustomEvent("edit-undo"));
  };

  const handleClearSelection = () => {
    dispatch(clearSelection());
  };

  const handleShowAll = () => {
    window.dispatchEvent(new CustomEvent("edit-show-all"));
  };

  const handleInvertSelection = () => {
    dispatch(invertSelection(pointCount));
  };

  const handleToggleBrush = () => {
    dispatch(setBrushMode(!brushMode));
  };

  const handleBrushRadiusChange = (value: number) => {
    dispatch(setBrushRadius(value));
  };

  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={500}>Редактирование</Text>
          <Switch
            checked={isEditMode}
            onChange={(e) => toggleEditMode(e.currentTarget.checked)}
            disabled={!hasFile}
            label=""
            size="sm"
          />
        </Group>

        {!hasFile && (
          <Text size="xs" c="dimmed" ta="center">
            Откройте файл для редактирования
          </Text>
        )}

        {isEditMode && hasFile && (
          <>
            <Stack gap="xs">
              <Badge
                variant="light"
                size="sm"
                fullWidth
                color="blue"
              >
                Всего точек: {formatNumber(pointCount)}
              </Badge>
              <Badge
                variant="light"
                size="lg"
                fullWidth
                color={hasSelection ? "cyan" : "gray"}
              >
                Выбрано: {formatNumber(selectedCount)} {selectedCount === 1 ? "точка" : selectedCount < 5 ? "точки" : "точек"}
              </Badge>
              {hasHidden && (
                <Badge
                  variant="light"
                  size="sm"
                  fullWidth
                  color="orange"
                >
                  Скрыто: {formatNumber(hiddenCount)} {hiddenCount === 1 ? "точка" : hiddenCount < 5 ? "точки" : "точек"}
                </Badge>
              )}
            </Stack>

            {selectionStats && (
              <>
                <Divider label="Статистика выделения" labelPosition="center" />
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    📏 Размеры: {selectionStats.bbox.sizeX.toFixed(2)} × {selectionStats.bbox.sizeY.toFixed(2)} × {selectionStats.bbox.sizeZ.toFixed(2)} м
                  </Text>
                  <Text size="xs" c="dimmed">
                    📈 Высота: {selectionStats.heightRange.min.toFixed(2)} — {selectionStats.heightRange.max.toFixed(2)} м
                  </Text>
                </Stack>
              </>
            )}

            <Divider label="Режим выделения" labelPosition="center" />
            
            <Button
              onClick={handleToggleBrush}
              size="sm"
              variant={brushMode ? "filled" : "light"}
              color={brushMode ? "teal" : "gray"}
              leftSection={<IconBrush size={16} />}
              fullWidth
            >
              {brushMode ? `🖌️ Кисть (${(brushRadius * 100).toFixed(0)} см)` : "Кисть (B)"}
            </Button>

            {brushMode ? (
              <>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="xs" fw={500}>Размер кисти</Text>
                    <Text size="xs" c="dimmed">{(brushRadius * 100).toFixed(0)} см</Text>
                  </Group>
                  <Slider
                    value={brushRadius}
                    onChange={handleBrushRadiusChange}
                    min={0.01}
                    max={1.0}
                    step={0.01}
                    marks={[
                      { value: 0.01, label: '1см' },
                      { value: 0.25, label: '25см' },
                      { value: 0.5, label: '50см' },
                      { value: 0.75, label: '75см' },
                      { value: 1.0, label: '100см' },
                    ]}
                    color="teal"
                  />
                </Stack>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    🖱️ Клик/Drag для выделения
                  </Text>
                  <Text size="xs" c="dimmed">
                    🎯 Alt + Клик для вычитания
                  </Text>
                  <Divider />
                  <Text size="xs" c="dimmed" fw={500}>
                    Управление размером:
                  </Text>
                  <Text size="xs" c="dimmed">
                    ⌨️ [ ] — быстро (±5 см)
                  </Text>
                  <Text size="xs" c="dimmed">
                    ⌨️ +/- — точно (±2 см)
                  </Text>
                  <Text size="xs" c="dimmed">
                    🎚️ Слайдер — визуально
                  </Text>
                </Stack>
              </>
            ) : (
              <Stack gap={4}>
                <Text size="xs" c="dimmed">
                  💡 Shift + перетащите для выделения
                </Text>
                <Text size="xs" c="dimmed">
                  ➕ Shift + Ctrl + перетащите для добавления
                </Text>
                <Text size="xs" c="dimmed">
                  ➖ Shift + Alt + перетащите для вычитания
                </Text>
                <Text size="xs" c="dimmed">
                  🔒 Ctrl (удерживать) для блокировки камеры
                </Text>
              </Stack>
            )}

            <Stack gap="xs">
              <Button
                onClick={handleDelete}
                disabled={!hasSelection}
                size="sm"
                variant="light"
                color="red"
                leftSection={<IconTrash size={16} />}
                fullWidth
              >
                Удалить выделенное
              </Button>

              <Group grow>
                <Button
                  onClick={handleHide}
                  disabled={!hasSelection}
                  size="sm"
                  variant="light"
                  leftSection={<IconEyeOff size={16} />}
                >
                  Скрыть
                </Button>
                <Button
                  onClick={handleIsolate}
                  disabled={!hasSelection}
                  size="sm"
                  variant="light"
                  leftSection={<IconFocus2 size={16} />}
                >
                  Изолировать
                </Button>
              </Group>

              <Button
                onClick={handleInvertSelection}
                disabled={!hasSelection}
                size="sm"
                variant="light"
                color="violet"
                leftSection={<IconReplace size={16} />}
                fullWidth
              >
                Инвертировать (Ctrl+I)
              </Button>

              {hasSelection && (
                <Button
                  onClick={handleClearSelection}
                  size="xs"
                  variant="subtle"
                  fullWidth
                >
                  Снять выделение
                </Button>
              )}
            </Stack>

            {hasHidden && (
              <Button
                onClick={handleShowAll}
                size="sm"
                variant="light"
                color="green"
                leftSection={<IconEye size={16} />}
                fullWidth
              >
                Показать всё
              </Button>
            )}

            <Text size="xs" fw={500} mt="xs">История</Text>
            <Button
              onClick={handleUndo}
              disabled={!canUndo}
              size="sm"
              variant="light"
              leftSection={<IconArrowBack size={16} />}
              fullWidth
            >
              Отменить (Ctrl+Z)
            </Button>
          </>
        )}
      </Stack>
    </Paper>
  );
}


