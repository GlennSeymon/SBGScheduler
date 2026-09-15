import { createTheme, type PaletteMode } from '@mui/material/styles';

// Brand colours pulled from SBG's live site (solarbatterygroup.com.au) compiled CSS custom
// properties — their actual design tokens, not guessed: --primary, --secondary, --tertiary,
// --surface, --muted, --grey, --red-600, --green-500. Confirms the logo-derived blue/yellow
// exactly, and supplies the rest of the semantic palette. Their site has no dark mode, so the
// dark values below extend the same brand rather than copying anything.
const brandBlue = '#1d1dff';
const brandYellow = '#ffdb14';

const lightSurface = '#f8f9fa'; // SBG --surface
const lightText = '#212529'; // SBG --tertiary
const lightTextSecondary = '#6c757d'; // SBG --grey
const lightDivider = '#e9ecef'; // SBG --muted
const lightError = '#e40014'; // SBG --red-600
const successGreen = '#00c758'; // SBG --green-500, used unchanged in both modes

const darkBackground = '#0d0e1f'; // near-black, subtly blue-tinted
const darkPaper = '#171829';
const darkPrimary = '#5a5aff'; // lightened brandBlue for AA contrast on a dark ground
const darkText = '#f1f3f5';
const darkTextSecondary = '#adb5bd';
const darkError = '#ff5252'; // lightened lightError for AA contrast on a dark ground

export function getTheme(mode: PaletteMode) {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'light' ? brandBlue : darkPrimary,
        contrastText: '#ffffff',
      },
      secondary: {
        main: brandYellow,
        contrastText: '#000000',
      },
      error: {
        main: mode === 'light' ? lightError : darkError,
      },
      success: {
        main: successGreen,
      },
      background: {
        default: mode === 'light' ? lightSurface : darkBackground,
        paper: mode === 'light' ? '#ffffff' : darkPaper,
      },
      text: {
        primary: mode === 'light' ? lightText : darkText,
        secondary: mode === 'light' ? lightTextSecondary : darkTextSecondary,
      },
      ...(mode === 'light' && { divider: lightDivider }),
    },
  });
}
