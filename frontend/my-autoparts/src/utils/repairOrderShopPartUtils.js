import { ceilRubles, truncateRubles } from '../pages/AutoParts/NewParts/newPartStockUtils';

export const SHOP_PART_UNIT_LABELS = {
  pcs: 'шт.',
  l: 'л',
  kg: 'кг',
};

export function shopPartDisplayName(part) {
  if (part?.display_name) return part.display_name;
  const chunks = [
    part?.brand || part?.rossko_brand,
    part?.partnumber || part?.rossko_partnumber,
    part?.title,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const unique = chunks.filter((value, index) => index === 0 || value !== chunks[index - 1]);
  return unique.join(' ') || part?.title || '—';
}

export function formatShopPartQty(qty, unit = 'pcs') {
  const n = Number(qty);
  if (Number.isNaN(n)) return '0';
  if (unit === 'pcs') return String(Math.round(n));
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

export function formatShopPartUnit(unit = 'pcs') {
  return SHOP_PART_UNIT_LABELS[unit] || unit;
}

export function priceWithMarkup(
  unitPrice,
  markupPercent,
  { floorRubles = false, ceilRubles: roundUpRubles = false, clientUnitPriceOverride = null } = {},
) {
  if (clientUnitPriceOverride !== null && clientUnitPriceOverride !== '') {
    return Math.round((Number(clientUnitPriceOverride) || 0) * 100) / 100;
  }
  const value = (Number(unitPrice) || 0) * (1 + (Number(markupPercent) || 0) / 100);
  if (roundUpRubles) return ceilRubles(value);
  if (floorRubles) return truncateRubles(value);
  return Math.round(value * 100) / 100;
}

export function shopLineSum(qty, unitPrice, markupPercent, options = {}) {
  const unit = priceWithMarkup(unitPrice, markupPercent, options);
  const total = (Number(qty) || 0) * unit;
  if (options.ceilRubles && options.clientUnitPriceOverride == null) {
    return ceilRubles(total);
  }
  if (options.floorRubles && options.clientUnitPriceOverride == null) {
    return truncateRubles(total);
  }
  return Math.round(total * 100) / 100;
}

export function shopPartPricingOptions(part) {
  return {
    ceilRubles: true,
    clientUnitPriceOverride: part?.client_unit_price_override,
  };
}

export function isValidShopPartQty(qty, unit = 'pcs') {
  const n = Number(qty);
  if (Number.isNaN(n) || n <= 0) return false;
  if (unit === 'pcs') return Number.isInteger(n) && n >= 1;
  return n >= 0.001;
}

export function isWarehouseLinkedShopPart(part) {
  return part?.source === 'warehouse' || part?.source === 'autoservice_stock';
}

export function isManualEditableShopPart(part) {
  if (part?.is_imported || part?.pending_import) return false;
  if (part?.is_manual_editable) return true;
  if (part?.source === 'manual' || part?.source === 'rossko') return true;
  return false;
}

export function manualShopPartFormValues(part) {
  return {
    brand: part?.brand || part?.rossko_brand || '',
    article: part?.partnumber || part?.rossko_partnumber || '',
    name: part?.title || '',
    quantity: part?.qty ?? 1,
    unit: part?.unit || 'pcs',
    unit_price: part?.unit_price ?? '0',
    receipt_date: part?.receipt_date || '',
  };
}

export function applyManualShopPartFormValues(part, values) {
  const isRossko = values.source === 'rossko';
  return {
    ...part,
    title: values.name,
    brand: values.brand || '',
    partnumber: values.article || '',
    qty: values.quantity,
    unit: values.unit || 'pcs',
    unit_price: String(values.unit_price ?? 0),
    receipt_date: values.receipt_date || part?.receipt_date || '',
    source: isRossko
      ? 'rossko'
      : (part?.source === 'autoservice_stock' ? part.source : 'manual'),
    rossko_brand: isRossko ? (values.brand || '') : (part?.rossko_brand || ''),
    rossko_partnumber: isRossko ? (values.article || '') : (part?.rossko_partnumber || ''),
  };
}

export function clampWarehouseShopPartQty(raw, part) {
  const unit = part?.unit || 'pcs';
  if (raw === '' || raw == null) return '';
  let value = unit === 'pcs' ? Math.round(Number(raw) || 0) : raw;
  const maxQty = Number(part?.stock_max_qty);
  if (Number.isFinite(maxQty) && maxQty > 0 && Number(value) > maxQty) {
    value = maxQty;
  }
  return value;
}

export function warehouseStockKey(part) {
  if (part?.source === 'warehouse' && part?.product_id) {
    return `warehouse:${part.product_id}`;
  }
  if (part?.source === 'autoservice_stock' && part?.autoservice_stock_item_id) {
    return `autoservice:${part.autoservice_stock_item_id}`;
  }
  return null;
}
