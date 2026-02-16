import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import type { OutputFile } from '@/types';

export async function downloadFile(file: OutputFile): Promise<void> {
  const blob = new Blob([file.bytes as BlobPart], { type: 'application/pdf' });
  saveAs(blob, file.name);
}

export async function downloadAsZip(files: OutputFile[], zipName: string): Promise<void> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file.bytes);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, zipName);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
