export const NEW_PARTS_CHECKOUT_ITEM_IDS_KEY = 'new_parts_checkout_item_ids';

export function setNewPartsCheckoutItemIds(ids) {
  try {
    if (!ids?.length) {
      sessionStorage.removeItem(NEW_PARTS_CHECKOUT_ITEM_IDS_KEY);
      return;
    }
    sessionStorage.setItem(NEW_PARTS_CHECKOUT_ITEM_IDS_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function readNewPartsCheckoutItemIds() {
  try {
    const raw = sessionStorage.getItem(NEW_PARTS_CHECKOUT_ITEM_IDS_KEY);
    if (!raw) return null;
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? new Set(ids) : null;
  } catch {
    return null;
  }
}

export function clearNewPartsCheckoutItemIds() {
  try {
    sessionStorage.removeItem(NEW_PARTS_CHECKOUT_ITEM_IDS_KEY);
  } catch {
    // ignore
  }
}
