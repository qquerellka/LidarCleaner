import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface EditState {
  isEditMode: boolean;
  selectedIndices: Set<number>;
  selectionBox: {
    isActive: boolean;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null;
  canUndo: boolean;
}

const initialState: EditState = {
  isEditMode: false,
  selectedIndices: new Set(),
  selectionBox: null,
  canUndo: false,
};

const editSlice = createSlice({
  name: "edit",
  initialState,
  reducers: {
    setEditMode(state, action: PayloadAction<boolean>) {
      state.isEditMode = action.payload;
      if (!action.payload) {
        // При выходе из режима редактирования очищаем выделение
        state.selectedIndices = new Set();
        state.selectionBox = null;
      }
    },
    
    setSelectedIndices(state, action: PayloadAction<number[]>) {
      state.selectedIndices = new Set(action.payload);
    },
    
    addToSelection(state, action: PayloadAction<number[]>) {
      action.payload.forEach(idx => state.selectedIndices.add(idx));
    },
    
    clearSelection(state) {
      state.selectedIndices = new Set();
    },
    
    setSelectionBox(state, action: PayloadAction<EditState["selectionBox"]>) {
      state.selectionBox = action.payload;
    },
    
    setCanUndo(state, action: PayloadAction<boolean>) {
      state.canUndo = action.payload;
    },
  },
});

export const {
  setEditMode,
  setSelectedIndices,
  addToSelection,
  clearSelection,
  setSelectionBox,
  setCanUndo,
} = editSlice.actions;

export default editSlice.reducer;


