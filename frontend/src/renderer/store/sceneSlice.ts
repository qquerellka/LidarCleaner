import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ColorMode = "fixed" | "vertex";
export type CameraCommand = "reset" | "top" | "front" | "side" | null;

export interface ViewPreset {
  id: number; // 1..5
  cameraPos: [number, number, number];
  target: [number, number, number];
}

export interface AxisClip {
  enabled: boolean;
  min: number; // 0..1 (нормировано по bbox)
  max: number; // 0..1
}

export interface SceneState {
  pointSize: number;
  colorMode: ColorMode;
  fixedColor: string;
  showAxes: boolean;
  showLight: boolean;
  showGrid: boolean;
  cameraCommand: CameraCommand;

  // NEW:
  showBBox: boolean;

  clippingEnabled: boolean;
  clipX: AxisClip;
  clipY: AxisClip;
  clipZ: AxisClip;

  viewPresets: ViewPreset[];
}

const initialState: SceneState = {
  pointSize: 0.02,
  colorMode: "vertex",
  fixedColor: "#00ff88",
  showAxes: true,
  showLight: true,
  showGrid: true,
  cameraCommand: null,

  showBBox: false,

  clippingEnabled: false,
  clipX: { enabled: false, min: 0, max: 1 },
  clipY: { enabled: false, min: 0, max: 1 },
  clipZ: { enabled: false, min: 0, max: 1 },

  viewPresets: [],
};

const sceneSlice = createSlice({
  name: "scene",
  initialState,
  reducers: {
    setPointSize(state, action: PayloadAction<number>) {
      state.pointSize = action.payload;
    },
    setColorMode(state, action: PayloadAction<ColorMode>) {
      state.colorMode = action.payload;
    },
    setFixedColor(state, action: PayloadAction<string>) {
      state.fixedColor = action.payload;
    },
    setShowAxes(state, action: PayloadAction<boolean>) {
      state.showAxes = action.payload;
    },
    setShowLight(state, action: PayloadAction<boolean>) {
      state.showLight = action.payload;
    },
    setShowGrid(state, action: PayloadAction<boolean>) {
      state.showGrid = action.payload;
    },
    triggerCameraCommand(state, action: PayloadAction<CameraCommand>) {
      state.cameraCommand = action.payload;
    },
    clearCameraCommand(state) {
      state.cameraCommand = null;
    },

    // NEW:
    setShowBBox(state, action: PayloadAction<boolean>) {
      state.showBBox = action.payload;
    },
    setClippingEnabled(state, action: PayloadAction<boolean>) {
      state.clippingEnabled = action.payload;
    },
    setClipX(state, action: PayloadAction<Partial<AxisClip>>) {
      state.clipX = { ...state.clipX, ...action.payload };
    },
    setClipY(state, action: PayloadAction<Partial<AxisClip>>) {
      state.clipY = { ...state.clipY, ...action.payload };
    },
    setClipZ(state, action: PayloadAction<Partial<AxisClip>>) {
      state.clipZ = { ...state.clipZ, ...action.payload };
    },

    upsertViewPreset(state, action: PayloadAction<ViewPreset>) {
      const idx = state.viewPresets.findIndex((p) => p.id === action.payload.id);
      if (idx >= 0) state.viewPresets[idx] = action.payload;
      else state.viewPresets.push(action.payload);
      try {
        localStorage.setItem("pcd_view_presets", JSON.stringify(state.viewPresets));
      } catch {}
    },
    loadViewPresetsFromStorage(state) {
      try {
        const raw = localStorage.getItem("pcd_view_presets");
        if (raw) state.viewPresets = JSON.parse(raw);
      } catch {}
    },
  },
});

export const {
  setPointSize,
  setColorMode,
  setFixedColor,
  setShowAxes,
  setShowLight,
  setShowGrid,
  triggerCameraCommand,
  clearCameraCommand,

  setShowBBox,
  setClippingEnabled,
  setClipX,
  setClipY,
  setClipZ,

  upsertViewPreset,
  loadViewPresetsFromStorage,
} = sceneSlice.actions;

export default sceneSlice.reducer;
