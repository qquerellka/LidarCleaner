import { createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: { filePath: null as string | null },
  reducers: {
    setFilePath(state, action) {
      state.filePath = action.payload;
    }
  }
});

export const { setFilePath } = uiSlice.actions;
export default uiSlice.reducer;
