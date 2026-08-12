import {
  applyMarkup,
  formatPriceRub,
  truncateRubles,
} from './newPartStockUtils';

describe('newPartStockUtils ruble pricing', () => {
  it('truncateRubles floors without rounding up', () => {
    expect(truncateRubles(1234.99)).toBe(1234);
    expect(truncateRubles(1234.01)).toBe(1234);
    expect(truncateRubles(0)).toBe(0);
  });

  it('applyMarkup truncates kopecks after markup', () => {
    expect(applyMarkup(100, 17.5)).toBe(117);
    expect(applyMarkup(99.99, 10)).toBe(108);
  });

  it('formatPriceRub shows whole rubles only', () => {
    expect(formatPriceRub(1234.99)).toBe('1\u00a0234');
    expect(formatPriceRub(0)).toBe('—');
  });
});
