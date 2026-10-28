import { useCallback, useEffect, useState } from 'react';

export type SiteTheme = 'dark' | 'light';

const STORAGE_KEY = 'ae-theme';

function readStoredTheme(): SiteTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(theme: SiteTheme, animate = false) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-anim');
    window.setTimeout(() => root.classList.remove('theme-anim'), 450);
  }
  root.dataset.theme = theme;
}

/** Visual theme for the public site only. Dark + gold is the default. */
export function useSiteTheme() {
  const [theme, setTheme] = useState<SiteTheme>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    const next: SiteTheme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage can be unavailable (private mode); the theme still switches */
    }
    setTheme(next);
  }, [theme]);

  return { theme, toggle };
}
