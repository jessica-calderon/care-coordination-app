import { useState, useEffect } from 'react';

const STORAGE_KEY_THEME = 'care-app-theme';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first
    const stored = localStorage.getItem(STORAGE_KEY_THEME);
    let initialTheme: Theme;
    
    if (stored === 'light' || stored === 'dark') {
      initialTheme = stored;
    } else {
      // If no stored preference, check system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        initialTheme = 'dark';
      } else {
        initialTheme = 'light';
      }
    }
    
    // Apply theme synchronously to prevent flash
    document.documentElement.setAttribute('data-theme', initialTheme);
    
    return initialTheme;
  });

  useEffect(() => {
    // Apply theme to document (in case it changed)
    document.documentElement.setAttribute('data-theme', theme);
    
    // Persist to localStorage
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return { theme, toggleTheme };
}

