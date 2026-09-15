import { createContext, useContext } from 'react';
import type { AlertColor } from '@mui/material';

interface NotificationContextValue {
  notify: (message: string, severity?: AlertColor) => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
