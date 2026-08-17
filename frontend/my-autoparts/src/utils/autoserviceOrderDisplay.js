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

export function formatPersonNameWithInitials(name) {
  const text = String(name || '').trim();
  if (!text || text === '—') return '—';
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const lastName = parts[0];
  const firstName = parts[1];
  const lastInitial = lastName.charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}
