export const ADMIN_MENU_MODE_ADMIN = 'admin';
export const ADMIN_MENU_MODE_USER = 'user';

const STORAGE_KEY = 'sg_admin_menu_mode';

const ADMIN_ONLY_PATH_PREFIXES = [
  '/sellers',
  '/moderation/',
  '/admin/',
  '/admin-settings',
];

export function getAdminMenuMode() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === ADMIN_MENU_MODE_USER) return ADMIN_MENU_MODE_USER;
  } catch (_) {
    /* ignore */
  }
  return ADMIN_MENU_MODE_ADMIN;
}

export function setAdminMenuMode(mode) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      mode === ADMIN_MENU_MODE_USER ? ADMIN_MENU_MODE_USER : ADMIN_MENU_MODE_ADMIN,
    );
  } catch (_) {
    /* ignore */
  }
}

export function isAdminOnlyPath(pathname) {
  return ADMIN_ONLY_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Menu context: admin in «user» mode sees seller menu items. */
export function resolveMenuUser(user, adminMenuMode) {
  if (!user?.is_admin) return user;
  if (adminMenuMode !== ADMIN_MENU_MODE_USER) return user;
  return {
    ...user,
    is_admin: false,
    is_seller: true,
  };
}
