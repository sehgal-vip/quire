import { create } from 'zustand';
import type { CachedFile, UploadedFile } from '@/types';

const MAX_CACHED_FILES = 5;

interface FileStore {
  recentFiles: CachedFile[];
  currentFiles: UploadedFile[];
  addToCache: (file: CachedFile) => void;
  setCurrentFiles: (files: UploadedFile[]) => void;
  clearCurrentFiles: () => void;
  removeCurrentFile: (id: string) => void;
}

export const useFileStore = create<FileStore>()((set) => ({
  recentFiles: [],
  currentFiles: [],

  addToCache: (file) => {
    set((state) => {
      const filtered = state.recentFiles.filter((f) => f.id !== file.id);
      const updated = [file, ...filtered].slice(0, MAX_CACHED_FILES);
      return { recentFiles: updated };
    });
  },

  setCurrentFiles: (files) => {
    set({ currentFiles: files });
  },

  clearCurrentFiles: () => {
    set({ currentFiles: [] });
  },

  removeCurrentFile: (id) => {
    set((state) => ({
      currentFiles: state.currentFiles.filter((f) => f.id !== id),
    }));
  },
}));
