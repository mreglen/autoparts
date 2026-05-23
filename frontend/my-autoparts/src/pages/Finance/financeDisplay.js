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

export function formatFinanceDateInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Сегодня (локальная дата) в формате YYYY-MM-DD для input[type=date]. */
export function getFinanceTodayDate() {
  return formatFinanceDateInput(new Date());
}

/** Не позже maxDate (по умолчанию — сегодня). */
export function clampFinanceDate(value, maxDate = getFinanceTodayDate()) {
  if (!value) return maxDate;
  return value > maxDate ? maxDate : value;
}

export function getMonthRangeDefaults() {
  const now = new Date();
  const today = getFinanceTodayDate();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const dateFrom = formatFinanceDateInput(from);
  const dateTo = clampFinanceDate(formatFinanceDateInput(endOfMonth), today);
  return { dateFrom, dateTo, asOfDate: today };
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
