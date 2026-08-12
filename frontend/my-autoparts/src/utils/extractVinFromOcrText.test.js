import { extractVinFromOcrText } from './extractVinFromOcrText';

describe('extractVinFromOcrText', () => {
  it('extracts valid VIN from clean OCR text', () => {
    const result = extractVinFromOcrText('JHMGD18908S212467');
    expect(result?.normalized).toBe('JHMGD18908S212467');
  });

  it('extracts VIN from noisy OCR with spaces and punctuation', () => {
    const result = extractVinFromOcrText('VIN: JHMGD18908S212467  HONDA');
    expect(result?.normalized).toBe('JHMGD18908S212467');
  });

  it('fixes common OCR confusion O to 0 in middle of VIN', () => {
    const result = extractVinFromOcrText('JHMGD189O8S212467');
    expect(result?.normalized).toBe('JHMGD18908S212467');
  });

  it('returns null when no VIN-like sequence found', () => {
    expect(extractVinFromOcrText('hello world')).toBeNull();
  });

  it('prefers longest valid candidate in mixed text', () => {
    const result = extractVinFromOcrText('ABC JHMGD18908S212467 XYZ1234567890');
    expect(result?.normalized).toBe('JHMGD18908S212467');
  });
});
