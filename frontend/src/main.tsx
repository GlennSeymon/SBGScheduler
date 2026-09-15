import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppRouter from './router';
import ColorModeProvider from './theme/ColorModeProvider';
import QueryProvider from './api/QueryProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <ColorModeProvider>
        <AppRouter />
      </ColorModeProvider>
    </QueryProvider>
  </StrictMode>,
);
