import {
  dedupeRosskoParts,
  rosskoPartDedupeKey,
  rosskoPartMatchesOem,
  buildRosskoOemSearchQueries,
  hasRosskoInStock,
} from './rosskoHelpers';

describe('rosskoHelpers dedupe', () => {
  it('uses guid as dedupe key', () => {
    expect(rosskoPartDedupeKey({ guid: 'abc-123', brand: 'NGK', partnumber: '1' })).toBe('abc-123');
  });

  it('removes duplicate parts and merges stocks', () => {
    const parts = [
      {
        guid: 'same-guid',
        brand: 'NGK',
        partnumber: 'LFR6B',
        stocks: { stock: { id: 's1', price: '100', count: '2' } },
      },
      {
        guid: 'same-guid',
        brand: 'NGK',
        partnumber: 'LFR6B',
        stocks: { stock: { id: 's2', price: '110', count: '5' } },
      },
    ];

    const deduped = dedupeRosskoParts(parts);
    expect(deduped).toHaveLength(1);
    const stocks = deduped[0].stocks.stock;
    expect(Array.isArray(stocks) ? stocks.length : 1).toBe(2);
  });

  it('dedupes by brand and normalized article when guid is missing', () => {
    const parts = [
      { brand: 'MANN', partnumber: 'W-712', stocks: { stock: { id: '1', price: '10', count: '1' } } },
      { brand: 'MANN', partnumber: 'W712', stocks: { stock: { id: '2', price: '12', count: '3' } } },
    ];
    expect(dedupeRosskoParts(parts)).toHaveLength(1);
  });

  it('matches oem with partial article overlap', () => {
    expect(rosskoPartMatchesOem({ partnumber: '0446502230' }, '446502230')).toBe(true);
    expect(rosskoPartMatchesOem({ partnumber: 'ABC' }, 'XYZ')).toBe(false);
  });

  it('builds oem search queries with vehicle brand', () => {
    expect(buildRosskoOemSearchQueries('04465-02230', 'TOYOTA')).toEqual([
      '04465-02230',
      'TOYOTA 04465-02230',
      '0446502230',
      'TOYOTA 0446502230',
    ]);
  });

  it('detects in-stock offers only when count is positive', () => {
    expect(hasRosskoInStock({
      stocks: { stock: { id: '1', price: '100', count: '0' } },
    })).toBe(false);
    expect(hasRosskoInStock({
      stocks: { stock: { id: '1', price: '100', count: '2' } },
    })).toBe(true);
  });
});
