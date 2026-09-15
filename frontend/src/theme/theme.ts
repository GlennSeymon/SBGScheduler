import { createTheme, type PaletteMode } from '@mui/material/styles';

// Derived from the SBG logo (https://solarbatterygroup.com.au/logo.png): the flat background
// fill is #1d1dff (brand blue), the bolt/accent colour is #ffdb14 (brand yellow).
const brandBlue = '#1d1dff';
const brandYellow = '#ffdb14';

export function getTheme(mode: PaletteMode) {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'light' ? brandBlue : '#7373ff',
        contrastText: '#ffffff',
      },
      secondary: {
        main: brandYellow,
        contrastText: '#000000',
      },
    },
  });
}
