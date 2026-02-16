import { useFileStore } from '@/stores/fileStore';

function makeCachedFile(id: string) {
  return { id, name: `${id}.pdf`, bytes: new Uint8Array([1, 2]), pageCount: 1, cachedAt: Date.now(), isEncrypted: false };
}

function makeUploadedFile(id: string) {
  return { id, name: `${id}.pdf`, bytes: new Uint8Array([1, 2]), pageCount: 1, fileSize: 2, isEncrypted: false };
}

describe('fileStore', () => {
  beforeEach(() => {
    useFileStore.setState({ recentFiles: [], currentFiles: [] });
  });

  it('T-ST-03: FIFO cache max 5', () => {
    for (let i = 1; i <= 6; i++) {
      useFileStore.getState().addToCache(makeCachedFile(`f${i}`));
    }
    expect(useFileStore.getState().recentFiles).toHaveLength(5);
    expect(useFileStore.getState().recentFiles[0].id).toBe('f6');
  });

  it('T-ST-04: deduplicates by ID', () => {
    useFileStore.getState().addToCache(makeCachedFile('f1'));
    useFileStore.getState().addToCache(makeCachedFile('f1'));
    expect(useFileStore.getState().recentFiles).toHaveLength(1);
  });

  it('setCurrentFiles sets files', () => {
    const files = [makeUploadedFile('a'), makeUploadedFile('b')];
    useFileStore.getState().setCurrentFiles(files);
    expect(useFileStore.getState().currentFiles).toHaveLength(2);
  });

  it('clearCurrentFiles empties', () => {
    useFileStore.getState().setCurrentFiles([makeUploadedFile('a')]);
    useFileStore.getState().clearCurrentFiles();
    expect(useFileStore.getState().currentFiles).toHaveLength(0);
  });

  it('removeCurrentFile removes by id', () => {
    useFileStore.getState().setCurrentFiles([makeUploadedFile('a'), makeUploadedFile('b')]);
    useFileStore.getState().removeCurrentFile('a');
    expect(useFileStore.getState().currentFiles).toHaveLength(1);
    expect(useFileStore.getState().currentFiles[0].id).toBe('b');
  });
});
