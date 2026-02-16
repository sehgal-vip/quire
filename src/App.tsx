import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ToolGrid } from '@/components/common/ToolGrid';
import { KeyboardShortcutsHelp } from '@/components/common/KeyboardShortcutsHelp';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import PipelineBuilder from '@/components/pipeline/PipelineBuilder';
import { PipelineExecution } from '@/components/pipeline/PipelineExecution';
import { useAppStore } from '@/stores/appStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { TOOL_MAP } from '@/lib/constants';
import { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';

export default function App() {
  const { currentView, currentToolId, setView } = useAppStore();
  const isPipelineExecuting = usePipelineStore((s) => s.isExecuting);
  const isDark = useThemeStore((s) => s.resolved === 'dark');
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Hash change listener
  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'pipeline') {
        setView('pipeline');
      } else if (hash) {
        setView('tool', hash);
      } else {
        setView('grid');
      }
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, [setView]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.key === 'Escape') {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (currentView !== 'grid') { setView('grid'); return; }
      }
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((s) => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentView, setView, showShortcuts]);

  const renderView = useCallback(() => {
    if (currentView === 'grid') return <ToolGrid />;

    if (currentView === 'tool' && currentToolId) {
      const tool = TOOL_MAP[currentToolId];
      if (!tool) return <ToolGrid />;

      return (
        <div className="max-w-tool mx-auto">
          <button
            onClick={() => setView('grid')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4 focus-ring rounded-lg px-2 py-1"
          >
            <ArrowLeft size={16} />
            <span className="text-sm">Back to tools</span>
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">{tool.name}</h2>
          {tool.component ? (
            <ErrorBoundary>
              <tool.component />
            </ErrorBoundary>
          ) : (
            <div className="text-center py-20 text-gray-400 dark:text-gray-500">
              <p className="text-lg">Coming soon</p>
              <p className="text-sm mt-1">This tool is not yet implemented.</p>
            </div>
          )}
        </div>
      );
    }

    if (currentView === 'pipeline') {
      if (isPipelineExecuting) {
        return (
          <ErrorBoundary>
            <PipelineExecution />
          </ErrorBoundary>
        );
      }
      return (
        <ErrorBoundary>
          <PipelineBuilder />
        </ErrorBoundary>
      );
    }

    return <ToolGrid />;
  }, [currentView, currentToolId, setView, isPipelineExecuting]);

  return (
    <>
      <Layout onShowShortcuts={() => setShowShortcuts(true)}>
        {renderView()}
      </Layout>
      <KeyboardShortcutsHelp isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <Toaster position="top-right" toastOptions={{
        duration: 4000,
        style: {
          borderRadius: '8px',
          fontSize: '14px',
          background: isDark ? '#1f2937' : '#fff',
          color: isDark ? '#f3f4f6' : '#111827',
          border: isDark ? '1px solid #374151' : 'none',
        },
      }} />
    </>
  );
}
