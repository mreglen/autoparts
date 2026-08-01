import { useSelector } from 'react-redux';

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
 * @param {object|null} user
 * @param {{ showAutoservice?: boolean, autoserviceOrganizationId?: string|null }} options
 */
export function canAccessAutoserviceStaffMenu(user, options = {}) {
  if (!user) return false;
  if (options.showAutoservice !== true) return false;
  const orgId = options.autoserviceOrganizationId;
  if (!orgId || user.organization_id !== orgId) return false;
  return Boolean(
    user.is_admin || user.is_director || user.is_seller || user.is_employee,
  );
}

/**
 * Client-facing autoservice menu (garage / my orders) for any logged-in user
 * when the site flag is on.
 */
export function canAccessAutoserviceClientMenu(user, options = {}) {
  if (!user) return false;
  return options.showAutoservice === true;
}

/** Settings submenu: director of the autoservice org (incl. admin-director). */
export function canAccessAutoserviceSettings(user, options = {}) {
  if (!canAccessAutoserviceStaffMenu(user, options)) return false;
  return Boolean(user.is_director);
}

export const BECOME_CLIENT_CONFIRM = (publicName) =>
  `Вы точно хотите стать клиентом автосервиса ${publicName}?`;
