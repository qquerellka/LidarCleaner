import { Middleware } from '@reduxjs/toolkit';

/**
 * Middleware для синхронизации состояния с localStorage
 * Заменяет side effects в reducers
 */
export const localStorageMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);

  // Сохраняем view presets при их изменении
  if (typeof action === 'object' && action !== null && 'type' in action) {
    const actionType = (action as { type: string }).type;
    if (actionType === 'scene/upsertViewPreset' || actionType === 'scene/deleteViewPreset') {
      try {
        const state = store.getState();
        localStorage.setItem('pcd_view_presets', JSON.stringify(state.scene.viewPresets));
      } catch (error) {
        console.error('Failed to save view presets to localStorage:', error);
      }
    }
  }

  // Можно добавить сохранение других настроек
  // if (action.type === 'scene/setPointSize') {
  //   try {
  //     const state = store.getState();
  //     localStorage.setItem('pcd_point_size', String(state.scene.pointSize));
  //   } catch (error) {
  //     console.error('Failed to save point size to localStorage:', error);
  //   }
  // }

  return result;
};

