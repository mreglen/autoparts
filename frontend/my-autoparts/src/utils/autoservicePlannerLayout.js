import { parseWallClockDate } from './serverDate';

export function getWeekStart(date) {
  const value = new Date(date);
  const weekday = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - weekday);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function sortDayOrders(orders) {
  return [...(orders || [])].sort((a, b) => {
    const aTime = parseWallClockDate(a.scheduled_at)?.getTime() ?? 0;
    const bTime = parseWallClockDate(b.scheduled_at)?.getTime() ?? 0;
    if (aTime !== bTime) return aTime - bTime;
    return (a.id || 0) - (b.id || 0);
  });
}

export function plannerItemEndDate(item, now = new Date()) {
  if (!item || item.kind === 'inspection') return null;
  const start = parseWallClockDate(item.scheduled_at);
  const end = parseWallClockDate(item.scheduled_end_at);
  if (item.status === 'in_progress') {
    return end && end > now ? end : now;
  }
  if (end && (!start || end > start)) return end;
  return null;
}

export function plannerItemCoversDay(item, isoDate, now = new Date()) {
  const start = parseWallClockDate(item?.scheduled_at);
  if (!start) return false;
  const startIso = toIsoDate(start);
  if (isoDate < startIso) return false;
  const end = plannerItemEndDate(item, now);
  if (!end) return isoDate === startIso;
  return isoDate <= toIsoDate(end);
}

export function assignPlannerLanes(items, dayIsos, now = new Date()) {
  const weekEnd = dayIsos.length
    ? new Date(`${dayIsos[dayIsos.length - 1]}T23:59:59.999`)
    : null;
  const placed = [];
  for (const item of items || []) {
    const start = parseWallClockDate(item.scheduled_at);
    if (!start) continue;
    const end = plannerItemEndDate(item, now);
    let startIdx = dayIsos.indexOf(toIsoDate(start));
    let continuesFromPrevWeek = false;
    if (startIdx < 0) {
      if (!end || toIsoDate(end) < dayIsos[0]) continue;
      startIdx = 0;
      continuesFromPrevWeek = true;
    }
    let endIdx = startIdx;
    let continuesPastWeek = false;
    if (end) {
      const idx = dayIsos.indexOf(toIsoDate(end));
      if (idx >= 0) {
        endIdx = Math.max(idx, startIdx);
      } else if (weekEnd && end > weekEnd) {
        endIdx = 6;
        continuesPastWeek = true;
      }
    }
    placed.push({ item, startIdx, endIdx, continuesPastWeek, continuesFromPrevWeek });
  }
  const subCount = dayIsos.length * 2;
  placed.sort((a, b) => {
    if (a.startIdx !== b.startIdx) return a.startIdx - b.startIdx;
    const aSpan = a.endIdx - a.startIdx;
    const bSpan = b.endIdx - b.startIdx;
    if (aSpan !== bSpan) return bSpan - aSpan;
    const aTime = parseWallClockDate(a.item.scheduled_at)?.getTime() ?? 0;
    const bTime = parseWallClockDate(b.item.scheduled_at)?.getTime() ?? 0;
    if (aTime !== bTime) return aTime - bTime;
    return (a.item.id || 0) - (b.item.id || 0);
  });
  const lanes = [];
  const isFree = (lane, subStart, subEnd) => {
    for (let s = subStart; s <= subEnd; s += 1) {
      if (lane[s]) return false;
    }
    return true;
  };
  const occupy = (lane, subStart, subEnd) => {
    for (let s = subStart; s <= subEnd; s += 1) lane[s] = true;
  };
  for (const entry of placed) {
    const ranges = [[entry.startIdx * 2, entry.endIdx * 2 + 1]];
    let placedEntry = false;
    for (let laneIdx = 0; laneIdx < lanes.length && !placedEntry; laneIdx += 1) {
      for (const [subStart, subEnd] of ranges) {
        if (isFree(lanes[laneIdx], subStart, subEnd)) {
          occupy(lanes[laneIdx], subStart, subEnd);
          entry.subStart = subStart;
          entry.subEnd = subEnd;
          entry.lane = laneIdx;
          placedEntry = true;
          break;
        }
      }
    }
    if (!placedEntry) {
      const lane = new Array(subCount).fill(false);
      const [subStart, subEnd] = ranges[0];
      occupy(lane, subStart, subEnd);
      entry.subStart = subStart;
      entry.subEnd = subEnd;
      entry.lane = lanes.length;
      lanes.push(lane);
    }
  }
  return placed;
}
