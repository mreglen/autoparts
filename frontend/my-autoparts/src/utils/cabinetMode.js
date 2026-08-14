import { ADMIN_MENU_MODE_ADMIN, ADMIN_MENU_MODE_USER } from './adminMenuMode';
import {
  SELLER_AUTOSERVICE_MODE_AUTOSERVICE,
  SELLER_AUTOSERVICE_MODE_SELLER,
} from './sellerAutoserviceMode';

export const CABINET_MODE_BUYER = 'buyer';
export const CABINET_MODE_SELLER = 'seller';
export const CABINET_MODE_AUTOSERVICE = 'autoservice';
export const CABINET_MODE_ADMIN = 'admin';

const STORAGE_KEY = 'sg_cabinet_mode';
const LEGACY_ADMIN_KEY = 'sg_admin_menu_mode';
const LEGACY_SELLER_AUTOSERVICE_KEY = 'sg_seller_autoservice_mode';

export const CABINET_MODE_LABELS = {
  [CABINET_MODE_BUYER]: 'Покупатель',
  [CABINET_MODE_SELLER]: 'Продавец',
  [CABINET_MODE_AUTOSERVICE]: 'Автосервис',
  [CABINET_MODE_ADMIN]: 'Админ',
};

function isOrganizationStaff(user) {
  if (!user) return false;
  return Boolean(user.is_seller || user.is_director || user.is_employee);
}

/** Which cabinet modes the user may switch to. */
export function getAvailableCabinetModes(user, options = {}) {
  if (!user) return [CABINET_MODE_BUYER];

  const modes = [CABINET_MODE_BUYER];

  if (user.is_admin || isOrganizationStaff(user)) {
    modes.push(CABINET_MODE_SELLER);
  }

  const hasAutoserviceCabinet =
    user.organization_is_autoservice === true ||
    (user.is_admin && Boolean(options.autoserviceOrganizationId));

  if (hasAutoserviceCabinet && (user.is_admin || isOrganizationStaff(user))) {
    modes.push(CABINET_MODE_AUTOSERVICE);
  }

  if (user.is_admin) {
    modes.push(CABINET_MODE_ADMIN);
  }

  return modes;
}

export function getDefaultCabinetMode(user, options = {}) {
  if (!user) return CABINET_MODE_BUYER;
  if (user.is_admin) return CABINET_MODE_ADMIN;
  if (isOrganizationStaff(user)) return CABINET_MODE_SELLER;
  return CABINET_MODE_BUYER;
}

export function showCabinetModeSwitch(user, options = {}) {
  return getAvailableCabinetModes(user, options).length > 1;
}

function migrateLegacyCabinetMode(user, options = {}) {
  try {
    const legacyAdmin = localStorage.getItem(LEGACY_ADMIN_KEY);
    const legacySellerAutoservice = localStorage.getItem(LEGACY_SELLER_AUTOSERVICE_KEY);
    const available = getAvailableCabinetModes(user, options);

    let migrated = null;

    if (user?.is_admin && legacyAdmin === ADMIN_MENU_MODE_ADMIN && available.includes(CABINET_MODE_ADMIN)) {
      migrated = CABINET_MODE_ADMIN;
    } else if (user?.is_admin && legacyAdmin === ADMIN_MENU_MODE_USER) {
      if (legacySellerAutoservice === SELLER_AUTOSERVICE_MODE_AUTOSERVICE && available.includes(CABINET_MODE_AUTOSERVICE)) {
        migrated = CABINET_MODE_AUTOSERVICE;
      } else if (available.includes(CABINET_MODE_SELLER)) {
        migrated = CABINET_MODE_SELLER;
      } else if (available.includes(CABINET_MODE_BUYER)) {
        migrated = CABINET_MODE_BUYER;
      }
    } else if (legacySellerAutoservice === SELLER_AUTOSERVICE_MODE_AUTOSERVICE && available.includes(CABINET_MODE_AUTOSERVICE)) {
      migrated = CABINET_MODE_AUTOSERVICE;
    } else if (legacySellerAutoservice === SELLER_AUTOSERVICE_MODE_SELLER && available.includes(CABINET_MODE_SELLER)) {
      migrated = CABINET_MODE_SELLER;
    }

    if (migrated) {
      localStorage.setItem(STORAGE_KEY, migrated);
      localStorage.removeItem(LEGACY_ADMIN_KEY);
      localStorage.removeItem(LEGACY_SELLER_AUTOSERVICE_KEY);
      return migrated;
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

export function resolveCabinetMode(user, options = {}) {
  const available = getAvailableCabinetModes(user, options);
  const fallback = getDefaultCabinetMode(user, options);

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && available.includes(stored)) {
      return stored;
    }

    const migrated = migrateLegacyCabinetMode(user, options);
    if (migrated && available.includes(migrated)) {
      return migrated;
    }
  } catch (_) {
    /* ignore */
  }

  return available.includes(fallback) ? fallback : available[0];
}

export function getCabinetMode(user, options = {}) {
  return resolveCabinetMode(user, options);
}

export function setCabinetMode(mode) {
  const allowed = [
    CABINET_MODE_BUYER,
    CABINET_MODE_SELLER,
    CABINET_MODE_AUTOSERVICE,
    CABINET_MODE_ADMIN,
  ];
  const nextMode = allowed.includes(mode) ? mode : CABINET_MODE_BUYER;
  try {
    localStorage.setItem(STORAGE_KEY, nextMode);
  } catch (_) {
    /* ignore */
  }
}

export function getDefaultPathForCabinetMode(cabinetMode) {
  switch (cabinetMode) {
    case CABINET_MODE_ADMIN:
      return '/sellers';
    case CABINET_MODE_AUTOSERVICE:
      return '/autoservice/planner';
    case CABINET_MODE_SELLER:
      return '/dashboard';
    case CABINET_MODE_BUYER:
    default:
      return '/purchases/orders';
  }
}
