import { computeVinCheckDigit, vinCheckDigitValid } from './vinCheckDigit';

describe('vinCheckDigit', () => {
  it('validates known Chrysler VIN check digit', () => {
    expect(vinCheckDigitValid('1C4PJMBX2KD250039')).toBe(true);
  });

  it('validates known Honda VIN check digit', () => {
    expect(vinCheckDigitValid('1HGCM82633A004352')).toBe(true);
  });

  it('detects invalid check digit without rejecting short VIN', () => {
    expect(vinCheckDigitValid('1C4PJMBX3KD250039')).toBe(false);
    expect(vinCheckDigitValid('XTA211440A4264969')).toBe(false);
    expect(vinCheckDigitValid('XTA211440A426496')).toBeNull();
  });

  it('computes check digit for full VIN template', () => {
    expect(computeVinCheckDigit('1C4PJMBX2KD250039')).toBe('2');
  });
});
