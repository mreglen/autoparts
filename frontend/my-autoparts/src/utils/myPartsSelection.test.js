import {
  computeMyPartsHeaderStats,
  idsToSelectionSet,
  normalizePartId,
  selectionHasPart,
} from './myPartsSelection';

const parts = [
  { id: 1, price: 100, quantity: 2 },
  { id: 2, price: 50, quantity: 1 },
  { id: 3, price: 10, quantity: 3 },
];

describe('myPartsSelection', () => {
  it('normalizes string and numeric ids for checkbox matching', () => {
    const selected = idsToSelectionSet(['1', 2]);
    expect(normalizePartId('1')).toBe(1);
    expect(selectionHasPart(selected, '1')).toBe(true);
    expect(selectionHasPart(selected, 2)).toBe(true);
    expect(selectionHasPart(selected, 3)).toBe(false);
  });

  it('uses catalog totals when nothing is selected', () => {
    const stats = computeMyPartsHeaderStats({
      selectedIds: new Set(),
      products: parts.slice(0, 1),
      totalCount: 3,
      totalValue: 280,
      totalQuantity: 6,
      listFullyLoaded: false,
    });
    expect(stats).toEqual({ value: 280, quantity: 6, count: 3 });
  });

  it('sums only selected loaded rows', () => {
    const stats = computeMyPartsHeaderStats({
      selectedIds: idsToSelectionSet([1]),
      products: parts,
      totalCount: 3,
      totalValue: 280,
      totalQuantity: 6,
      listFullyLoaded: true,
    });
    expect(stats).toEqual({ value: 200, quantity: 2, count: 1 });
  });

  it('keeps catalog totals while select-all is loading or fully selected', () => {
    const pending = computeMyPartsHeaderStats({
      selectedIds: idsToSelectionSet([1]),
      products: parts.slice(0, 1),
      totalCount: 3,
      totalValue: 280,
      totalQuantity: 6,
      listFullyLoaded: false,
      selectAllPending: true,
    });
    expect(pending).toEqual({ value: 280, quantity: 6, count: 3 });

    const allSelected = computeMyPartsHeaderStats({
      selectedIds: idsToSelectionSet([1, 2, 3]),
      products: parts.slice(0, 1),
      totalCount: 3,
      totalValue: 280,
      totalQuantity: 6,
      listFullyLoaded: false,
    });
    expect(allSelected).toEqual({ value: 280, quantity: 6, count: 3 });
  });

  it('subtracts unchecked loaded rows after select-all', () => {
    const stats = computeMyPartsHeaderStats({
      selectedIds: idsToSelectionSet([2, 3]),
      products: parts.slice(0, 1),
      totalCount: 3,
      totalValue: 280,
      totalQuantity: 6,
      listFullyLoaded: false,
    });
    expect(stats).toEqual({ value: 80, quantity: 4, count: 2 });
  });
});
