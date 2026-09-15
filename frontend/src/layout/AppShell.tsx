import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import sbgLogo from '../assets/sbg-logo.png';
import { useColorMode } from '../theme/ColorModeContext';

const Root = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
});

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  paddingTop: theme.spacing(2),
  paddingBottom: theme.spacing(2),
}));

const FlexContainer = styled(Container)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

const Logo = styled('img')({
  height: 58,
  width: 80,
});

const HeaderActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

const NavTabs = styled(Tabs)(({ theme }) => ({
  minHeight: theme.spacing(5),
}));

const MainContainer = styled(Container)(({ theme }) => ({
  flex: 1,
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(3),
})) as typeof Container;

const Footer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  paddingTop: theme.spacing(2),
  paddingBottom: theme.spacing(2),
})) as typeof Box;

const AppShell = () => {
  const { mode, toggleMode } = useColorMode();
  const location = useLocation();

  return (
    <Root>
      <AppBar position="static" enableColorOnDark>
        <StyledToolbar disableGutters>
          <FlexContainer maxWidth={false}>
            <Typography variant="h5" component="h1">
              Scheduler
            </Typography>
            <HeaderActions>
              <IconButton
                onClick={toggleMode}
                aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                color="inherit"
              >
                {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
              </IconButton>
              <Logo src={sbgLogo} alt="Solar Battery Group" />
            </HeaderActions>
          </FlexContainer>
        </StyledToolbar>
        <NavTabs
          value={location.pathname === '/dashboard' ? '/dashboard' : '/'}
          textColor="inherit"
          indicatorColor="secondary"
        >
          <Tab label="Jobs" value="/" component={NavLink} to="/" />
          <Tab label="Dashboard" value="/dashboard" component={NavLink} to="/dashboard" />
        </NavTabs>
      </AppBar>
      <MainContainer component="main" maxWidth={false}>
        <Outlet />
      </MainContainer>
      <Footer component="footer">
        <FlexContainer maxWidth={false}>
          <Typography variant="body2">Solution by Glenn Seymon</Typography>
          <Typography variant="body2">2026</Typography>
        </FlexContainer>
      </Footer>
    </Root>
  );
};

export default AppShell;
