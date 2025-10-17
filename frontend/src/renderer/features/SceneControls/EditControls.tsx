import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Paper, Stack, Text, Switch, Group, Badge } from "@mantine/core";
import { IconEdit, IconTrash, IconEyeOff, IconFocus2, IconArrowBack } from "@tabler/icons-react";
import type { RootState } from "../../store";
import { setEditMode, clearSelection } from "../../store/editSlice";

export default function EditControls() {
  const dispatch = useDispatch();
  const { isEditMode, selectedIndices, canUndo } = useSelector((s: RootState) => s.edit);
  const filePath = useSelector((s: RootState) => s.ui.filePath);

  const selectedCount = selectedIndices.size;
  const hasSelection = selectedCount > 0;
  const hasFile = !!filePath;

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
            <Badge
              variant="light"
              size="lg"
              fullWidth
              color={hasSelection ? "cyan" : "gray"}
            >
              Выбрано: {selectedCount} {selectedCount === 1 ? "точка" : selectedCount < 5 ? "точки" : "точек"}
            </Badge>

            <Text size="xs" c="dimmed">
              💡 Зажмите Shift + перетащите мышь для выделения области
            </Text>

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


