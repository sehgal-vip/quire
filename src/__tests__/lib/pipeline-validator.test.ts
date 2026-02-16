import { validatePipeline } from '@/lib/pipeline-validator';

describe('validatePipeline', () => {
  it('T-PV-01: rejects pipeline with more than 5 tools', () => {
    const result = validatePipeline(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(result.valid).toBe(false);
    expect(result.warnings.some(w => w.message.includes('5 steps'))).toBe(true);
  });

  it('T-PV-02: warns when unlock is not first', () => {
    const result = validatePipeline(['rotate', 'unlock']);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.message.includes('Unlock') && w.type === 'warning')).toBe(true);
  });

  it('T-PV-03: warns when encrypt is not last', () => {
    const result = validatePipeline(['encrypt', 'rotate']);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.message.includes('Encrypt') && w.type === 'warning')).toBe(true);
  });

  it('T-PV-04: suggests moving delete before page numbers', () => {
    const result = validatePipeline(['add-page-numbers', 'delete-pages']);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.message.includes('Delete Pages') && w.type === 'suggestion')).toBe(true);
  });

  it('T-PV-05: flags duplicate tools', () => {
    const result = validatePipeline(['rotate', 'rotate']);
    expect(result.warnings.some(w => w.message.includes('twice') && w.type === 'suggestion')).toBe(true);
  });

  it('T-PV-06: valid pipeline returns no warnings', () => {
    const result = validatePipeline(['unlock', 'rotate', 'encrypt']);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('T-PV-07: empty pipeline is valid', () => {
    const result = validatePipeline([]);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('unlock as first step has no warning', () => {
    const result = validatePipeline(['unlock', 'rotate']);
    expect(result.warnings.filter(w => w.message.includes('Unlock'))).toHaveLength(0);
  });

  it('encrypt as last step has no warning', () => {
    const result = validatePipeline(['rotate', 'encrypt']);
    expect(result.warnings.filter(w => w.message.includes('Encrypt'))).toHaveLength(0);
  });
});
