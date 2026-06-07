export const PERIOD_OPTIONS = [
  { value: 1, label: '1 дн.' },
  { value: 7, label: '7 дн.' },
  { value: 30, label: '30 дн.' },
  { value: 90, label: '90 дн.' },
];

export const PAGE_LABELS = {
  '/': 'Главная',
  '/catalog': 'Каталог',
  '/autoparts/new': 'Новые',
  '/autoparts/new/filters': 'Фильтры · новые',
  '/autoparts/used': 'Б/у',
  '/autoparts/used/filters': 'Фильтры · б/у',
  '/about': 'О компании',
  '/delivery': 'Доставка',
  '/payment': 'Оплата',
  '/cart': 'Корзина',
  '/order-reg': 'Заказ',
  '/auth': 'Вход',
  '/part/:productId': 'Карточки товаров',
};

export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total}с`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m < 60) return s ? `${m}м ${s}с` : `${m}м`;
  const h = Math.floor(m / 60);
  return `${h}ч ${m % 60}м`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('ru-RU').format(Number(value) || 0);
}

export function formatDay(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function pageLabel(path) {
  return PAGE_LABELS[path] || path;
}

export function formatSyncStats(sync) {
  if (!sync) return null;
  return [
    { key: 'created', label: 'создано', value: sync.created },
    { key: 'updated', label: 'обновлено', value: sync.updated_existing },
    { key: 'skipped', label: 'пропущено', value: sync.skipped },
    { key: 'not_found', label: 'не найдено', value: sync.not_found },
    { key: 'errors', label: 'ошибок', value: sync.errors },
  ].filter((item) => item.value != null && (item.key !== 'errors' || item.value > 0));
}
