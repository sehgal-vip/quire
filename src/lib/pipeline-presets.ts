import type { PipelinePreset } from '@/types';

export const PIPELINE_PRESETS: PipelinePreset[] = [
  {
    id: 'scan-cleanup',
    name: 'Scan Cleanup',
    description: 'Remove password, delete blank pages, add page numbers',
    icon: 'ScanLine',
    tools: ['unlock', 'delete-pages', 'add-page-numbers'],
  },
  {
    id: 'secure-stamp',
    name: 'Secure & Stamp',
    description: 'Add a watermark and password-protect',
    icon: 'ShieldCheck',
    tools: ['text-watermark', 'encrypt'],
  },
  {
    id: 'document-prep',
    name: 'Document Prep',
    description: 'Reorder, clean up, number, and brand your document',
    icon: 'FileCheck',
    tools: ['reorder', 'delete-pages', 'add-page-numbers', 'text-watermark'],
  },
  {
    id: 'number-lock',
    name: 'Number & Lock',
    description: 'Add page numbers and password-protect',
    icon: 'Lock',
    tools: ['add-page-numbers', 'encrypt'],
  },
];
