import React from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../store";
import {
  setPointSize,
  setColorMode,
  setFixedColor,
  setShowAxes,
  setShowLight,
  setShowGrid,
  triggerCameraCommand,

  // NEW:
  setShowBBox,
  setClippingEnabled,
  setClipX,
  setClipY,
  setClipZ,
} from "../../store/sceneSlice";

export default function SceneControls() {
  const dispatch = useDispatch();
  const {
    pointSize, colorMode, fixedColor,
    showAxes, showLight, showGrid,
    showBBox,
    clippingEnabled, clipX, clipY, clipZ,
  } = useSelector((s: RootState) => s.scene);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <label style={{ display: "block", marginBottom: 6 }}>Point size: {pointSize.toFixed(3)}</label>
        <input
          type="range"
          min={0.001}
          max={0.1}
          step={0.001}
          value={pointSize}
          onChange={(e) => dispatch(setPointSize(parseFloat(e.target.value)))}
        />
      </div>

      <div>
        <label style={{ display: "block", marginBottom: 6 }}>Color mode</label>
        <label style={{ marginRight: 12 }}>
          <input
            type="radio"
            name="colorMode"
            checked={colorMode === "vertex"}
            onChange={() => dispatch(setColorMode("vertex"))}
          />{" "}
          Vertex
        </label>
        <label>
          <input
            type="radio"
            name="colorMode"
            checked={colorMode === "fixed"}
            onChange={() => dispatch(setColorMode("fixed"))}
          />{" "}
          Fixed
        </label>
      </div>

      {colorMode === "fixed" && (
        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Fixed color</label>
          <input
            type="color"
            value={fixedColor}
            onChange={(e) => dispatch(setFixedColor(e.target.value))}
            style={{ width: 48, height: 32, padding: 0, border: "1px solid #555", background: "none" }}
          />
        </div>
      )}

      <div>
        <label style={{ display: "block", marginBottom: 6 }}>Gizmos</label>
        <label style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={showAxes}
            onChange={(e) => dispatch(setShowAxes(e.target.checked))}
          />{" "}
          Show axes
        </label>
        <label style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={showLight}
            onChange={(e) => dispatch(setShowLight(e.target.checked))}
          />{" "}
          Show light
        </label>
        <label style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => dispatch(setShowGrid(e.target.checked))}
          />{" "}
          Show grid
        </label>
        <label style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={showBBox}
            onChange={(e) => dispatch(setShowBBox(e.target.checked))}
          />{" "}
          Show bounding box
        </label>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: 6 }}>Clipping</label>
        <label style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={clippingEnabled}
            onChange={(e) => dispatch(setClippingEnabled(e.target.checked))}
          />{" "}
          Enable clipping
        </label>

        {(["X", "Y", "Z"] as const).map((axis) => {
          const clip = axis === "X" ? clipX : axis === "Y" ? clipY : clipZ;
          const setClip = axis === "X" ? setClipX : axis === "Y" ? setClipY : setClipZ;
          return (
            <div key={axis} style={{ display: "grid", gridTemplateColumns: "auto auto 1fr 1fr", gap: 8, alignItems: "center", opacity: clippingEnabled ? 1 : 0.5 }}>
              <strong>{axis}</strong>
              <label>
                <input
                  type="checkbox"
                  checked={clip.enabled}
                  onChange={(e) => dispatch(setClip({ enabled: e.target.checked }))}
                  disabled={!clippingEnabled}
                /> on
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={clip.min}
                onChange={(e) => dispatch(setClip({ min: parseFloat(e.target.value) }))}
                disabled={!clippingEnabled || !clip.enabled}
                title={`${axis} min (${clip.min.toFixed(2)})`}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={clip.max}
                onChange={(e) => dispatch(setClip({ max: parseFloat(e.target.value) }))}
                disabled={!clippingEnabled || !clip.enabled}
                title={`${axis} max (${clip.max.toFixed(2)})`}
              />
            </div>
          );
        })}
        <small>Диапазоны — в нормированных долях bbox по соответствующей оси (0..1).</small>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: 6 }}>Views</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          <button onClick={() => dispatch(triggerCameraCommand("top"))}>Top</button>
          <button onClick={() => dispatch(triggerCameraCommand("front"))}>Front</button>
          <button onClick={() => dispatch(triggerCameraCommand("side"))}>Side</button>
          <button onClick={() => dispatch(triggerCameraCommand("reset"))}>Reset</button>
        </div>
        <small>Пресеты видов: <kbd>Alt+1..5</kbd> — загрузить, <kbd>Ctrl+Alt+1..5</kbd> — сохранить.</small>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: 6 }}>Legend</label>
        <div style={{ fontSize: 12, lineHeight: 1.4 }}>
          <div>Color: {colorMode === "vertex" ? "from PCD (or height LUT)" : fixedColor}</div>
          <div>Point size: {pointSize.toFixed(3)}</div>
        </div>
      </div>
    </div>
  );
}
