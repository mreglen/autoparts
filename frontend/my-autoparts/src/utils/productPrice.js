export function roundProductPrice(price) {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount);
}

export function formatProductPrice(price, { roundKopecks = false, withCurrency = true } = {}) {
  if (price == null || price === '') return '—';
  const raw = Number(price);
  if (!Number.isFinite(raw)) return '—';
  const amount = roundKopecks ? Math.round(raw) : raw;
  const formatted = amount.toLocaleString('ru-RU', {
    minimumFractionDigits: roundKopecks ? 0 : 0,
    maximumFractionDigits: roundKopecks ? 0 : 2,
  });
  return withCurrency ? `${formatted} ₽` : formatted;
}
