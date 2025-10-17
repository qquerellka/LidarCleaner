import { configureStore } from "@reduxjs/toolkit";
import uiReducer from "./uiSlice";
import sceneReducer from "./sceneSlice";
import editReducer from "./editSlice";

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    scene: sceneReducer,
    edit: editReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Игнорируем Set в editSlice
        ignoredActions: ['edit/setSelectedIndices', 'edit/addToSelection'],
        ignoredPaths: ['edit.selectedIndices'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = () => store.dispatch;
