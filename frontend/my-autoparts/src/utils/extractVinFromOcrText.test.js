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

  it('maps Latin O and I to 0 and 1 in a 17-char VIN', () => {
    const result = extractVinFromOcrText('JHMGD189O8S2I2467');
    expect(result?.normalized).toBe('JHMGD18908S212467');
  });

  it('returns null when no VIN-like sequence found', () => {
    expect(extractVinFromOcrText('hello world')).toBeNull();
  });

  it('extracts AvtoVAZ VIN from noisy handwritten OCR', () => {
    const result = extractVinFromOcrText('XTA 211440 A4264969');
    expect(result?.normalized).toBe('XTA211440A4264969');
  });

  it('extracts VIN photographed from a screen in lowercase', () => {
    const result = extractVinFromOcrText('jhmgd18908s212467');
    expect(result?.normalized).toBe('JHMGD18908S212467');
  });

  it('prefers longest valid candidate in mixed text', () => {
    const result = extractVinFromOcrText('ABC JHMGD18908S212467 XYZ1234567890');
    expect(result?.normalized).toBe('JHMGD18908S212467');
  });
});
