export function formatWarehouseSaleDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatWarehouseMoney(amount) {
  return `${Number(amount || 0).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽`;
}

export function getSaleSourceMeta(sale) {
  const channel = (sale.sale_channel || '').toLowerCase();
  const source = (sale.source_kind || '').toLowerCase();
  const reason = (sale.reason || '').toLowerCase();

  if (channel === 'avito' || source === 'avito' || sale.avito_order_id || reason.includes('авито')) {
    return {
      label: 'Авито',
      className: 'bg-sky-50 text-sky-800 ring-1 ring-sky-100',
    };
  }
  if (channel === 'marketplace_used' || source === 'marketplace_used' || sale.garage_used_order_item_id) {
    return {
      label: 'Сайт · Б/У',
      className: 'bg-violet-50 text-violet-800 ring-1 ring-violet-100',
    };
  }
  return {
    label: 'Склад',
    className: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200',
  };
}

export const SALE_SOURCE_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'warehouse', label: 'Склад' },
  { id: 'avito', label: 'Авито' },
  { id: 'marketplace', label: 'Сайт Б/У' },
];

export function matchesSaleSourceFilter(sale, filterId) {
  if (filterId === 'all') return true;
  const meta = getSaleSourceMeta(sale);
  if (filterId === 'avito') return meta.label === 'Авито';
  if (filterId === 'marketplace') return meta.label === 'Сайт · Б/У';
  if (filterId === 'warehouse') return meta.label === 'Склад';
  return true;
}
