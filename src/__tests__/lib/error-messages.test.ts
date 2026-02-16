import { ERRORS } from '@/lib/error-messages';

describe('ERRORS', () => {
  it('has all required error messages', () => {
    expect(ERRORS.INVALID_PDF).toBeTruthy();
    expect(ERRORS.ENCRYPTED_NEEDS_PASSWORD).toBeTruthy();
    expect(ERRORS.WRONG_PASSWORD).toBeTruthy();
    expect(ERRORS.FILE_TOO_LARGE).toBeTruthy();
    expect(ERRORS.WORKER_CRASHED).toBeTruthy();
    expect(ERRORS.OPERATION_CANCELLED).toBeTruthy();
    expect(ERRORS.CANNOT_DELETE_ALL).toBeTruthy();
    expect(ERRORS.MERGE_MIN_FILES).toBeTruthy();
    expect(ERRORS.NON_LATIN_WARNING).toBeTruthy();
    expect(ERRORS.ANNOTATIONS_WARNING).toBeTruthy();
  });

  it('INVALID_PDF contains "not a valid PDF"', () => {
    expect(ERRORS.INVALID_PDF).toContain('not a valid PDF');
  });

  it('MERGE_MIN_FILES mentions 2 files', () => {
    expect(ERRORS.MERGE_MIN_FILES).toContain('2');
  });

  it('CANNOT_DELETE_ALL mentions at least one page', () => {
    expect(ERRORS.CANNOT_DELETE_ALL).toContain('At least one page');
  });
});
