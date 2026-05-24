const SOURCE_LABELS = {
  platform: 'Свой Гараж',
  yandex: 'Яндекс',
  avito: 'Авито',
};

const SOURCE_STYLES = {
  platform: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  yandex: 'bg-yellow-50 text-yellow-800 ring-yellow-100',
  avito: 'bg-orange-50 text-orange-800 ring-orange-100',
};

export function reviewSourceLabel(source) {
  return SOURCE_LABELS[source] || 'Отзыв';
}

export function reviewSourceClass(source) {
  return SOURCE_STYLES[source] || 'bg-gray-50 text-gray-700 ring-gray-100';
}

export function formatReviewDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function authorInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

export const YANDEX_REVIEWS_WIDGET_URL = 'https://yandex.ru/maps-reviews-widget/213329928692?comments';
export const YANDEX_ORG_URL = 'https://yandex.ru/maps/org/svoy_garazh/213329928692/';
