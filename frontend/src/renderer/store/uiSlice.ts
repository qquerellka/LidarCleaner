import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UiState {
  filePath: string | null;
  pointCount: number;
}

const initialState: UiState = {
  filePath: null,
  pointCount: 0,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setFilePath(state, action: PayloadAction<string | null>) {
      state.filePath = action.payload;
    },
    setPointCount(state, action: PayloadAction<number>) {
      state.pointCount = action.payload;
    }
  }
});

export const { setFilePath, setPointCount } = uiSlice.actions;
export default uiSlice.reducer;
