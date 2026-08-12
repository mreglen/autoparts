export const SELLER_AUTOSERVICE_MODE_SELLER = 'seller';
export const SELLER_AUTOSERVICE_MODE_AUTOSERVICE = 'autoservice';

const STORAGE_KEY = 'sg_seller_autoservice_mode';

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
}

export function userHasAutoserviceOrganization(user) {
  return Boolean(user?.organization_is_autoservice);
}

export function showSellerAutoserviceSwitch(user) {
  if (!user) return false;
  if (user.is_admin) return false;
  return userHasAutoserviceOrganization(user);
}
