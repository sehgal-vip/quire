import '@testing-library/jest-dom/vitest'

// Mock matchMedia for themeStore
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.location.hash for appStore
Object.defineProperty(window, 'location', {
  value: {
    ...window.location,
    hash: '',
    href: 'http://localhost/',
    origin: 'http://localhost',
    pathname: '/',
  },
  writable: true,
});

// Mock crypto.randomUUID
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...globalThis.crypto,
      randomUUID: () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
  });
}

// Mock canvas for thumbnail renderer
HTMLCanvasElement.prototype.getContext = (() => {
  return {
    drawImage: () => {},
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    resetTransform: () => {},
    scale: () => {},
    translate: () => {},
    transform: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    fill: () => {},
    stroke: () => {},
    arc: () => {},
    measureText: () => ({ width: 0 }),
    fillText: () => {},
    strokeText: () => {},
    save: () => {},
    restore: () => {},
  };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;

HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,';
