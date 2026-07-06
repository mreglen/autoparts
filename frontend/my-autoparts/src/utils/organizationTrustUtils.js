export function formatResponseMinutes(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 60) return `${Math.max(1, Math.round(value))} мин`;
  if (value < 60 * 24) {
    const hours = Math.round(value / 60);
    return `${hours} ч`;
  }
  const days = Math.round(value / (60 * 24));
  return `${days} д`;
}

export function formatSalesCount(count) {
  const value = Number(count);
  if (!Number.isFinite(value) || value < 0) return '0';
  return String(Math.floor(value));
}

export function pluralSales(count) {
  const n = Math.abs(Number(count) || 0) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'продаж';
  if (n1 > 1 && n1 < 5) return 'продажи';
  if (n1 === 1) return 'продажа';
  return 'продаж';
}
