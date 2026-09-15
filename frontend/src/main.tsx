import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enAU } from 'date-fns/locale';
import AppRouter from './router';
import ColorModeProvider from './theme/ColorModeProvider';
import QueryProvider from './api/QueryProvider';
import NotificationProvider from './notifications/NotificationProvider';
import ErrorFallback from './components/ErrorFallback';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.MODE });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <QueryProvider>
        <ColorModeProvider>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enAU}>
            <NotificationProvider>
              <AppRouter />
            </NotificationProvider>
          </LocalizationProvider>
        </ColorModeProvider>
      </QueryProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
