import type React from 'react';

export interface PDFTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'organize' | 'transform' | 'stamp' | 'security' | 'info';
  categoryColor: string;
  acceptsMultipleFiles: boolean;
  pipelineCompatible: boolean;
  component: React.ComponentType<Partial<ToolProps>> | null;
  estimateTime: (pageCount: number, fileSize: number) => number;
  generateFilename: (originalName: string, options: Record<string, unknown>) => string;
  validateInPipeline?: (position: number, pipeline: string[]) => ValidationResult;
}

export interface ToolProps {
  files: UploadedFile[];
  onProcess: (options: Record<string, unknown>) => Promise<void>;
  onResult: (result: ToolOutput) => void;
  onError: (error: string) => void;
  onReset: () => void;
}

export interface ToolOutput {
  files: OutputFile[];
  processingTime: number;
}

export interface OutputFile {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}

export interface CachedFile {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  cachedAt: number;
  isEncrypted: boolean;
}

export interface UploadedFile {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  fileSize: number;
  isEncrypted: boolean;
  password?: string;
}

export interface WorkerRequest {
  id: string;
  operation: string;
  pdfBytes: ArrayBuffer[];
  options: Record<string, unknown>;
}

export interface WorkerCancel {
  id: string;
  type: 'cancel';
}

export interface WorkerResponse {
  id: string;
  type: 'progress' | 'result' | 'error' | 'cancelled';
  progress?: { step: string; current: number; total: number };
  result?: { files: { name: string; bytes: ArrayBuffer; pageCount?: number }[] };
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  warnings: { message: string; type: 'error' | 'warning' | 'suggestion' }[];
}

export interface PipelinePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  tools: string[];
}

export type ThumbnailState = 'loading' | 'rendered' | 'failed';

export interface Progress {
  step: string;
  current: number;
  total: number;
}
