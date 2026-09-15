import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { AlertColor } from '@mui/material';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { NotificationContext } from './NotificationContext';

interface NotificationState {
  message: string;
  severity: AlertColor;
}

interface NotificationProviderProps {
  children: ReactNode;
}

const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const notify = useCallback((message: string, severity: AlertColor = 'success') => {
    setNotification({ message, severity });
  }, []);

  const handleClose = () => setNotification(null);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleClose} severity={notification?.severity ?? 'success'} variant="filled">
          {notification?.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;
