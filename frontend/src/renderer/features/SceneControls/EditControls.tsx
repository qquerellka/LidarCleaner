import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Paper, Stack, Text, Switch, Group, Badge, Divider, Slider, SegmentedControl } from "@mantine/core";
import { IconTrash, IconEyeOff, IconFocus2, IconArrowBack, IconEye, IconReplace, IconBrush, IconBox } from "@tabler/icons-react";
import type { RootState } from "../../store";
import { setEditMode, clearSelection, invertSelection, setBrushMode, setBrushRadius } from "../../store/editSlice";

export default function EditControls() {
  const dispatch = useDispatch();
  const { isEditMode, selectedIndices, hiddenIndices, brushMode, brushRadius, canUndo } = useSelector((s: RootState) => s.edit);
  const { filePath, pointCount, isAutoProcessing } = useSelector((s: RootState) => s.ui);

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
            disabled={!hasFile || isAutoProcessing}
            label=""
            size="sm"
          />
        </Group>

        {!hasFile && (
          <Text size="xs" c="dimmed" ta="center">
            Откройте файл для редактирования
          </Text>
        )}

        {hasFile && isAutoProcessing && (
          <Text size="xs" c="yellow" ta="center">
            Редактирование недоступно во время автообработки
          </Text>
        )}

        {isEditMode && hasFile && !isAutoProcessing && (
          <>
            {/* Компактная статистика */}
            <Group gap={4} grow>
          <Badge variant="light" size="sm" color="blue">
            {formatNumber(pointCount)}
          </Badge>
          <Badge variant="light" size="sm" color={hasSelection ? "cyan" : "gray"}>
            ✓ {formatNumber(selectedCount)}
          </Badge>
          {hasHidden && (
            <Badge variant="light" size="sm" color="orange">
              👁 {formatNumber(hiddenCount)}
            </Badge>
          )}
        </Group>

        {/* РЕЖИМ ВЫДЕЛЕНИЯ - Явный выбор */}
        <Paper withBorder p="xs">
          <Stack gap="xs">
            <Text size="xs" fw={600} c="dimmed" ta="center">РЕЖИМ ВЫДЕЛЕНИЯ</Text>
            <SegmentedControl
              value={brushMode ? "brush" : "box"}
              onChange={(value) => dispatch(setBrushMode(value === "brush"))}
              data={[
                { 
                  value: "box", 
                  label: (
                    <Group gap={4} justify="center">
                      <IconBox size={14} />
                      <Text size="xs">Бокс</Text>
                    </Group>
                  )
                },
                { 
                  value: "brush", 
                  label: (
                    <Group gap={4} justify="center">
                      <IconBrush size={14} />
                      <Text size="xs">Кисть</Text>
                    </Group>
                  )
                },
              ]}
              fullWidth
              color={brushMode ? "teal" : "blue"}
            />
            
            {brushMode ? (
              <>
                <Text size="xs" fw={500}>Размер:</Text>
                <Slider
                  value={brushRadius}
                  onChange={handleBrushRadiusChange}
                  min={0.01}
                  max={1.0}
                  step={0.01}
                  marks={[
                    { value: 0.01, label: '1' },
                    { value: 0.5, label: '50' },
                    { value: 1.0, label: '100' },
                  ]}
                  color="teal"
                  size="sm"
                />
              </>
            ) : (
              <Text size="xs" c="dimmed" ta="center">
                Shift+Drag
              </Text>
            )}
          </Stack>
        </Paper>

        {/* Действия */}
        <Stack gap={4}>
          <Button
            onClick={handleDelete}
            disabled={!hasSelection}
            size="xs"
            variant="light"
            color="red"
            leftSection={<IconTrash size={14} />}
            fullWidth
          >
            Удалить
          </Button>

          <Group grow gap={4}>
            <Button
              onClick={handleHide}
              disabled={!hasSelection}
              size="xs"
              variant="light"
              leftSection={<IconEyeOff size={14} />}
            >
              Скрыть
            </Button>
            <Button
              onClick={handleIsolate}
              disabled={!hasSelection}
              size="xs"
              variant="light"
              leftSection={<IconFocus2 size={14} />}
            >
              Изолир
            </Button>
          </Group>

          <Group grow gap={4}>
            <Button
              onClick={handleInvertSelection}
              disabled={!hasSelection}
              size="xs"
              variant="light"
              color="violet"
              leftSection={<IconReplace size={14} />}
            >
              Инверт
            </Button>
            {hasSelection && (
              <Button
                onClick={handleClearSelection}
                size="xs"
                variant="light"
                color="gray"
              >
                Снять
              </Button>
            )}
          </Group>

          {hasHidden && (
            <Button
              onClick={handleShowAll}
              size="xs"
              variant="light"
              color="green"
              leftSection={<IconEye size={14} />}
              fullWidth
            >
              Показать всё
            </Button>
          )}
          
          <Divider />
          
          <Button
            onClick={handleUndo}
            disabled={!canUndo}
            size="xs"
            variant="light"
            color="blue"
            leftSection={<IconArrowBack size={14} />}
            fullWidth
          >
            Отменить
          </Button>
        </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
}
