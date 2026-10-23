// ════════════════════════════════════════════════════════════════
// Theme — the single place the app reads or changes light/dark.
// The user's choice is remembered on this device (localStorage) and
// only ever changes when the user changes it: opening a page, loading
// the profile or refreshing never switches it.
// ════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';

const STORAGE_KEY  = 'careerpilot-theme';   // also read by the inline script in index.html
const CHANGE_EVENT = 'careerpilot-theme-change';

const isTheme = (t) => t === 'light' || t === 'dark';

export const getStoredTheme = () => {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    return isTheme(t) ? t : null;
  } catch {
    return null; // storage blocked (private mode etc.)
  }
};

export const getTheme = () =>
  (document.documentElement.classList.contains('light') ? 'light' : 'dark');

const paint = (theme) => {
  const root = document.documentElement;
  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark',  theme !== 'light');
};

// The user picked a theme: show it, remember it, tell listeners
export const setTheme = (theme) => {
  if (!isTheme(theme)) return;
  paint(theme);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* not persisted */ }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: theme }));
};

// On startup: this device's remembered choice, or dark
export const initTheme = () => paint(getStoredTheme() || 'dark');

// The account's saved theme is only a default for a device that has never
// chosen one (e.g. first login on a new computer) — it never overrides.
export const adoptAccountTheme = (theme) => {
  if (!getStoredTheme() && isTheme(theme) && theme !== getTheme()) setTheme(theme);
};

// Current theme, re-rendering when it changes anywhere in the app
export const useTheme = () => {
  const [theme, set] = useState(getTheme);
  useEffect(() => {
    const onChange = (e) => set(e.detail);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);
  return theme;
};
