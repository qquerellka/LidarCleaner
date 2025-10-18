import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface SelectionStats {
  bbox: { sizeX: number; sizeY: number; sizeZ: number };
  heightRange: { min: number; max: number };
}

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
  selectionStats: SelectionStats | null;  // Статистика выделения
  brushMode: boolean;         // Режим кисти
  brushRadius: number;        // Радиус кисти (в единицах сцены)
  canUndo: boolean;
}

const initialState: EditState = {
  isEditMode: false,
  selectedIndices: [],  // Изменено с new Set() на []
  hiddenIndices: [],
  selectionBox: null,
  selectionStats: null,
  brushMode: false,
  brushRadius: 0.05,    // 5 см по умолчанию
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
      const currentSet = new Set(state.selectedIndices);
      action.payload.forEach(idx => currentSet.add(idx));
      state.selectedIndices = Array.from(currentSet);
    },
    
    removeFromSelection(state, action: PayloadAction<number[]>) {
      // Вычитаем индексы из выделения
      const toRemoveSet = new Set(action.payload);
      state.selectedIndices = state.selectedIndices.filter(idx => !toRemoveSet.has(idx));
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
    
    invertSelection(state, action: PayloadAction<number>) {
      // Инвертируем выделение: выделяем все точки кроме текущих
      const totalCount = action.payload;
      const selectedSet = new Set(state.selectedIndices);
      const inverted: number[] = [];
      
      for (let i = 0; i < totalCount; i++) {
        if (!selectedSet.has(i)) {
          inverted.push(i);
        }
      }
      
      state.selectedIndices = inverted;
    },
    
    setSelectionStats(state, action: PayloadAction<SelectionStats | null>) {
      state.selectionStats = action.payload;
    },
    
    setBrushMode(state, action: PayloadAction<boolean>) {
      state.brushMode = action.payload;
    },
    
    setBrushRadius(state, action: PayloadAction<number>) {
      // Ограничиваем радиус от 0.01 до 1.0 метра
      state.brushRadius = Math.max(0.01, Math.min(1.0, action.payload));
    },
    
    adjustBrushRadius(state, action: PayloadAction<number>) {
      // Увеличиваем/уменьшаем радиус на delta
      const newRadius = state.brushRadius + action.payload;
      state.brushRadius = Math.max(0.01, Math.min(1.0, newRadius));
    },
  },
});

export const {
  setEditMode,
  setSelectedIndices,
  addToSelection,
  removeFromSelection,
  clearSelection,
  setSelectionBox,
  setCanUndo,
  setHiddenIndices,
  clearHidden,
  invertSelection,
  setSelectionStats,
  setBrushMode,
  setBrushRadius,
  adjustBrushRadius,
} = editSlice.actions;

export default editSlice.reducer;


