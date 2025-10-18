import React from 'react';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';

/**
 * Утилиты для отображения toast-уведомлений
 */

export const showSuccessNotification = (message: string, title = 'Успех') => {
  notifications.show({
    title,
    message,
    color: 'green',
    icon: <IconCheck size={18} />,
    autoClose: 3000,
  });
};

export const showErrorNotification = (message: string, title = 'Ошибка') => {
  notifications.show({
    title,
    message,
    color: 'red',
    icon: <IconX size={18} />,
    autoClose: 5000,
  });
};

export const showWarningNotification = (message: string, title = 'Предупреждение') => {
  notifications.show({
    title,
    message,
    color: 'yellow',
    icon: <IconAlertTriangle size={18} />,
    autoClose: 4000,
  });
};

export const showInfoNotification = (message: string, title = 'Информация') => {
  notifications.show({
    title,
    message,
    color: 'blue',
    icon: <IconInfoCircle size={18} />,
    autoClose: 3000,
  });
};

/**
 * Показывает уведомление об ошибке с деталями
 */
export const showErrorWithDetails = (error: Error | unknown, context?: string) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const title = context ? `Ошибка: ${context}` : 'Ошибка';
  
  showErrorNotification(errorMessage, title);
  
  // Логируем в консоль для отладки
  console.error(context || 'Error:', error);
};

/**
 * Показывает прогресс загрузки (с id для обновления)
 */
export const showLoadingNotification = (message: string, id: string, title = 'Загрузка...') => {
  notifications.show({
    id,
    title,
    message,
    loading: true,
    autoClose: false,
    withCloseButton: false,
  });
};

/**
 * Обновляет уведомление о загрузке на успех
 */
export const updateLoadingToSuccess = (id: string, message: string, title = 'Готово') => {
  notifications.update({
    id,
    title,
    message,
    color: 'green',
    icon: <IconCheck size={18} />,
    loading: false,
    autoClose: 3000,
  });
};

/**
 * Обновляет уведомление о загрузке на ошибку
 */
export const updateLoadingToError = (id: string, message: string, title = 'Ошибка') => {
  notifications.update({
    id,
    title,
    message,
    color: 'red',
    icon: <IconX size={18} />,
    loading: false,
    autoClose: 5000,
  });
};

