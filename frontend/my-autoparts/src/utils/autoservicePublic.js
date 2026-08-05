import { useSelector } from 'react-redux';
import { ADMIN_MENU_MODE_USER } from './adminMenuMode';

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
 * Admins bypass the org check, but only while the menu is in «Админ» mode.
 * @param {object|null} user
 * @param {{ showAutoservice?: boolean, autoserviceOrganizationId?: string|null, adminMenuMode?: string }} options
 */
export function canAccessAutoserviceStaffMenu(user, options = {}) {
  if (!user) return false;
  const orgId = options.autoserviceOrganizationId;
  if (!orgId) return false;
  if (user.is_admin) return options.adminMenuMode !== ADMIN_MENU_MODE_USER;
  if (options.showAutoservice !== true) return false;
  if (user.organization_id !== orgId) return false;
  return Boolean(
    user.is_director || user.is_seller || user.is_employee,
  );
}

/**
 * Client-facing autoservice menu (my cars / booking / repair history).
 * Always uses the real user so admins keep the client flow in both menu modes.
 */
export function canAccessAutoserviceClientMenu(user, options = {}) {
  if (!user) return false;
  if (user.is_admin) return true;
  return options.showAutoservice === true;
}

/** Settings submenu: director of the autoservice org (incl. admin-director). */
export function canAccessAutoserviceSettings(user, options = {}) {
  if (!canAccessAutoserviceStaffMenu(user, options)) return false;
  return Boolean(user.is_director);
}

export const BECOME_CLIENT_CONFIRM = (publicName) =>
  `Вы точно хотите стать клиентом автосервиса ${publicName}?`;
