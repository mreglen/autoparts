export const STOCK_IN_SORT_OPTIONS = [
  { id: 'date_desc', label: 'Сначала новые' },
  { id: 'date_asc', label: 'Сначала старые' },
  { id: 'name_asc', label: 'По названию А–Я' },
  { id: 'name_desc', label: 'По названию Я–А' },
];

export function formatStockInDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatStockInMoney(amount) {
  const n = Number(amount || 0);
  return `${n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽`;
}

export function getStockInLineTotal(doc) {
  const qty = Number(doc.quantity || 0);
  const price = Number(doc.sale_price || 0);
  return qty * price;
}

export function sortStockInDocs(items, sortOrder) {
  const list = Array.isArray(items) ? [...items] : [];
  if (sortOrder === 'date_desc') {
    list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  } else if (sortOrder === 'date_asc') {
    list.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
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

export function matchesStockInSearch(doc, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const product = doc.product || {};
  const hay = [
    product.brand,
    product.article,
    product.name,
    product.internal_code,
    doc.creator_name,
    doc.storage_location?.address,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}
