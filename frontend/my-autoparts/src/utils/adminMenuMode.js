import { CABINET_MODE_ADMIN } from './cabinetMode';

export const ADMIN_MENU_MODE_ADMIN = 'admin';
export const ADMIN_MENU_MODE_USER = 'user';

const LEGACY_STORAGE_KEY = 'sg_admin_menu_mode';
const CABINET_STORAGE_KEY = 'sg_cabinet_mode';

const ADMIN_ONLY_PATH_PREFIXES = [
  '/sellers',
  '/moderation/',
  '/admin/',
  '/admin-settings',
];

/** @deprecated Use cabinetMode from cabinetMode.js */
export function getAdminMenuMode() {
  try {
    const cabinet = localStorage.getItem(CABINET_STORAGE_KEY);
    if (cabinet === CABINET_MODE_ADMIN) return ADMIN_MENU_MODE_ADMIN;

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === ADMIN_MENU_MODE_USER) return ADMIN_MENU_MODE_USER;
  } catch (_) {
    /* ignore */
  }
  return ADMIN_MENU_MODE_ADMIN;
}

/** @deprecated Use setCabinetMode from cabinetMode.js */
export function setAdminMenuMode(mode) {
  try {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      mode === ADMIN_MENU_MODE_USER ? ADMIN_MENU_MODE_USER : ADMIN_MENU_MODE_ADMIN,
    );
  } catch (_) {
    /* ignore */
  }
}

export function isAdminOnlyPath(pathname) {
  return ADMIN_ONLY_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
