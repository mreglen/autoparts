import { getSaleSourceMeta } from './warehouseSaleUi';

export const STOCK_OUT_SORT_OPTIONS = [
  { id: 'date_desc', label: 'Сначала новые' },
  { id: 'date_asc', label: 'Сначала старые' },
  { id: 'name_asc', label: 'По названию А–Я' },
  { id: 'name_desc', label: 'По названию Я–А' },
];

export const STOCK_OUT_TYPE_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'sale', label: 'Продажи' },
  { id: 'writeoff', label: 'Списания' },
  { id: 'avito', label: 'Авито' },
];

export function isStockOutSale(item) {
  const price = Number(item.sale_price || 0);
  const channel = (item.sale_channel || '').toLowerCase();
  return price > 0 || channel === 'avito' || Boolean(item.avito_order_id);
}

export function getStockOutOperationMeta(item) {
  if (isStockOutSale(item)) {
    return {
      label: 'Продажа',
      className: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100',
    };
  }
  return {
    label: 'Списание',
    className: 'bg-rose-50 text-rose-800 ring-1 ring-rose-100',
  };
}

export function formatStockOutDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatStockOutMoney(amount) {
  const n = Number(amount);
  if (amount == null || amount === '' || Number.isNaN(n)) return '—';
  return `${n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽`;
}

export function getStockOutLineTotal(item) {
  const qty = Number(item.quantity || 0);
  const price = Number(item.sale_price || 0);
  return qty * price;
}

export function sortStockOutItems(items, sortOrder) {
  const list = Array.isArray(items) ? [...items] : [];
  if (sortOrder === 'date_desc') {
    list.sort((a, b) => new Date(b.movement_date || 0) - new Date(a.movement_date || 0));
  } else if (sortOrder === 'date_asc') {
    list.sort((a, b) => new Date(a.movement_date || 0) - new Date(b.movement_date || 0));
  } else if (sortOrder === 'name_asc' || sortOrder === 'name_desc') {
    list.sort((a, b) => {
      const aName = (a.product?.name || a.product?.brand || a.product?.article || '')
        .toString()
        .toLowerCase();
      const bName = (b.product?.name || b.product?.brand || b.product?.article || '')
        .toString()
        .toLowerCase();
      if (aName < bName) return sortOrder === 'name_asc' ? -1 : 1;
      if (aName > bName) return sortOrder === 'name_asc' ? 1 : -1;
      return 0;
    });
  }
  return list;
}

export function matchesStockOutSearch(item, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const product = item.product || {};
  const userName = item.user
    ? [item.user.last_name, item.user.first_name, item.user.patronymic].filter(Boolean).join(' ')
    : '';
  const hay = [
    product.brand,
    product.article,
    product.name,
    product.internal_code,
    item.reason,
    userName,
    item.avito_order_id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function matchesStockOutTypeFilter(item, filterId) {
  if (filterId === 'all') return true;
  if (filterId === 'sale') return isStockOutSale(item);
  if (filterId === 'writeoff') return !isStockOutSale(item);
  if (filterId === 'avito') {
    const channel = (item.sale_channel || '').toLowerCase();
    return channel === 'avito' || Boolean(item.avito_order_id);
  }
  return true;
}

export function getStockOutChannelMeta(item) {
  if (!isStockOutSale(item)) return null;
  const meta = getSaleSourceMeta(item);
  if (meta.label === 'Склад') return null;
  return meta;
}

export function getStockOutUserName(item) {
  if (!item.user) return '—';
  const parts = [item.user.last_name, item.user.first_name, item.user.patronymic].filter(Boolean);
  return parts.join(' ') || '—';
}
