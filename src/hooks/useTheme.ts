import { useEffect, useState, useCallback } from 'react';
import { STORAGE_KEYS } from '../config/constants';

export type ThemeMode = 'dark' | 'light';

export function useTheme(onPersistCloud?: (next: ThemeMode) => void) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEYS.theme);
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      onPersistCloud?.(next);
      return next;
    });
  }, [onPersistCloud]);

  return { theme, setTheme, toggleTheme };
}
