import { priceWithMarkup, formatShopPartUnit } from './repairOrderShopPartUtils';

export function formatAutoserviceWarehouseMoney(value) {
  const amount = Number(value || 0)
    .toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
    .replace(/\s/g, '\u00A0');
  return `${amount}\u00A0₽`;
}

export function formatAutoserviceWarehouseQty(item) {
  const qty = Number(item?.quantity || 0);
  const reserved = Number(item?.reserved_qty || 0);
  const available = Number(item?.available_qty ?? Math.max(0, qty - reserved));
  const unitLabel = formatShopPartUnit(item?.unit || 'pcs');
  if (reserved > 0) {
    return `${available} ${unitLabel} (в резерве ${reserved})`;
  }
  return `${qty} ${unitLabel}`;
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
