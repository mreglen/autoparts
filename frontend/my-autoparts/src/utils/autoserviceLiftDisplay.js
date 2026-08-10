import { formatServerDateTime } from './serverDate';

export function formatOrderTimeRange(order) {
  const start = formatServerDateTime(order.scheduled_at);
  if (order.scheduled_end_at) {
    const end = formatServerDateTime(order.scheduled_end_at);
    return `${start} — ${end}`;
  }
  return `${start} · Окончание не указано`;
}
