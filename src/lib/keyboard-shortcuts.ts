export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
  action: string;
}

export const SHORTCUTS: Shortcut[] = [
  { key: 'Escape', description: 'Go back to tool grid', action: 'navigate-back' },
  { key: 'a', ctrl: true, description: 'Select all pages', action: 'select-all' },
  { key: 'a', ctrl: true, shift: true, description: 'Deselect all pages', action: 'deselect-all' },
  { key: 'z', ctrl: true, description: 'Reset tool to original state', action: 'reset-tool' },
  { key: 's', ctrl: true, description: 'Download result', action: 'download' },
  { key: '?', description: 'Show keyboard shortcuts', action: 'show-shortcuts' },
];
