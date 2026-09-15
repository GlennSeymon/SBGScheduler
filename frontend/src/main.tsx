import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppRouter from './router';
import ColorModeProvider from './theme/ColorModeProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorModeProvider>
      <AppRouter />
    </ColorModeProvider>
  </StrictMode>,
);
