export const REPAIR_ORDER_PURCHASE_DRAFT_KEY = 'repair_order_purchase_draft';
export const REPAIR_ORDER_PURCHASE_LINK_KEY = 'repair_order_purchase_link';

export function purchaseSelectionKey(orderType, orderId, itemId) {
  return `${orderType}:${orderId}:${itemId}`;
}

export function saveRepairOrderPurchaseDraft(draft) {
  try {
    if (!draft) {
      sessionStorage.removeItem(REPAIR_ORDER_PURCHASE_DRAFT_KEY);
      return;
    }
    sessionStorage.setItem(REPAIR_ORDER_PURCHASE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function readRepairOrderPurchaseDraft() {
  try {
    const raw = sessionStorage.getItem(REPAIR_ORDER_PURCHASE_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== 'object') return null;
    return draft;
  } catch {
    return null;
  }
}

export function clearRepairOrderPurchaseDraft() {
  try {
    sessionStorage.removeItem(REPAIR_ORDER_PURCHASE_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function saveLinkedRepairOrder(order) {
  try {
    if (!order?.id) return;
    sessionStorage.setItem(
      REPAIR_ORDER_PURCHASE_LINK_KEY,
      JSON.stringify({
        id: order.id,
        order_number: order.order_number || null,
        client_name: order.client?.name || null,
      }),
    );
  } catch {
    // ignore
  }
}

export function readLinkedRepairOrder() {
  try {
    const raw = sessionStorage.getItem(REPAIR_ORDER_PURCHASE_LINK_KEY);
    if (!raw) return null;
    const link = JSON.parse(raw);
    if (!link?.id) return null;
    return link;
  } catch {
    return null;
  }
}

export function clearLinkedRepairOrder() {
  try {
    sessionStorage.removeItem(REPAIR_ORDER_PURCHASE_LINK_KEY);
  } catch {
    // ignore
  }
}

export function buildPurchaseImportPayload({
  orderType,
  itemIds,
  markupPercent = 0,
  itemPriceOverrides = {},
}) {
  return {
    order_type: orderType,
    item_ids: itemIds,
    markup_percent: Number(markupPercent) || 0,
    item_price_overrides: Object.fromEntries(
      Object.entries(itemPriceOverrides)
        .filter(([itemId]) => itemIds.includes(Number(itemId))),
    ),
  };
}

export function snapshotPurchaseItems(items) {
  return (items || []).map((item) => ({
    id: item.id,
    orderType: item.orderType,
    orderId: item.orderId,
    brand: item.brand || '',
    partnumber: item.partnumber || '',
    name: item.name || '',
    quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
    product_id: item.product_id || null,
    repairOrderId: item.repairOrderId || item.repair_order_id || null,
    repairOrderNumber: item.repairOrderNumber || item.repair_order_number || null,
  }));
}

export function groupPurchaseSelections(selections) {
  const groups = new Map();
  (selections || []).forEach((entry) => {
    const orderType = entry.orderType;
    if (!orderType || !entry.itemId) return;
    if (!groups.has(orderType)) {
      groups.set(orderType, { orderType, itemIds: [], items: [] });
    }
    const group = groups.get(orderType);
    if (!group.itemIds.includes(entry.itemId)) {
      group.itemIds.push(entry.itemId);
      group.items.push({
        id: entry.itemId,
        orderType,
        orderId: entry.orderId,
        brand: entry.brand || '',
        partnumber: entry.partnumber || '',
        name: entry.name || '',
        quantity: entry.quantity || 1,
        price: entry.price || 0,
        product_id: entry.product_id || null,
        repairOrderId: entry.repairOrderId || entry.repair_order_id || null,
        repairOrderNumber: entry.repairOrderNumber || entry.repair_order_number || null,
      });
    }
  });
  return [...groups.values()];
}

export function mapPurchaseItemsToShopParts(items, defaultMarkupPercent = 0) {
  return snapshotPurchaseItems(items).map((item) => {
    const client = item.price || 0;
    const isNew = item.orderType === 'new';
    return {
      title: (item.name || '').trim() || item.partnumber || item.brand || 'Запчасть',
      brand: item.brand || '',
      partnumber: item.partnumber || '',
      qty: Math.round(Number(item.quantity) || 1),
      unit: 'pcs',
      unit_price: String(client),
      markup_percent: String(defaultMarkupPercent || 0),
      client_unit_price_override: '',
      source: isNew ? 'rossko' : 'manual',
      product_id: isNew ? null : item.product_id,
      rossko_brand: isNew ? (item.brand || '') : '',
      rossko_partnumber: isNew ? (item.partnumber || '') : '',
      is_imported: true,
      pending_import: true,
      purchase_order_type: item.orderType,
      purchase_item_id: item.id,
    };
  });
}

export async function importPurchaseGroupsToRepairOrder(
  apiRequest,
  orderId,
  groups,
  markupPercent = 0,
  itemPriceOverrides = {},
) {
  let lastUpdated = null;
  for (const group of groups) {
    if (!group.itemIds?.length) continue;
    lastUpdated = await apiRequest(`/autoservice/repair-orders/${orderId}/purchase-items`, {
      method: 'POST',
      body: JSON.stringify(buildPurchaseImportPayload({
        ...group,
        markupPercent,
        itemPriceOverrides,
      })),
    });
  }
  return lastUpdated;
}

export async function importPurchaseGroupsToAutoserviceWarehouse(apiRequest, groups) {
  const payloadGroups = (groups || [])
    .filter((group) => group.itemIds?.length)
    .map((group) => ({
      order_type: group.orderType,
      item_ids: group.itemIds,
    }));
  if (!payloadGroups.length) {
    return { added_items: 0, skipped_items: 0 };
  }
  return apiRequest('/autoservice/warehouse/from-purchases', {
    method: 'POST',
    body: JSON.stringify({ groups: payloadGroups }),
  });
}

export function linkedRepairOrderFromItems(items) {
  const linked = (items || []).find((item) => item.repairOrderId || item.repair_order_id);
  if (!linked) return null;
  return {
    id: linked.repairOrderId || linked.repair_order_id,
    order_number: linked.repairOrderNumber || linked.repair_order_number || null,
  };
}

export function purchaseItemsAlreadyOnRepairOrder(groups, orderId) {
  const items = (groups || []).flatMap((group) => group.items || []);
  if (!items.length || !orderId) return false;
  return items.every((item) => (item.repairOrderId || item.repair_order_id) === orderId);
}
