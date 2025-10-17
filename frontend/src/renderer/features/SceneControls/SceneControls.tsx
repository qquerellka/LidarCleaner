import React from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Stack,
  Radio,
  Group,
  ColorInput,
  Checkbox,
  Button,
  Text,
  Paper,
  Divider,
  Card,
  Badge,
  Kbd,
  Switch,
} from "@mantine/core";
import { IconRuler } from "@tabler/icons-react";
import type { RootState } from "../../store";
import {
  setColorMode,
  setFixedColor,
  setShowAxes,
  setShowLight,
  setShowGrid,
  triggerCameraCommand,
  setShowBBox,
  setMeasurementMode,
} from "../../store/sceneSlice";

export default function SceneControls() {
  const dispatch = useDispatch();
  const {
    colorMode, fixedColor,
    showAxes, showLight, showGrid,
    showBBox, measurementMode,
  } = useSelector((s: RootState) => s.scene);

  return (
    <Stack gap="md">
      {/* Color Mode */}
      <Paper p="md" withBorder>
        <Text size="sm" fw={500} mb="xs">Режим цвета</Text>
        <Radio.Group
          value={colorMode}
          onChange={(value) => dispatch(setColorMode(value as "vertex" | "fixed"))}
        >
          <Group>
            <Radio value="vertex" label="Цвета точек" />
            <Radio value="fixed" label="Единый цвет" />
          </Group>
        </Radio.Group>

        {colorMode === "fixed" && (
          <ColorInput
            label="Выбрать цвет"
            value={fixedColor}
            onChange={(value) => dispatch(setFixedColor(value))}
            mt="sm"
            format="hex"
          />
        )}
      </Paper>

      {/* Gizmos */}
      <Paper p="md" withBorder>
        <Text size="sm" fw={500} mb="xs">Элементы сцены</Text>
        <Stack gap="xs">
          <Checkbox
            label="Показать оси"
            checked={showAxes}
            onChange={(e) => dispatch(setShowAxes(e.currentTarget.checked))}
          />
          <Checkbox
            label="Показать свет"
            checked={showLight}
            onChange={(e) => dispatch(setShowLight(e.currentTarget.checked))}
          />
          <Checkbox
            label="Показать сетку"
            checked={showGrid}
            onChange={(e) => dispatch(setShowGrid(e.currentTarget.checked))}
          />
          <Checkbox
            label="Показать границы"
            checked={showBBox}
            onChange={(e) => dispatch(setShowBBox(e.currentTarget.checked))}
          />
        </Stack>
      </Paper>

      {/* Camera Views */}
      <Paper p="md" withBorder>
        <Text size="sm" fw={500} mb="xs">Виды камеры</Text>
        <Group grow>
          <Button variant="light" onClick={() => dispatch(triggerCameraCommand("top"))}>
            Сверху
          </Button>
          <Button variant="light" onClick={() => dispatch(triggerCameraCommand("front"))}>
            Спереди
          </Button>
        </Group>
        <Group grow mt="xs">
          <Button variant="light" onClick={() => dispatch(triggerCameraCommand("side"))}>
            Сбоку
          </Button>
          <Button variant="light" onClick={() => dispatch(triggerCameraCommand("reset"))}>
            Сброс
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mt="xs">
          Пресеты: <Kbd>Alt+1..5</Kbd> загрузить, <Kbd>Ctrl+Alt+1..5</Kbd> сохранить
        </Text>
      </Paper>

      {/* Measurement Tool */}
      <Paper p="md" withBorder>
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconRuler size={20} />
            <Text size="sm" fw={500}>Измерение расстояний</Text>
          </Group>
          <Switch
            checked={measurementMode}
            onChange={(e) => dispatch(setMeasurementMode(e.currentTarget.checked))}
            size="sm"
          />
        </Group>
        {measurementMode && (
          <Text size="xs" c="dimmed" mt="xs">
            Кликните на две точки чтобы измерить расстояние. Нажмите <Kbd>M</Kbd> чтобы выйти.
          </Text>
        )}
      </Paper>

      {/* Legend */}
      <Card withBorder p="sm">
        <Text size="xs" fw={500} mb={4}>Информация</Text>
        <Badge variant="light" size="sm" fullWidth>
          {colorMode === "vertex" ? "Цвета из файла / по высоте" : `Цвет: ${fixedColor}`}
        </Badge>
      </Card>
    </Stack>
  );
}
