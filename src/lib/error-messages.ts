export const ERRORS = {
  INVALID_PDF: 'This file is not a valid PDF.',
  ENCRYPTED_NEEDS_PASSWORD: 'This PDF is password-protected. Please enter the password.',
  WRONG_PASSWORD: 'Incorrect password. Please try again.',
  FILE_TOO_LARGE: 'This file may be too large for your browser. Try a smaller file or close other tabs.',
  WORKER_CRASHED: 'Processing failed unexpectedly. Try again with a smaller file.',
  OPERATION_CANCELLED: 'Operation cancelled.',
  CANNOT_DELETE_ALL: 'Cannot delete all pages. At least one page must remain.',
  MERGE_MIN_FILES: 'Merge requires at least 2 PDF files.',
  NON_LATIN_WARNING: 'Your text contains non-Latin characters. These may not display correctly with the standard font.',
  ANNOTATIONS_WARNING: 'Note: Annotations and form fields may not be preserved.',
} as const;
