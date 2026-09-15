import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

const Root = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: theme.spacing(2),
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(8),
}));

const ErrorFallback = () => (
  <Container maxWidth="sm">
    <Root>
      <Typography variant="h5" component="h1">
        Something went wrong
      </Typography>
      <Typography variant="body1" color="text.secondary">
        An unexpected error occurred and has been reported. Try reloading the page.
      </Typography>
      <Button variant="contained" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </Root>
  </Container>
);

export default ErrorFallback;
