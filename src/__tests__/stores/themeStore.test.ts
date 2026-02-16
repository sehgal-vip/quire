import { useThemeStore } from '@/stores/themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    // Reset store to system mode
    useThemeStore.setState({ mode: 'system', resolved: 'light' });
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('quire-theme');
  });

  it('initializes with system mode by default', () => {
    const state = useThemeStore.getState();
    expect(state.mode).toBe('system');
  });

  it('setMode to dark applies dark class and updates state', () => {
    useThemeStore.getState().setMode('dark');
    const state = useThemeStore.getState();
    expect(state.mode).toBe('dark');
    expect(state.resolved).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setMode to light removes dark class', () => {
    useThemeStore.getState().setMode('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    useThemeStore.getState().setMode('light');
    const state = useThemeStore.getState();
    expect(state.mode).toBe('light');
    expect(state.resolved).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists mode to localStorage', () => {
    useThemeStore.getState().setMode('dark');
    expect(localStorage.getItem('quire-theme')).toBe('dark');

    useThemeStore.getState().setMode('light');
    expect(localStorage.getItem('quire-theme')).toBe('light');

    useThemeStore.getState().setMode('system');
    expect(localStorage.getItem('quire-theme')).toBe('system');
  });

  it('system mode resolves to light when matchMedia returns false', () => {
    // Default mock returns matches: false
    useThemeStore.getState().setMode('system');
    expect(useThemeStore.getState().resolved).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('system mode resolves to dark when matchMedia returns true', () => {
    // Override matchMedia to return matches: true
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    useThemeStore.getState().setMode('system');
    expect(useThemeStore.getState().resolved).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    vi.restoreAllMocks();
  });

  it('cycling through modes works correctly', () => {
    const modes: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark'];
    for (const mode of modes) {
      useThemeStore.getState().setMode(mode);
      expect(useThemeStore.getState().mode).toBe(mode);
    }
  });
});
