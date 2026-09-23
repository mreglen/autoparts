import { formatWallClockDateTime, parseWallClockDate } from './serverDate';

export function formatOrderTimeRange(order) {
  const start = formatWallClockDateTime(order.scheduled_at);
  if (order.scheduled_end_at) {
    const end = formatWallClockDateTime(order.scheduled_end_at);
    return `${start} — ${end}`;
  }
  return `${start} · Окончание не указано`;
}

export function formatOrderClockRange(order) {
  const startDate = parseWallClockDate(order.scheduled_at);
  if (!startDate) return '—';
  const start = startDate.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (order.scheduled_end_at) {
    const endDate = parseWallClockDate(order.scheduled_end_at);
    if (endDate) {
      const end = endDate.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return `${start}–${end}`;
    }
  }
  return start;
}

export function repairOrderNumberLabel(order) {
  if (order?.order_number) return `№ ${order.order_number}`;
  if (order?.id) return `Заявка #${order.id}`;
  return 'Заявка';
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
