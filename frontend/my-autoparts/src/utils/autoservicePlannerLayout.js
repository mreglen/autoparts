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
    const aTime = new Date(a.scheduled_at).getTime();
    const bTime = new Date(b.scheduled_at).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return (a.id || 0) - (b.id || 0);
  });
}

export function plannerItemEndDate(item, now = new Date()) {
  if (!item || item.kind === 'inspection') return null;
  const start = item.scheduled_at ? new Date(item.scheduled_at) : null;
  const end = item.scheduled_end_at ? new Date(item.scheduled_end_at) : null;
  if (item.status === 'in_progress') {
    return end && end > now ? end : now;
  }
  if (end && (!start || end > start)) return end;
  return null;
}

export function assignPlannerLanes(items, dayIsos, now = new Date()) {
  const weekEnd = dayIsos.length
    ? new Date(`${dayIsos[dayIsos.length - 1]}T23:59:59.999`)
    : null;
  const placed = [];
  for (const item of items || []) {
    const start = item.scheduled_at ? new Date(item.scheduled_at) : null;
    if (!start) continue;
    const startIdx = dayIsos.indexOf(toIsoDate(start));
    if (startIdx < 0) continue;
    let endIdx = startIdx;
    let continuesPastWeek = false;
    const end = plannerItemEndDate(item, now);
    if (end) {
      const idx = dayIsos.indexOf(toIsoDate(end));
      if (idx >= 0) {
        endIdx = Math.max(idx, startIdx);
      } else if (weekEnd && end > weekEnd) {
        endIdx = 6;
        continuesPastWeek = true;
      }
    }
    placed.push({ item, startIdx, endIdx, continuesPastWeek });
  }
  placed.sort((a, b) => {
    if (a.startIdx !== b.startIdx) return a.startIdx - b.startIdx;
    const aTime = new Date(a.item.scheduled_at).getTime();
    const bTime = new Date(b.item.scheduled_at).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return (a.item.id || 0) - (b.item.id || 0);
  });
  const lanes = [];
  for (const entry of placed) {
    let laneIdx = lanes.findIndex(
      (lane) => lane.every((other) => entry.startIdx > other.endIdx),
    );
    if (laneIdx < 0) {
      laneIdx = lanes.length;
      lanes.push([]);
    }
    lanes[laneIdx].push(entry);
    entry.lane = laneIdx;
  }
  return placed;
}
