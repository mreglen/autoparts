import {
  assignPlannerLanes,
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

  it('keeps orders started before the week and ending inside it', () => {
    const dayIsos = [
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
      '2026-09-25', '2026-09-26', '2026-09-27',
    ];
    const entries = assignPlannerLanes([
      {
        id: 1,
        status: 'done',
        scheduled_at: '2026-09-18T11:00:00',
        scheduled_end_at: '2026-09-23T18:00:00',
      },
    ], dayIsos, new Date('2026-09-26T12:00:00'));
    expect(entries).toHaveLength(1);
    expect(entries[0].startIdx).toBe(0);
    expect(entries[0].endIdx).toBe(2);
    expect(entries[0].continuesFromPrevWeek).toBe(true);
  });

  it('carries unfinished orders started before the week to the current day', () => {
    const dayIsos = [
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
      '2026-09-25', '2026-09-26', '2026-09-27',
    ];
    const entries = assignPlannerLanes([
      {
        id: 1,
        status: 'pending',
        scheduled_at: '2026-09-18T11:00:00',
        scheduled_end_at: null,
      },
    ], dayIsos, new Date('2026-09-26T12:00:00'));
    expect(entries).toHaveLength(1);
    expect(entries[0].startIdx).toBe(0);
    expect(entries[0].endIdx).toBe(5);
    expect(entries[0].continuesFromPrevWeek).toBe(true);
  });

  it('keeps pending orders scheduled later this week on their own day', () => {
    const dayIsos = [
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
      '2026-09-25', '2026-09-26', '2026-09-27',
    ];
    const entries = assignPlannerLanes([
      {
        id: 1,
        status: 'pending',
        scheduled_at: '2026-09-24T11:00:00',
        scheduled_end_at: null,
      },
    ], dayIsos, new Date('2026-09-21T09:00:00'));
    expect(entries).toHaveLength(1);
    expect(entries[0].startIdx).toBe(3);
    expect(entries[0].endIdx).toBe(3);
  });
});
