import { configureStore } from "@reduxjs/toolkit";
import uiReducer from "./uiSlice";
import sceneReducer from "./sceneSlice";

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    scene: sceneReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = () => store.dispatch;
