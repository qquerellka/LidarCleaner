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
  Accordion,
  Kbd,
  Switch,
} from "@mantine/core";
import { 
  IconRuler, 
  IconPalette, 
  IconCube, 
  IconCamera,
} from "@tabler/icons-react";
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
    <Accordion 
      variant="separated" 
      defaultValue={["color"]}
      multiple
      styles={{
        item: {
          border: '1px solid var(--mantine-color-dark-4)',
        }
      }}
    >
      {/* Color Mode */}
      <Accordion.Item value="color">
        <Accordion.Control icon={<IconPalette size={18} />}>
          <Text size="sm" fw={500}>Цвета</Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="sm">
            <Radio.Group
              value={colorMode}
              onChange={(value) => dispatch(setColorMode(value as "vertex" | "fixed"))}
            >
              <Stack gap="xs">
                <Radio value="vertex" label="Цвета точек" />
                <Radio value="fixed" label="Единый цвет" />
              </Stack>
            </Radio.Group>

            {colorMode === "fixed" && (
              <ColorInput
                label="Выбрать цвет"
                value={fixedColor}
                onChange={(value) => dispatch(setFixedColor(value))}
                format="hex"
                size="xs"
              />
            )}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      {/* Gizmos */}
      <Accordion.Item value="gizmos">
        <Accordion.Control icon={<IconCube size={18} />}>
          <Text size="sm" fw={500}>Элементы сцены</Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="xs">
            <Checkbox
              label="Показать оси"
              checked={showAxes}
              onChange={(e) => dispatch(setShowAxes(e.currentTarget.checked))}
              size="xs"
            />
            <Checkbox
              label="Показать свет"
              checked={showLight}
              onChange={(e) => dispatch(setShowLight(e.currentTarget.checked))}
              size="xs"
            />
            <Checkbox
              label="Показать сетку"
              checked={showGrid}
              onChange={(e) => dispatch(setShowGrid(e.currentTarget.checked))}
              size="xs"
            />
            <Checkbox
              label="Показать границы"
              checked={showBBox}
              onChange={(e) => dispatch(setShowBBox(e.currentTarget.checked))}
              size="xs"
            />
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      {/* Camera Views */}
      <Accordion.Item value="camera">
        <Accordion.Control icon={<IconCamera size={18} />}>
          <Text size="sm" fw={500}>Виды камеры</Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="xs">
            <Group grow>
              <Button 
                variant="light" 
                size="xs"
                onClick={() => dispatch(triggerCameraCommand("top"))}
              >
                Сверху
              </Button>
              <Button 
                variant="light" 
                size="xs"
                onClick={() => dispatch(triggerCameraCommand("front"))}
              >
                Спереди
              </Button>
            </Group>
            <Group grow>
              <Button 
                variant="light" 
                size="xs"
                onClick={() => dispatch(triggerCameraCommand("side"))}
              >
                Сбоку
              </Button>
              <Button 
                variant="light" 
                size="xs"
                onClick={() => dispatch(triggerCameraCommand("reset"))}
              >
                Сброс
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              Пресеты: <Kbd size="xs">Alt+1..5</Kbd> загрузить, <Kbd size="xs">Ctrl+Alt+1..5</Kbd> сохранить
            </Text>
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      {/* Measurement Tool */}
      <Accordion.Item value="measurement">
        <Accordion.Control icon={<IconRuler size={18} />}>
          <Group justify="space-between" align="center" style={{ flex: 1, paddingRight: 12 }}>
            <Text size="sm" fw={500}>Измерения</Text>
            <Switch
              checked={measurementMode}
              onChange={(e) => {
                e.stopPropagation();
                dispatch(setMeasurementMode(e.currentTarget.checked));
              }}
              size="xs"
              onClick={(e) => e.stopPropagation()}
            />
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Text size="xs" c="dimmed">
            Кликните на две точки чтобы измерить расстояние. Нажмите <Kbd size="xs">M</Kbd> чтобы выйти.
          </Text>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
