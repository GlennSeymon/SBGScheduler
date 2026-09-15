import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enAU } from 'date-fns/locale';
import AppRouter from './router';
import ColorModeProvider from './theme/ColorModeProvider';
import QueryProvider from './api/QueryProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <ColorModeProvider>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enAU}>
          <AppRouter />
        </LocalizationProvider>
      </ColorModeProvider>
    </QueryProvider>
  </StrictMode>,
);
