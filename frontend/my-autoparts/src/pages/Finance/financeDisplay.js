export const CHANNEL_OPTIONS = [
  { value: 'all', label: 'Все каналы' },
  { value: 'avito', label: 'Авито' },
  { value: 'marketplace_used', label: 'Сайт (Б/У)' },
  { value: 'warehouse_manual', label: 'Склад' },
];

export function formatFinanceCurrency(amount) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatFinanceDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getMonthRangeDefaults() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { dateFrom: fmt(from), dateTo: fmt(to), asOfDate: fmt(now) };
}

export function buildFinanceQueryParams({ dateFrom, dateTo, asOfDate, channel }) {
  const params = {
    date_from: dateFrom,
    date_to: dateTo,
  };
  if (asOfDate) params.as_of_date = asOfDate;
  if (channel && channel !== 'all') params.channel = channel;
  return params;
}
