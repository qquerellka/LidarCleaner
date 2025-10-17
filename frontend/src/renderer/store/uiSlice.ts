import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface RecentFile {
  path: string;
  name: string;
  timestamp: number;
  sizeMB?: number;
}

interface UiState {
  filePath: string | null;
  pointCount: number;
  isLoading: boolean;
  loadingProgress: number; // 0-100
  loadingMessage: string;
  recentFiles: RecentFile[];
}

const loadRecentFiles = (): RecentFile[] => {
  try {
    const stored = localStorage.getItem('recent_files');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const initialState: UiState = {
  filePath: null,
  pointCount: 0,
  isLoading: false,
  loadingProgress: 0,
  loadingMessage: '',
  recentFiles: loadRecentFiles(),
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setFilePath(state, action: PayloadAction<string | null>) {
      state.filePath = action.payload;
      
      // Добавляем в недавние файлы
      if (action.payload) {
        const fileName = action.payload.split('/').pop() || action.payload;
        const existing = state.recentFiles.findIndex(f => f.path === action.payload);
        
        const newFile: RecentFile = {
          path: action.payload,
          name: fileName,
          timestamp: Date.now(),
        };
        
        // Удаляем если уже есть
        if (existing >= 0) {
          state.recentFiles.splice(existing, 1);
        }
        
        // Добавляем в начало
        state.recentFiles.unshift(newFile);
        
        // Храним максимум 10 файлов
        if (state.recentFiles.length > 10) {
          state.recentFiles = state.recentFiles.slice(0, 10);
        }
        
        // Сохраняем в localStorage
        try {
          localStorage.setItem('recent_files', JSON.stringify(state.recentFiles));
        } catch {}
      }
    },
    setPointCount(state, action: PayloadAction<number>) {
      state.pointCount = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
      if (!action.payload) {
        state.loadingProgress = 0;
        state.loadingMessage = '';
      }
    },
    setLoadingProgress(state, action: PayloadAction<{ progress: number; message?: string }>) {
      state.loadingProgress = action.payload.progress;
      if (action.payload.message) {
        state.loadingMessage = action.payload.message;
      }
    },
    clearRecentFiles(state) {
      state.recentFiles = [];
      try {
        localStorage.removeItem('recent_files');
      } catch {}
    },
    removeRecentFile(state, action: PayloadAction<string>) {
      state.recentFiles = state.recentFiles.filter(f => f.path !== action.payload);
      try {
        localStorage.setItem('recent_files', JSON.stringify(state.recentFiles));
      } catch {}
    }
  }
});

export const { 
  setFilePath, 
  setPointCount, 
  setLoading, 
  setLoadingProgress,
  clearRecentFiles,
  removeRecentFile,
} = uiSlice.actions;
export default uiSlice.reducer;
