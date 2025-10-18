import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Paper, Stack, Text, Switch, Group, Badge, Divider, Slider, Collapse } from "@mantine/core";
import { IconEdit, IconTrash, IconEyeOff, IconFocus2, IconArrowBack, IconEye, IconReplace, IconBrush, IconChevronDown } from "@tabler/icons-react";
import type { RootState } from "../../store";
import { setEditMode, clearSelection, invertSelection, setBrushMode, setBrushRadius } from "../../store/editSlice";

export default function EditControls() {
  const dispatch = useDispatch();
  const { isEditMode, selectedIndices, hiddenIndices, selectionStats, brushMode, brushRadius, canUndo } = useSelector((s: RootState) => s.edit);
  const { filePath, pointCount, isAutoProcessing } = useSelector((s: RootState) => s.ui);

  const selectedCount = selectedIndices.length;
  const hiddenCount = hiddenIndices.length;
  const hasSelection = selectedCount > 0;
  const hasHidden = hiddenCount > 0;
  const hasFile = !!filePath;

  // Collapsible sections state
  const [statsExpanded, setStatsExpanded] = useState(true);
  const [selectionModeExpanded, setSelectionModeExpanded] = useState(true);
  const [actionsExpanded, setActionsExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  
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
            {/* Секция: Статистика */}
            <Paper withBorder p="xs">
              <Group
                justify="space-between"
                style={{ cursor: 'pointer' }}
                onClick={() => setStatsExpanded(!statsExpanded)}
              >
                <Text size="sm" fw={500}>📊 Статистика</Text>
                <IconChevronDown 
                  size={16} 
                  style={{ 
                    transform: statsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }} 
                />
              </Group>

              <Collapse in={statsExpanded}>
                <Stack gap="xs" mt="xs">
                  <Badge variant="light" size="sm" fullWidth color="blue">
                    Всего: {formatNumber(pointCount)}
                  </Badge>
                  <Badge variant="light" size="lg" fullWidth color={hasSelection ? "cyan" : "gray"}>
                    Выбрано: {formatNumber(selectedCount)}
                  </Badge>
                  {hasHidden && (
                    <Badge variant="light" size="sm" fullWidth color="orange">
                      Скрыто: {formatNumber(hiddenCount)}
                    </Badge>
                  )}
                  {selectionStats && (
                    <Stack gap={4} mt="xs">
                      <Text size="xs" c="dimmed">
                        📏 {selectionStats.bbox.sizeX.toFixed(2)} × {selectionStats.bbox.sizeY.toFixed(2)} × {selectionStats.bbox.sizeZ.toFixed(2)} м
                      </Text>
                      <Text size="xs" c="dimmed">
                        📈 Высота: {selectionStats.heightRange.min.toFixed(2)}—{selectionStats.heightRange.max.toFixed(2)} м
                      </Text>
                    </Stack>
                  )}
                </Stack>
              </Collapse>
            </Paper>

            {/* Секция: Режим выделения */}
            <Paper withBorder p="xs">
              <Group
                justify="space-between"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectionModeExpanded(!selectionModeExpanded)}
              >
                <Text size="sm" fw={500}>🎯 Режим выделения</Text>
                <IconChevronDown 
                  size={16} 
                  style={{ 
                    transform: selectionModeExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }} 
                />
              </Group>

              <Collapse in={selectionModeExpanded}>
                <Stack gap="xs" mt="xs">
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
                      <Group justify="space-between">
                        <Text size="xs" fw={500}>Размер</Text>
                        <Text size="xs" c="dimmed">{(brushRadius * 100).toFixed(0)} см</Text>
                      </Group>
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
                      <Text size="xs" c="dimmed">
                        [ ] для ±5 см, +/- для ±2 см
                      </Text>
                    </>
                  ) : (
                    <Text size="xs" c="dimmed">
                      Shift+Drag для выделения<br/>
                      Ctrl удерживать для блокировки камеры
                    </Text>
                  )}
                </Stack>
              </Collapse>
            </Paper>

            {/* Секция: Действия */}
            <Paper withBorder p="xs">
              <Group
                justify="space-between"
                style={{ cursor: 'pointer' }}
                onClick={() => setActionsExpanded(!actionsExpanded)}
              >
                <Text size="sm" fw={500}>⚡ Действия</Text>
                <IconChevronDown 
                  size={16} 
                  style={{ 
                    transform: actionsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }} 
                />
              </Group>

              <Collapse in={actionsExpanded}>
                <Stack gap="xs" mt="xs">
                  <Button
                    onClick={handleDelete}
                    disabled={!hasSelection}
                    size="sm"
                    variant="light"
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    fullWidth
                  >
                    Удалить
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
                    Инвертировать
                  </Button>

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
              </Collapse>
            </Paper>

            {/* Секция: История */}
            <Paper withBorder p="xs">
              <Group
                justify="space-between"
                style={{ cursor: 'pointer' }}
                onClick={() => setHistoryExpanded(!historyExpanded)}
              >
                <Text size="sm" fw={500}>⏱️ История</Text>
                <IconChevronDown 
                  size={16} 
                  style={{ 
                    transform: historyExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }} 
                />
              </Group>

              <Collapse in={historyExpanded}>
                <Stack gap="xs" mt="xs">
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
                </Stack>
              </Collapse>
            </Paper>
          </>
        )}
      </Stack>
    </Paper>
  );
}


