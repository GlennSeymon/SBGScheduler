import { useCallback, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import type { AlertColor } from '@mui/material';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { NotificationContext } from './NotificationContext';

interface NotificationState {
  key: number;
  message: string;
  severity: AlertColor;
}

// Errors/warnings get longer on screen than success/info — there's more to read and it matters more
// that the user actually sees it.
const AUTO_HIDE_DURATION: Record<AlertColor, number> = {
  success: 4000,
  info: 4000,
  warning: 8000,
  error: 8000,
};

interface NotificationProviderProps {
  children: ReactNode;
}

const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const queueRef = useRef<NotificationState[]>([]);
  const openRef = useRef(false);
  const [current, setCurrent] = useState<NotificationState | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const processQueue = useCallback(() => {
    const next = queueRef.current.shift();
    setCurrent(next);
    setOpen(next !== undefined);
    openRef.current = next !== undefined;
  }, []);

  // Notifications queue instead of replacing each other, so a fast one (e.g. Snackbar firing right
  // before a dialog-close re-render) doesn't get silently dropped.
  const notify = useCallback(
    (message: string, severity: AlertColor = 'success') => {
      queueRef.current.push({ message, severity, key: Date.now() + Math.random() });
      if (openRef.current) {
        setOpen(false);
      } else {
        processQueue();
      }
    },
    [processQueue],
  );

  const handleClose = (_event: SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        key={current?.key}
        open={open}
        autoHideDuration={current ? AUTO_HIDE_DURATION[current.severity] : null}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ transition: { onExited: processQueue } }}
      >
        <Alert onClose={() => setOpen(false)} severity={current?.severity ?? 'success'} variant="filled">
          {current?.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;
