import {
  getWeekStart,
  sortDayOrders,
  toIsoDate,
} from './autoservicePlannerLayout';

describe('autoservicePlannerLayout', () => {
  it('returns Monday as week start', () => {
    const start = getWeekStart(new Date('2026-08-12T12:00:00'));
    expect(start.getDay()).toBe(1);
    expect(toIsoDate(start)).toBe('2026-08-10');
  });

  it('sorts day orders by scheduled time', () => {
    const sorted = sortDayOrders([
      { id: 2, scheduled_at: '2026-08-11T14:00:00' },
      { id: 1, scheduled_at: '2026-08-11T10:00:00' },
    ]);
    expect(sorted.map((order) => order.id)).toEqual([1, 2]);
  });
});
