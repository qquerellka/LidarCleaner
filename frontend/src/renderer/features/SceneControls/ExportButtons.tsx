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
        <Group justify="space-between" align="center">
          <Text size="sm" fw={500}>Экспорт</Text>
          <IconDownload size={16} style={{ opacity: 0.5 }} />
        </Group>
        
        {!hasFile ? (
          <Text size="xs" c="dimmed" ta="center">
            Откройте файл для экспорта
          </Text>
        ) : (
          <Group grow gap={4}>
            <Button
              onClick={exportPLY}
              size="xs"
              variant="light"
              title="Экспорт в формат PLY (текстовый)"
            >
              PLY
            </Button>
            <Button
              onClick={exportPLYBinary}
              size="xs"
              variant="light"
              title="Экспорт в формат PLY (бинарный)"
            >
              PLY Bin
            </Button>
            <Button
              onClick={exportPCD}
              size="xs"
              variant="light"
              title="Экспорт в формат PCD (текстовый)"
            >
              PCD
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}

