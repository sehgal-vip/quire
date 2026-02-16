import { create } from 'zustand';

type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeStore {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return getSystemTheme();
  return mode;
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

function loadMode(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'system';
  const stored = localStorage.getItem('quire-theme');
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

export const useThemeStore = create<ThemeStore>((set) => {
  const mode = loadMode();
  const resolved = resolveTheme(mode);
  applyTheme(resolved);

  // Listen for OS preference changes when in system mode
  if (typeof window !== 'undefined') {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    mql.addEventListener('change', () => {
      const state = useThemeStore.getState();
      if (state.mode === 'system') {
        const newResolved = getSystemTheme();
        applyTheme(newResolved);
        set({ resolved: newResolved });
      }
    });
  }

  return {
    mode,
    resolved,
    setMode: (newMode) => {
      const newResolved = resolveTheme(newMode);
      applyTheme(newResolved);
      try { localStorage.setItem('quire-theme', newMode); } catch {}
      set({ mode: newMode, resolved: newResolved });
    },
  };
});
