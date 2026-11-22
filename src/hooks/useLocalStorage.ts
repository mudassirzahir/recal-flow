import { useState, useCallback } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    const fallback =
      typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : fallback;
    } catch {
      return fallback;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(nextValue));
        } catch {
          // Ignore storage quota or private browsing errors
        }
        return nextValue;
      });
    },
    [key]
  );

  return [storedValue, setValue] as const;
}
