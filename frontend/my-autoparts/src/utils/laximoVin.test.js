import {
  looksLikeVin,
  normalizeGarageVinOrNull,
  normalizeVinForLookupOrNull,
  normalizeVinForSearchOrNull,
  normalizeVinOrNull,
} from './laximoVin';

describe('laximoVin', () => {
  it('accepts real VIN and chassis numbers', () => {
    expect(looksLikeVin('WBA3A5C58CF123456')).toBe(true);
    expect(looksLikeVin('XW8ZZZ7PZDG00269')).toBe(true);
    expect(normalizeVinOrNull('WBA 3A5C58 CF123456')).toBe('WBA3A5C58CF123456');
  });

  it('rejects long part numbers mistaken for VIN', () => {
    expect(looksLikeVin('059198405AB')).toBe(false);
    expect(looksLikeVin('VAG059198405')).toBe(false);
    expect(looksLikeVin('1234567890123456A')).toBe(false);
    expect(looksLikeVin('W71275ABC123')).toBe(false);
  });

  it('normalizeVinForSearchOrNull ignores brand+article queries', () => {
    expect(normalizeVinForSearchOrNull('VAG 059198405')).toBeNull();
    expect(normalizeVinForSearchOrNull('KRAFT KT 100529')).toBeNull();
    expect(normalizeVinForSearchOrNull('W712/75')).toBeNull();
    expect(normalizeVinForSearchOrNull('059198405AB')).toBeNull();
  });

  it('normalizeVinForSearchOrNull accepts spaced VIN', () => {
    expect(normalizeVinForSearchOrNull('WBA 3A5C58 CF123456')).toBe('WBA3A5C58CF123456');
    expect(normalizeVinForSearchOrNull('XW8ZZZ7PZDG00269')).toBe('XW8ZZZ7PZDG00269');
  });

  it('fixes common I/O/Q OCR typos for search and lookup', () => {
    expect(normalizeVinForSearchOrNull('IFMDU75W74ZA42366')).toBe('1FMDU75W74ZA42366');
    expect(normalizeVinForLookupOrNull('IFMDU75W74ZA42366')).toBe('1FMDU75W74ZA42366');
    expect(normalizeGarageVinOrNull('IFMDU75W74ZA42366')).toBe('1FMDU75W74ZA42366');
  });
});
