export const NEW_PARTS_CHECKOUT_ITEM_IDS_KEY = 'new_parts_checkout_item_ids';
export const NEW_PARTS_DELIVER_IN_PARTS_KEY = 'new_parts_deliver_in_parts';

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

export function setNewPartsDeliverInParts(value) {
  try {
    sessionStorage.setItem(NEW_PARTS_DELIVER_IN_PARTS_KEY, value ? '1' : '0');
  } catch {
    // ignore
  }
}

export function readNewPartsDeliverInParts() {
  try {
    return sessionStorage.getItem(NEW_PARTS_DELIVER_IN_PARTS_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearNewPartsDeliverInParts() {
  try {
    sessionStorage.removeItem(NEW_PARTS_DELIVER_IN_PARTS_KEY);
  } catch {
    // ignore
  }
}
