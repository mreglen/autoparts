const DRAFT_VERSION = 1;
export const NEW_CHECKOUT_DRAFT_KEY = 'new_parts_checkout_draft';
export const USED_CHECKOUT_DRAFT_KEY = 'used_checkout_draft';

function readDraft(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== DRAFT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(key, draft) {
  try {
    if (!draft) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, JSON.stringify({ v: DRAFT_VERSION, ...draft }));
  } catch {
    // ignore quota / private mode
  }
}

export function readNewCheckoutDraft() {
  return readDraft(NEW_CHECKOUT_DRAFT_KEY);
}

export function saveNewCheckoutDraft(draft) {
  writeDraft(NEW_CHECKOUT_DRAFT_KEY, draft);
}

export function clearNewCheckoutDraft() {
  try {
    sessionStorage.removeItem(NEW_CHECKOUT_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function readUsedCheckoutDraft() {
  return readDraft(USED_CHECKOUT_DRAFT_KEY);
}

export function saveUsedCheckoutDraft(draft) {
  writeDraft(USED_CHECKOUT_DRAFT_KEY, draft);
}

export function clearUsedCheckoutDraft() {
  try {
    sessionStorage.removeItem(USED_CHECKOUT_DRAFT_KEY);
  } catch {
    // ignore
  }
}
