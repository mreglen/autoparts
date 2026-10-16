import {
  assignPlannerLanes,
  getWeekStart,
  plannerInspectionSegment,
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

  it('carries pending orders without an end date to the current day', () => {
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

  it('keeps pending orders with a past end date out of the current week', () => {
    const dayIsos = [
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
      '2026-09-25', '2026-09-26', '2026-09-27',
    ];
    const entries = assignPlannerLanes([
      {
        id: 1,
        status: 'pending',
        scheduled_at: '2026-09-18T11:00:00',
        scheduled_end_at: '2026-09-19T18:00:00',
      },
    ], dayIsos, new Date('2026-09-26T12:00:00'));
    expect(entries).toHaveLength(0);
  });

  it('carries in-progress orders without an end date to the current day', () => {
    const dayIsos = [
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
      '2026-09-25', '2026-09-26', '2026-09-27',
    ];
    const entries = assignPlannerLanes([
      {
        id: 1,
        status: 'in_progress',
        scheduled_at: '2026-09-18T11:00:00',
        scheduled_end_at: null,
      },
    ], dayIsos, new Date('2026-09-26T12:00:00'));
    expect(entries).toHaveLength(1);
    expect(entries[0].startIdx).toBe(0);
    expect(entries[0].endIdx).toBe(5);
    expect(entries[0].continuesFromPrevWeek).toBe(true);
  });

  it('uses the manually set end date for in-progress orders', () => {
    const dayIsos = [
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
      '2026-09-25', '2026-09-26', '2026-09-27',
    ];
    const entries = assignPlannerLanes([
      {
        id: 1,
        status: 'in_progress',
        scheduled_at: '2026-09-21T11:00:00',
        scheduled_end_at: '2026-09-22T18:00:00',
      },
    ], dayIsos, new Date('2026-09-26T12:00:00'));
    expect(entries).toHaveLength(1);
    expect(entries[0].endIdx).toBe(1);
  });

  it('moves in-progress orders with a past end date out of the current week', () => {
    const dayIsos = [
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
      '2026-09-25', '2026-09-26', '2026-09-27',
    ];
    const entries = assignPlannerLanes([
      {
        id: 1,
        status: 'in_progress',
        scheduled_at: '2026-09-18T11:00:00',
        scheduled_end_at: '2026-09-19T18:00:00',
      },
    ], dayIsos, new Date('2026-09-26T12:00:00'));
    expect(entries).toHaveLength(0);
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

  it('marks the inspection day inside a multi-day order bar', () => {
    const dayIsos = [
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
      '2026-09-25', '2026-09-26', '2026-09-27',
    ];
    const entries = assignPlannerLanes([
      {
        id: 1,
        status: 'done',
        scheduled_at: '2026-09-21T11:00:00',
        scheduled_end_at: '2026-09-24T18:00:00',
        inspection_scheduled_at: '2026-09-22T09:30:00',
      },
    ], dayIsos, new Date('2026-09-26T12:00:00'));
    expect(entries[0].inspectionIdx).toBe(1);
    expect(plannerInspectionSegment(entries[0])).toEqual({ leftPercent: 25, widthPercent: 25 });
  });

  it('ignores an inspection date outside the order bar', () => {
    const dayIsos = [
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
      '2026-09-25', '2026-09-26', '2026-09-27',
    ];
    const entries = assignPlannerLanes([
      {
        id: 1,
        status: 'done',
        scheduled_at: '2026-09-21T11:00:00',
        scheduled_end_at: '2026-09-24T18:00:00',
        inspection_scheduled_at: '2026-09-26T09:30:00',
      },
    ], dayIsos, new Date('2026-09-26T12:00:00'));
    expect(plannerInspectionSegment(entries[0])).toBeNull();
  });
});
