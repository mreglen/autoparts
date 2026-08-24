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

function basketKey(basketId) {
  return String(basketId);
}

export function readNewPartsDeliverInPartsMap() {
  try {
    const raw = sessionStorage.getItem(NEW_PARTS_DELIVER_IN_PARTS_KEY);
    if (!raw) return {};
    if (raw === '0' || raw === '1') {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [String(key), Boolean(value)]),
    );
  } catch {
    return {};
  }
}

export function readNewPartsDeliverInParts(basketId) {
  if (basketId == null) return false;
  const map = readNewPartsDeliverInPartsMap();
  return Boolean(map[basketKey(basketId)]);
}

export function setNewPartsDeliverInParts(basketId, value) {
  if (basketId == null) return;
  try {
    const map = readNewPartsDeliverInPartsMap();
    map[basketKey(basketId)] = Boolean(value);
    sessionStorage.setItem(NEW_PARTS_DELIVER_IN_PARTS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function clearNewPartsDeliverInParts(basketId) {
  try {
    if (basketId == null) {
      sessionStorage.removeItem(NEW_PARTS_DELIVER_IN_PARTS_KEY);
      return;
    }
    const map = readNewPartsDeliverInPartsMap();
    delete map[basketKey(basketId)];
    if (!Object.keys(map).length) {
      sessionStorage.removeItem(NEW_PARTS_DELIVER_IN_PARTS_KEY);
    } else {
      sessionStorage.setItem(NEW_PARTS_DELIVER_IN_PARTS_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore
  }
}
