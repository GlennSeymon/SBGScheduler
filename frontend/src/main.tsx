import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import AppRouter from './router';
import { getTheme } from './theme/theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={getTheme('light')}>
      <CssBaseline />
      <AppRouter />
    </ThemeProvider>
  </StrictMode>,
);
