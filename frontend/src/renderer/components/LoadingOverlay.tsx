import React from "react";
import { useSelector } from "react-redux";
import { Overlay, Center, Stack, Text, Progress, Paper } from "@mantine/core";
import { IconCloudUpload } from "@tabler/icons-react";
import type { RootState } from "../store";

export default function LoadingOverlay() {
  const { isLoading, loadingProgress, loadingMessage } = useSelector((s: RootState) => s.ui);

  if (!isLoading) return null;

  return (
    <Overlay color="#000" backgroundOpacity={0.85} blur={2} zIndex={1000}>
      <Center style={{ height: '100vh' }}>
        <Paper p="xl" radius="md" shadow="xl" style={{ minWidth: 400 }}>
          <Stack gap="md" align="center">
            <IconCloudUpload size={48} style={{ opacity: 0.8 }} />
            <Text size="lg" fw={600}>
              {loadingMessage || 'Загрузка файла...'}
            </Text>
            <Progress
              value={loadingProgress}
              size="lg"
              radius="xl"
              striped
              animated
              style={{ width: '100%' }}
            />
            <Text size="sm" c="dimmed">
              {loadingProgress.toFixed(0)}%
            </Text>
          </Stack>
        </Paper>
      </Center>
    </Overlay>
  );
}

