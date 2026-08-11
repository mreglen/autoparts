export const MINUTES_IN_DAY = 24 * 60;
export const DEFAULT_ORDER_MINUTES = 60;

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

export function parseOrderInterval(order) {
  const startDate = new Date(order.scheduled_at);
  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
  let endMinutes = startMinutes + DEFAULT_ORDER_MINUTES;

  if (order.scheduled_end_at) {
    const endDate = new Date(order.scheduled_end_at);
    const parsedEnd = endDate.getHours() * 60 + endDate.getMinutes();
    if (parsedEnd > startMinutes) {
      endMinutes = parsedEnd;
    }
  }

  endMinutes = Math.min(endMinutes, MINUTES_IN_DAY);
  const durationMinutes = Math.max(endMinutes - startMinutes, 15);

  return {
    startMinutes,
    endMinutes: startMinutes + durationMinutes,
    durationMinutes,
  };
}

function intervalsOverlap(a, b) {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

export function layoutDayOrders(orders) {
  const parsed = (orders || []).map((order) => ({
    order,
    ...parseOrderInterval(order),
    columnIndex: 0,
    columnCount: 1,
  })).sort((a, b) => (
    a.startMinutes - b.startMinutes || a.order.id - b.order.id
  ));

  parsed.forEach((item, index) => {
    const overlapping = parsed.filter((other, otherIndex) => (
      otherIndex !== index && intervalsOverlap(item, other)
    ));
    const usedColumns = new Set(
      overlapping
        .filter((other) => other.startMinutes <= item.startMinutes)
        .map((other) => other.columnIndex),
    );
    let columnIndex = 0;
    while (usedColumns.has(columnIndex)) columnIndex += 1;
    item.columnIndex = columnIndex;
    const columnCount = Math.max(
      columnIndex + 1,
      ...overlapping.map((other) => other.columnIndex + 1),
    );
    item.columnCount = columnCount;
    overlapping.forEach((other) => {
      other.columnCount = Math.max(other.columnCount, columnCount);
    });
  });

  return parsed.map((item) => ({
    order: item.order,
    topPercent: (item.startMinutes / MINUTES_IN_DAY) * 100,
    heightPercent: (item.durationMinutes / MINUTES_IN_DAY) * 100,
    columnIndex: item.columnIndex,
    columnCount: item.columnCount,
  }));
}

export function minutesFromPointer(clientY, rect) {
  const offset = Math.max(0, Math.min(clientY - rect.top, rect.height));
  const ratio = rect.height > 0 ? offset / rect.height : 0;
  const minutes = Math.floor(ratio * MINUTES_IN_DAY);
  const rounded = Math.floor(minutes / 15) * 15;
  return Math.max(0, Math.min(rounded, MINUTES_IN_DAY - 15));
}

export function formatMinutesLabel(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function buildScheduledLocal(isoDate, totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${isoDate}T${hours}:${minutes}`;
}
