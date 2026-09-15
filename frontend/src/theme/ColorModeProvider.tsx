import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PaletteMode } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ColorModeContext } from './ColorModeContext';
import { getTheme } from './theme';

const STORAGE_KEY = 'sbg-color-mode';

function isPaletteMode(value: string | null): value is PaletteMode {
  return value === 'light' || value === 'dark';
}

function getInitialMode(): PaletteMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isPaletteMode(stored) ? stored : 'light';
}

interface ColorModeProviderProps {
  children: ReactNode;
}

const ColorModeProvider = ({ children }: ColorModeProviderProps) => {
  const [mode, setMode] = useState<PaletteMode>(getInitialMode);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      toggleMode: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
    }),
    [mode],
  );

  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};

export default ColorModeProvider;
