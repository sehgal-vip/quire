import { Lock } from 'lucide-react';

export function Footer() {
  return (
    <footer className="py-4 text-center">
      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1.5">
        <Lock size={12} />
        Your files never leave your browser. All processing happens locally.
      </p>
    </footer>
  );
}
