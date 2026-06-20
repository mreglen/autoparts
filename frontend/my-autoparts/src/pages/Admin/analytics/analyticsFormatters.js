export const PERIOD_OPTIONS = [
  { value: 7, label: '7 дн.' },
  { value: 30, label: '30 дн.' },
  { value: 90, label: '90 дн.' },
];

export const FUNNEL_LABELS = {
  part_view: 'Просмотр карточки',
  add_to_cart: 'В корзину',
  show_phone: 'Показать телефон',
  chat_start: 'Чат',
  order_placed: 'Заказ',
};

export const SOURCE_LABELS = {
  organic: 'Organic',
  direct: 'Direct',
  referral: 'Referral',
  paid: 'Paid',
  unknown: 'Unknown',
};

export const RECOMMENDATION_STYLES = {
  covered: 'bg-green-50 text-green-800',
  create_landing: 'bg-amber-50 text-amber-900',
  improve_title: 'bg-indigo-50 text-indigo-800',
  review: 'bg-gray-100 text-gray-700',
};

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
  '/autoparts/new/brand/:slug': 'Brand · new',
  '/autoparts/new/category/:slug': 'Category · new',
  '/autoparts/used/brand/:slug': 'Brand · used',
  '/autoparts/used/category/:slug': 'Category · used',
  '/autoparts/used/geo/:slug': 'Geo · used',
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
