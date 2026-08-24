export const REPAIR_ORDER_CART_DRAFT_KEY = 'repair_order_cart_draft';

export function saveRepairOrderCartDraft(draft) {
  try {
    if (!draft) {
      sessionStorage.removeItem(REPAIR_ORDER_CART_DRAFT_KEY);
      return;
    }
    sessionStorage.setItem(REPAIR_ORDER_CART_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function readRepairOrderCartDraft() {
  try {
    const raw = sessionStorage.getItem(REPAIR_ORDER_CART_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== 'object') return null;
    return draft;
  } catch {
    return null;
  }
}

export function clearRepairOrderCartDraft() {
  try {
    sessionStorage.removeItem(REPAIR_ORDER_CART_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function snapshotCartItems(items) {
  return (items || []).map((item) => ({
    id: item.id,
    itemType: item.type === 'used' ? 'used' : 'new',
    brand: item.brand || '',
    partnumber: item.number || item.partnumber || '',
    name: item.partTitle || item.name || '',
    quantity: Number(item.quantity) || 1,
    price: Number(item.price) || 0,
    purchasePrice: Number(item.purchasePrice) || 0,
    product_id: item.product_id || null,
  }));
}

export function mapCartItemsToShopParts(items, defaultMarkupPercent = 0) {
  return snapshotCartItems(items).map((item) => {
    const isNew = item.itemType === 'new';
    const unitPrice = isNew && item.purchasePrice > 0 ? item.purchasePrice : item.price;
    return {
      title: (item.name || '').trim() || item.partnumber || item.brand || 'Запчасть',
      brand: item.brand || '',
      partnumber: item.partnumber || '',
      qty: Math.round(Number(item.quantity) || 1),
      unit: 'pcs',
      unit_price: String(unitPrice),
      markup_percent: String(defaultMarkupPercent || 0),
      client_unit_price_override: '',
      source: isNew ? 'rossko' : 'manual',
      product_id: isNew ? null : item.product_id,
      rossko_brand: isNew ? (item.brand || '') : '',
      rossko_partnumber: isNew ? (item.partnumber || '') : '',
      pending_cart_import: true,
      cart_item_type: item.itemType,
      cart_item_id: item.id,
      is_in_cart: true,
    };
  });
}

export function buildCartImportPayload(items, markupPercent = 0) {
  return {
    items: snapshotCartItems(items).map((item) => ({
      item_id: item.id,
      item_type: item.itemType,
    })),
    markup_percent: Number(markupPercent) || 0,
  };
}

export async function importCartItemsToRepairOrder(
  apiRequest,
  orderId,
  items,
  markupPercent = 0,
) {
  const payload = buildCartImportPayload(items, markupPercent);
  if (!payload.items.length) return null;
  return apiRequest(`/autoservice/repair-orders/${orderId}/cart-items`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
