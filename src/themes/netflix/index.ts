import { buildCustomColorScheme } from 'themes/utils';

/** The Netflix-inspired color scheme. */
const theme = buildCustomColorScheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#e50914'
        },
        secondary: {
            main: '#b81d24'
        },
        background: {
            default: '#000000',
            paper: '#141414'
        },
        text: {
            primary: '#f5f5f1',
            secondary: 'rgba(255, 255, 255, 0.68)'
        },
        action: {
            selectedOpacity: 0.28,
            hover: 'rgba(229, 9, 20, 0.12)'
        },
        AppBar: {
            defaultBg: '#000000'
        },
        SnackbarContent: {
            bg: '#141414',
            color: '#f5f5f1'
        }
    }
});

export default theme;
