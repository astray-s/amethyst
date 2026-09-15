// Original Amethyst palette. Keep shared colors here so native and web screenshots
// can be compared against a single documented source.

interface PaletteShape {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
}

const light: PaletteShape = {
  background: '#F2F3F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F6FB',
  border: '#E4E0EE',
  textPrimary: '#000000',
  textSecondary: '#625D6F',
  textTertiary: '#211C2D',
};

const dark: PaletteShape = {
  background: '#08050F',
  surface: '#17101F',
  surfaceAlt: '#251A31',
  border: '#49375C',
  textPrimary: '#FBF7FF',
  textSecondary: '#AAA0B6',
  textTertiary: '#DCCBFF',
};

export const colors = {
  light,
  dark,
  brand: {
    blue: '#7B5CD6',
    salmon: '#B68BE8',
  },
  category: {
    green: '#00CCAE',
    green10: '#E6FAF7',
    pink: '#F03FBF',
    purple: '#A757F9',
    yellow: '#FFCC00',
    blue: '#4CB2FC',
    red: '#FF5775',
    darkRed: '#FF4141',
    brown: '#C16800',
  },
  dimmed: {
    blue: '#485BA6',
    blue10: '#EDEFF6',
    yellow: '#F1B53D',
    yellow10: '#FEF8EC',
  },
  gradients: {
    pro: 'linear-gradient(90deg, #A778E7 0%, #7653C5 48%, #B8A0F2 100%)',
  },
};

export type ThemeMode = 'light' | 'dark';
export type Palette = PaletteShape;
