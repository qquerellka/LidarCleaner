import { configureStore } from "@reduxjs/toolkit";
import uiReducer from "./uiSlice";
import sceneReducer from "./sceneSlice";
import editReducer from "./editSlice";
import { localStorageMiddleware } from "./middleware/localStorageMiddleware";

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    scene: sceneReducer,
    edit: editReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(localStorageMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = () => store.dispatch;
