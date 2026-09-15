import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import { colors, type Palette } from './tokens';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  toggle: () => void;
  palette: Palette;
  colors: typeof colors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Dark is the default because the glowing stone and glass surfaces are designed
// around a low-luminance background.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')),
      palette: colors[mode],
      colors,
    }),
    [mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
