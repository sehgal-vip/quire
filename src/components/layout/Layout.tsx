import { useEffect, type ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { useProcessingStore } from '@/stores/processingStore';
import { usePipelineStore } from '@/stores/pipelineStore';

interface LayoutProps {
  children: ReactNode;
  onShowShortcuts: () => void;
}

export function Layout({ children, onShowShortcuts }: LayoutProps) {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (
        useProcessingStore.getState().status === 'processing' ||
        usePipelineStore.getState().isExecuting
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header onShowShortcuts={onShowShortcuts} />
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 py-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
