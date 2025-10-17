import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface EditState {
  isEditMode: boolean;
  selectedIndices: number[];  // Изменено с Set<number> на number[]
  hiddenIndices: number[];    // Скрытые точки
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
  selectedIndices: [],  // Изменено с new Set() на []
  hiddenIndices: [],
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
        // При выходе из режима редактирования очищаем выделение и скрытые точки
        state.selectedIndices = [];
        state.hiddenIndices = [];
        state.selectionBox = null;
      }
    },
    
    setSelectedIndices(state, action: PayloadAction<number[]>) {
      state.selectedIndices = action.payload;
    },
    
    addToSelection(state, action: PayloadAction<number[]>) {
      // Добавляем только уникальные индексы
      const uniqueNew = action.payload.filter(idx => !state.selectedIndices.includes(idx));
      state.selectedIndices = [...state.selectedIndices, ...uniqueNew];
    },
    
    clearSelection(state) {
      state.selectedIndices = [];
    },
    
    setSelectionBox(state, action: PayloadAction<EditState["selectionBox"]>) {
      state.selectionBox = action.payload;
    },
    
    setCanUndo(state, action: PayloadAction<boolean>) {
      state.canUndo = action.payload;
    },
    
    setHiddenIndices(state, action: PayloadAction<number[]>) {
      state.hiddenIndices = action.payload;
    },
    
    clearHidden(state) {
      state.hiddenIndices = [];
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
  setHiddenIndices,
  clearHidden,
} = editSlice.actions;

export default editSlice.reducer;


