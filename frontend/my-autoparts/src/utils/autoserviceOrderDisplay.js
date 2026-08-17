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
  if (parts.length === 2) {
    return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
  }
  const [last, first, patronymic, ...rest] = parts;
  const firstInitial = first ? `${first.charAt(0).toUpperCase()}.` : '';
  const patronymicInitial = patronymic ? `${patronymic.charAt(0).toUpperCase()}.` : '';
  const extra = rest.length ? ` ${rest.join(' ')}` : '';
  return `${last} ${firstInitial}${patronymicInitial}${extra}`.trim();
}
