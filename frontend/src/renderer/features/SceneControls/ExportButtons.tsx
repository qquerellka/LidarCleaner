import React from "react";
import { Button, Paper, Stack, Text, Group } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";

export default function ExportButtons() {
  const filePath = useSelector((s: RootState) => s.ui.filePath);

  const exportPLY = () => {
    window.dispatchEvent(new CustomEvent("export-ply"));
  };

  const exportPLYBinary = () => {
    window.dispatchEvent(new CustomEvent("export-ply-binary"));
  };

  const exportPCD = () => {
    window.dispatchEvent(new CustomEvent("export-pcd"));
  };

  const hasFile = !!filePath;

  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Text size="sm" fw={500}>Экспорт файла</Text>
        
        <Group grow>
          <Button
            onClick={exportPLY}
            disabled={!hasFile}
            size="sm"
            variant="light"
            leftSection={<IconDownload size={16} />}
            title="Экспорт в формат PLY (текстовый)"
          >
            PLY
          </Button>
          <Button
            onClick={exportPLYBinary}
            disabled={!hasFile}
            size="sm"
            variant="light"
            leftSection={<IconDownload size={16} />}
            title="Экспорт в формат PLY (бинарный)"
          >
            PLY (bin)
          </Button>
        </Group>

        <Button
          onClick={exportPCD}
          disabled={!hasFile}
          size="sm"
          variant="light"
          leftSection={<IconDownload size={16} />}
          fullWidth
          title="Экспорт в формат PCD (текстовый)"
        >
          PCD
        </Button>

        {!hasFile && (
          <Text size="xs" c="dimmed" ta="center">
            Откройте файл для экспорта
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

