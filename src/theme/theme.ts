import { createTheme, type Theme } from '@mui/material/styles';
import { dark, ember, fonts, light, radii, signal } from './tokens';

declare module '@mui/material/styles' {
  interface Palette {
    signal: {
      up: string;
      upSoft: string;
      down: string;
      downSoft: string;
      gold: string;
    };
    surface2: string;
    /** Row separators inside a list — quieter than `divider`, which draws cards. */
    hairline: string;
    /** Third-tier text: rank numerals below the podium, micro-labels. */
    textMute: string;
  }
  interface PaletteOptions {
    signal?: Palette['signal'];
    surface2?: string;
    hairline?: string;
    textMute?: string;
  }
  interface TypographyVariants {
    display: React.CSSProperties;
    numeral: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    display?: React.CSSProperties;
    numeral?: React.CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    display: true;
    numeral: true;
  }
}

export type ColorMode = 'dark' | 'light';

export function buildTheme(mode: ColorMode): Theme {
  const c = mode === 'dark' ? dark : light;
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: { main: ember[500], light: ember[400], dark: ember[600], contrastText: '#FFFFFF' },
      secondary: { main: signal.up, contrastText: '#1A1413' },
      background: { default: c.bg, paper: c.surface },
      text: { primary: c.text, secondary: c.textDim },
      divider: c.border,
      surface2: c.surface2,
      hairline: c.hairline,
      textMute: c.textMute,
      signal,
      error: { main: ember[400] },
      success: { main: signal.up },
    },

    shape: { borderRadius: radii.md },

    /**
     * Georgian has no uppercase, so hierarchy comes from weight, size and
     * colour — never from `text-transform`. Georgian also runs visually denser
     * than Latin, hence 1.55 body leading and a touch of tracking at small
     * sizes.
     */
    typography: {
      fontFamily: fonts.body,
      display: {
        fontFamily: fonts.display,
        fontSize: '2.75rem', // 44
        fontWeight: 700,
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
      },
      numeral: {
        fontFamily: fonts.body,
        fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.03em',
        lineHeight: 1,
      },
      h1: { fontFamily: fonts.display, fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.01em' },
      h2: { fontFamily: fonts.display, fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.25 },
      h3: { fontSize: '1.1875rem', fontWeight: 600, lineHeight: 1.3 },
      h4: { fontSize: '1.0625rem', fontWeight: 600, lineHeight: 1.35 },
      body1: { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.55 },
      body2: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.55 },
      caption: { fontSize: '0.8125rem', fontWeight: 400, lineHeight: 1.5, letterSpacing: '0.01em' },
      button: { fontSize: '0.9375rem', fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': { colorScheme: mode },
          body: {
            backgroundColor: c.bg,
            color: c.text,
            WebkitFontSmoothing: 'antialiased',
            overscrollBehaviorY: 'none',
          },
          // Elevation comes from layered surfaces and 1px borders, never from
          // MUI's default gradient overlays.
          '::selection': { background: ember[500], color: '#fff' },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none', border: `1px solid ${c.border}` },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: radii.pill, minHeight: 44, paddingInline: 18 },
          sizeSmall: { minHeight: 36, paddingInline: 14 },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { minWidth: 44, minHeight: 44 } },
      },
      MuiTab: {
        styleOverrides: { root: { textTransform: 'none', minHeight: 48, fontWeight: 600 } },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: radii.md, backgroundColor: c.surface },
        },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: radii.lg, backgroundImage: 'none' } },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { backgroundColor: isDark ? dark.surface2 : '#2A2321', fontSize: 13 },
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: { root: { minWidth: 56, paddingTop: 8 } },
      },
      MuiSkeleton: {
        styleOverrides: { root: { backgroundColor: c.surface2 } },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: c.border } },
      },
    },
  });
}
