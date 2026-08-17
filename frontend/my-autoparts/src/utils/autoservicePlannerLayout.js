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

export function plannerCellKey(zoneId, isoDate) {
  return `${zoneId ?? 'unassigned'}:${isoDate}`;
}

/** Default local datetime for planner → new order form (datetime-local input). */
export function plannerDefaultScheduledAtLocal(isoDate, hour = 10, minute = 0) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${isoDate}T${pad(hour)}:${pad(minute)}`;
}

export function plannerCreateOrderState(zoneId, isoDate) {
  return {
    scheduledAtLocal: plannerDefaultScheduledAtLocal(isoDate),
    workZoneId: zoneId != null ? String(zoneId) : '',
  };
}
