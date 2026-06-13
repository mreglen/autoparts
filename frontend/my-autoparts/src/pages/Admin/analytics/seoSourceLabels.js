export const SOURCE_LABELS = {
  tecdoc: 'TecDoc',
  product: 'Каталог б/у',
  order: 'Заказы',
  orders: 'Заказы',
  products: 'Каталог б/у',
  semantic: 'Семантика',
  landing: 'Посадочные',
  card_cross: 'Кроссы',
  cross: 'Кроссы Rossko',
  sibling: 'Аналоги',
  unknown: 'Прочее',
};

export const STATUS_LABELS = {
  pending: 'Ожидают проверки',
  ready: 'В наличии',
  not_found: 'Не найдено',
  created: 'Уже созданы',
};

export const STATUS_ORDER = ['pending', 'ready', 'not_found', 'created'];

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || source;
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}
