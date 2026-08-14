import { priceWithMarkup } from './repairOrderShopPartUtils';

export function formatAutoserviceWarehouseMoney(value) {
  return `${Number(value || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₽`;
}

export function formatAutoserviceWarehouseQty(item) {
  const qty = Number(item?.quantity || 0);
  const reserved = Number(item?.reserved_qty || 0);
  const available = Number(item?.available_qty ?? Math.max(0, qty - reserved));
  if (reserved > 0) {
    return `${available} шт. (в резерве ${reserved})`;
  }
  return `${qty} шт.`;
}

export function autoserviceWarehouseClientPrice(unitPrice, markupPercent) {
  return priceWithMarkup(unitPrice, markupPercent);
}

export function matchesAutoserviceWarehouseSearch(item, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  return [item.brand, item.article, item.name]
    .some((value) => String(value || '').toLowerCase().includes(q));
}
