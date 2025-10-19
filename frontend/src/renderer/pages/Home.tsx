import React, { useState } from "react";
import { AppShell, Title, ScrollArea, ActionIcon, Tooltip, Group, useMantineColorScheme, Stack } from "@mantine/core";
import { IconKeyboard, IconSun, IconMoon } from "@tabler/icons-react";
import Scene3D from "../three/Scene3D";
import FileLoader from "../features/FileLoader/FileLoader";
import SceneControls from "../features/SceneControls/SceneControls";
import AutoCleanButton from "../features/SceneControls/AutoCleanButton";
import ExportButtons from "../features/SceneControls/ExportButtons";
import EditControls from "../features/SceneControls/EditControls";
import LoadingOverlay from "../components/LoadingOverlay";
import HotkeysModal from "../components/HotkeysModal";

export default function Home() {
  const [hotkeysModalOpen, setHotkeysModalOpen] = useState(false);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 320, breakpoint: "sm" }}
      padding={0}
    >
      <AppShell.Header p="md" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Title order={2} style={{ 
          fontWeight: 700, 
          letterSpacing: "-0.02em",
          background: "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text"
        }}>
          LidarCleaner
        </Title>
        <Group gap="md">
          <Tooltip label={colorScheme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} position="bottom">
            <ActionIcon 
              size="lg" 
              variant="subtle"
              onClick={() => toggleColorScheme()}
            >
              {colorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Горячие клавиши (?)" position="bottom">
            <ActionIcon 
              size="lg" 
              variant="subtle"
              onClick={() => setHotkeysModalOpen(true)}
            >
              <IconKeyboard size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <ScrollArea 
          style={{ height: "calc(100vh - 60px)" }}
          scrollbarSize={6}
          type="auto"
        >
          <Stack gap="md">
            <FileLoader />
            <AutoCleanButton />
            <EditControls />
            <ExportButtons />
            <SceneControls />
          </Stack>
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main style={{ padding: 0, height: "100vh" }}>
        <div style={{ width: "100%", height: "100%" }}>
          <Scene3D />
          <LoadingOverlay />
        </div>
      </AppShell.Main>

      <HotkeysModal
        opened={hotkeysModalOpen}
        onClose={() => setHotkeysModalOpen(false)}
      />
    </AppShell>
  );
}
