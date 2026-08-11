import {
  buildScheduledLocal,
  getWeekStart,
  layoutDayOrders,
  minutesFromPointer,
  parseOrderInterval,
  toIsoDate,
} from './autoservicePlannerLayout';

describe('autoservicePlannerLayout', () => {
  it('returns Monday as week start', () => {
    const start = getWeekStart(new Date('2026-08-12T12:00:00'));
    expect(start.getDay()).toBe(1);
    expect(toIsoDate(start)).toBe('2026-08-10');
  });

  it('builds scheduled local datetime from minutes', () => {
    expect(buildScheduledLocal('2026-08-11', 90)).toBe('2026-08-11T01:30');
  });

  it('uses default duration when end is missing', () => {
    const interval = parseOrderInterval({ scheduled_at: '2026-08-11T10:00:00' });
    expect(interval.startMinutes).toBe(10 * 60);
    expect(interval.durationMinutes).toBe(60);
  });

  it('lays out overlapping orders side by side', () => {
    const layouts = layoutDayOrders([
      { id: 1, scheduled_at: '2026-08-11T10:00:00', scheduled_end_at: '2026-08-11T11:00:00' },
      { id: 2, scheduled_at: '2026-08-11T10:30:00', scheduled_end_at: '2026-08-11T11:30:00' },
    ]);
    expect(layouts).toHaveLength(2);
    expect(layouts[0].columnIndex).toBe(0);
    expect(layouts[1].columnIndex).toBe(1);
    expect(layouts[0].columnCount).toBe(2);
  });

  it('calculates minutes from pointer position', () => {
    const minutes = minutesFromPointer(360, { top: 0, height: 720 });
    expect(minutes).toBe(720);
  });
});
