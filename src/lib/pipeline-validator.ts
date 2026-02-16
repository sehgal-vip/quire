import type { ValidationResult } from '@/types';

export function validatePipeline(toolIds: string[]): ValidationResult {
  const warnings: ValidationResult['warnings'] = [];

  if (toolIds.length > 5) {
    warnings.push({ message: 'Pipeline is limited to 5 steps to ensure reliable performance.', type: 'error' });
  }

  const unlockIdx = toolIds.indexOf('unlock');
  if (unlockIdx > 0) {
    warnings.push({ message: 'Unlock PDF should be the first step so other tools can read the PDF content.', type: 'warning' });
  }

  const encryptIdx = toolIds.indexOf('encrypt');
  if (encryptIdx >= 0 && encryptIdx < toolIds.length - 1) {
    warnings.push({ message: 'Encrypt should be the last step. Tools after it would need the password to process the PDF.', type: 'warning' });
  }

  const deleteIdx = toolIds.indexOf('delete-pages');
  const pageNumIdx = toolIds.indexOf('add-page-numbers');
  if (deleteIdx >= 0 && pageNumIdx >= 0 && deleteIdx > pageNumIdx) {
    warnings.push({ message: 'Consider moving Delete Pages before Add Page Numbers so numbers are correct after deletion.', type: 'suggestion' });
  }

  const seen = new Set<string>();
  for (const id of toolIds) {
    if (seen.has(id)) {
      warnings.push({ message: `'${id}' appears twice in the pipeline. Is that intentional?`, type: 'suggestion' });
    }
    seen.add(id);
  }

  const hasErrors = warnings.some((w) => w.type === 'error');
  return { valid: !hasErrors, warnings };
}
