export const SELLER_AUTOSERVICE_MODE_SELLER = 'seller';
export const SELLER_AUTOSERVICE_MODE_AUTOSERVICE = 'autoservice';

const STORAGE_KEY = 'sg_seller_autoservice_mode';
const MODE_CHANGE_EVENT = 'sg:seller-autoservice-mode';

export function getSellerAutoserviceMode() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === SELLER_AUTOSERVICE_MODE_AUTOSERVICE) {
      return SELLER_AUTOSERVICE_MODE_AUTOSERVICE;
    }
  } catch (_) {
    /* ignore */
  }
  return SELLER_AUTOSERVICE_MODE_SELLER;
}

export function setSellerAutoserviceMode(mode) {
  const nextMode =
    mode === SELLER_AUTOSERVICE_MODE_AUTOSERVICE
      ? SELLER_AUTOSERVICE_MODE_AUTOSERVICE
      : SELLER_AUTOSERVICE_MODE_SELLER;
  try {
    localStorage.setItem(STORAGE_KEY, nextMode);
  } catch (_) {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(MODE_CHANGE_EVENT, { detail: nextMode }));
  } catch (_) {
    /* ignore */
  }
}

/** Подписка для useSyncExternalStore: режим меняется вне React (localStorage). */
export function subscribeSellerAutoserviceMode(onChange) {
  window.addEventListener(MODE_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(MODE_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function userHasAutoserviceOrganization(user) {
  return Boolean(user?.organization_is_autoservice);
}

export function showSellerAutoserviceSwitch(user) {
  if (!user) return false;
  if (user.is_admin) return false;
  return userHasAutoserviceOrganization(user);
}
