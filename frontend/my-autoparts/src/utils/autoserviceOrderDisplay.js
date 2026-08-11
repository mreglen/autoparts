import { formatServerDateTime, parseServerDate } from './serverDate';

export function formatOrderTimeRange(order) {
  const start = formatServerDateTime(order.scheduled_at);
  if (order.scheduled_end_at) {
    const end = formatServerDateTime(order.scheduled_end_at);
    return `${start} — ${end}`;
  }
  return `${start} · Окончание не указано`;
}

export function formatOrderClockRange(order) {
  const startDate = parseServerDate(order.scheduled_at);
  if (!startDate) return '—';
  const start = startDate.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (order.scheduled_end_at) {
    const endDate = parseServerDate(order.scheduled_end_at);
    if (endDate) {
      const end = endDate.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return `${start}–${end}`;
    }
  }
  return start;
}
