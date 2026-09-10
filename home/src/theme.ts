import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#5B3FD3' },
    secondary: { main: '#3B82F6' },
  },
  typography: {
    fontFamily: 'Roboto, "Helvetica", "Arial", sans-serif',
  },
  shape: { borderRadius: 8 },
});

export default theme;
