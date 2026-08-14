import { useSelector } from 'react-redux';
import {
  CABINET_MODE_ADMIN,
  CABINET_MODE_AUTOSERVICE,
  CABINET_MODE_BUYER,
  CABINET_MODE_SELLER,
} from './cabinetMode';

export function selectShowAutoservice(state) {
  return state.publicInfo.showAutoservice === true;
}

export function useShowAutoservice() {
  return useSelector(selectShowAutoservice);
}

export function selectAutoserviceOrganizationId(state) {
  return state.publicInfo.autoserviceOrganizationId || null;
}

export function useAutoserviceOrganizationId() {
  return useSelector(selectAutoserviceOrganizationId);
}

/**
 * Staff menu / routes for autoservice org employees.
 * Admins: staff in «Автосервис» or «Админ» cabinet.
 * Org-autoservice staff: routes by org role (not cabinet switch).
 */
export function canAccessAutoserviceStaffMenu(user, options = {}) {
  if (!user) return false;
  const orgIsAutoservice = options.organizationIsAutoservice === true;
  const cabinetMode = options.cabinetMode;

  if (user.is_admin) {
    if (
      cabinetMode &&
      cabinetMode !== CABINET_MODE_AUTOSERVICE &&
      cabinetMode !== CABINET_MODE_ADMIN
    ) {
      return false;
    }
    return Boolean(options.autoserviceOrganizationId);
  }

  if (orgIsAutoservice) {
    return Boolean(user.is_director || user.is_seller || user.is_employee);
  }

  const orgId = options.autoserviceOrganizationId;
  if (!orgId) return false;
  if (options.showAutoservice !== true) return false;
  if (user.organization_id !== orgId) return false;
  return Boolean(user.is_director || user.is_seller || user.is_employee);
}

/**
 * Client-facing autoservice menu (my cars / booking / repair history).
 * Shown only in «Покупатель» cabinet.
 */
export function canAccessAutoserviceClientMenu(user, options = {}) {
  if (!user) return false;
  const cabinetMode = options.cabinetMode;

  if (cabinetMode && cabinetMode !== CABINET_MODE_BUYER) {
    return false;
  }

  if (user.is_admin) {
    return true;
  }

  return options.showAutoservice === true;
}

const AUTOSERVICE_CLIENT_PATH_PREFIXES = [
  '/garage',
  '/autoservice/welcome',
  '/autoservice/repair-booking',
];

/** Client autoservice routes not available in seller/autoservice/admin cabinets (admin). */
export function isAutoserviceClientPath(pathname) {
  if (pathname === '/autoservice' || pathname === '/autoservice/') return true;
  return AUTOSERVICE_CLIENT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

const AUTOSERVICE_STAFF_PATH_PREFIXES = [
  '/autoservice/planner',
  '/autoservice/clients',
  '/autoservice/orders',
  '/autoservice/settings',
  '/autoservice/inspections',
  '/autoservice/finance',
  '/autoservice/warehouse',
];

/** Staff autoservice routes hidden from buyer/seller cabinets (admin route guard). */
export function isAutoserviceStaffPath(pathname) {
  return AUTOSERVICE_STAFF_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Settings submenu: director of the autoservice org (incl. admin-director). */
export function canAccessAutoserviceSettings(user, options = {}) {
  if (!canAccessAutoserviceStaffMenu(user, options)) return false;
  return Boolean(user.is_director);
}

export const BECOME_CLIENT_CONFIRM = (publicName) =>
  `Вы точно хотите стать клиентом автосервиса ${publicName}?`;

const ADMIN_ONLY_PATH_PREFIXES = [
  '/sellers',
  '/moderation/',
  '/admin/',
  '/admin-settings',
];

export function isAdminOnlyPathForCabinet(pathname) {
  return ADMIN_ONLY_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Whether current path is allowed in the given cabinet (admin autoservice split). */
export function isPathAllowedInCabinet(pathname, cabinetMode, user) {
  if (!user?.is_admin) return true;

  if (cabinetMode === CABINET_MODE_ADMIN) {
    if (isAutoserviceClientPath(pathname)) return false;
    return true;
  }

  if (cabinetMode === CABINET_MODE_BUYER) {
    if (isAutoserviceStaffPath(pathname)) return false;
    return true;
  }

  if (cabinetMode === CABINET_MODE_SELLER) {
    if (isAdminOnlyPathForCabinet(pathname)) return false;
    if (isAutoserviceStaffPath(pathname)) return false;
    if (isAutoserviceClientPath(pathname)) return false;
    return true;
  }

  if (cabinetMode === CABINET_MODE_AUTOSERVICE) {
    if (isAdminOnlyPathForCabinet(pathname)) return false;
    if (isAutoserviceClientPath(pathname)) return false;
    return true;
  }

  return true;
}
