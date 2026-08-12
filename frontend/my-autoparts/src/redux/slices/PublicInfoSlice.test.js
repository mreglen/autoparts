import {
  DEFAULT_AUTOSERVICE_MARKUP_PERCENT,
  DEFAULT_BUYER_MARKUP_PERCENT,
  DEFAULT_SELLER_MARKUP_PERCENT,
  parseAutoserviceMarkupPercent,
  parseMarkupPercent,
  parseSellerMarkupPercent,
} from './PublicInfoSlice';

describe('PublicInfoSlice markup parsing', () => {
  it('parseMarkupPercent returns numeric value when valid', () => {
    expect(parseMarkupPercent('30', 15)).toBe(30);
    expect(parseMarkupPercent(7.5, 15)).toBe(7.5);
  });

  it('parseMarkupPercent falls back for invalid values', () => {
    expect(parseMarkupPercent(undefined, DEFAULT_BUYER_MARKUP_PERCENT)).toBe(30);
    expect(parseMarkupPercent('abc', DEFAULT_BUYER_MARKUP_PERCENT)).toBe(30);
    expect(parseMarkupPercent(-5, DEFAULT_BUYER_MARKUP_PERCENT)).toBe(30);
  });

  it('parseAutoserviceMarkupPercent reads autoservice_markup_percent', () => {
    expect(parseAutoserviceMarkupPercent({ autoservice_markup_percent: 7 })).toBe(7);
    expect(parseAutoserviceMarkupPercent({ autoservice_markup_percent: '8.5' })).toBe(8.5);
  });

  it('parseAutoserviceMarkupPercent falls back to default', () => {
    expect(parseAutoserviceMarkupPercent({})).toBe(DEFAULT_AUTOSERVICE_MARKUP_PERCENT);
    expect(parseAutoserviceMarkupPercent(null)).toBe(DEFAULT_AUTOSERVICE_MARKUP_PERCENT);
  });

  it('parseSellerMarkupPercent reads seller_markup_percent', () => {
    expect(parseSellerMarkupPercent({ seller_markup_percent: 15 })).toBe(15);
    expect(parseSellerMarkupPercent({ seller_markup_percent: '12.5' })).toBe(12.5);
  });

  it('parseSellerMarkupPercent falls back to default', () => {
    expect(parseSellerMarkupPercent({})).toBe(DEFAULT_SELLER_MARKUP_PERCENT);
  });
});
