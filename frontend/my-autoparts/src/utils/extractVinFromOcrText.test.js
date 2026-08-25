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

  it('extracts Chrysler VIN from lowercase screen text', () => {
    const result = extractVinFromOcrText('1c4pjmbx2kd250039');
    expect(result?.normalized).toBe('1C4PJMBX2KD250039');
  });

  it('prefers longest valid candidate in mixed text', () => {
    const result = extractVinFromOcrText('ABC 1C4PJMBX2KD250039 XYZ1234567890');
    expect(result?.normalized).toBe('1C4PJMBX2KD250039');
  });

  it('prefers candidate with valid check digit when OCR noise differs', () => {
    const clean = extractVinFromOcrText('1C4PJMBX2KD250039');
    const noisy = extractVinFromOcrText('1C4PJMBX3KD250039');
    expect(clean?.score).toBeGreaterThan(noisy?.score || 0);
  });

  it('rejects obvious non-VIN part numbers in noisy text', () => {
    expect(extractVinFromOcrText('12345678901234567')).toBeNull();
  });

  it('extracts Chevrolet STS VIN from OCR text', () => {
    const result = extractVinFromOcrText('XUFTA48EJEN034395');
    expect(result?.normalized).toBe('XUFTA48EJEN034395');
  });

  it('maps Cyrillic lookalikes from STS OCR', () => {
    const result = extractVinFromOcrText('ХUFTА48EJEN034395');
    expect(result?.normalized).toBe('XUFTA48EJEN034395');
  });
});
