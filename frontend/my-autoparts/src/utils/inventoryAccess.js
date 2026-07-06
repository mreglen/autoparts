export const INVENTORY_VIEW = 'inventory.view';
export const INVENTORY_CREATE = 'inventory.create';
export const INVENTORY_ADJUST = 'inventory.adjust';
export const INVENTORY_COMPLETE = 'inventory.complete';

export function canViewInventory(user, permissionCodes) {
  const has = (code) => permissionCodes?.includes(code);
  return (
    user?.is_admin ||
    user?.is_seller ||
    user?.is_director ||
    (user?.is_employee && has(INVENTORY_VIEW))
  );
}

export function canCreateInventory(user, permissionCodes) {
  const has = (code) => permissionCodes?.includes(code);
  return (
    user?.is_admin ||
    user?.is_seller ||
    user?.is_director ||
    (user?.is_employee && has(INVENTORY_CREATE))
  );
}

export function canAdjustInventory(user, permissionCodes) {
  const has = (code) => permissionCodes?.includes(code);
  return (
    user?.is_admin ||
    user?.is_seller ||
    user?.is_director ||
    (user?.is_employee && has(INVENTORY_ADJUST))
  );
}

export function canCompleteInventory(user, permissionCodes) {
  const has = (code) => permissionCodes?.includes(code);
  return (
    user?.is_admin ||
    user?.is_seller ||
    user?.is_director ||
    (user?.is_employee && has(INVENTORY_COMPLETE))
  );
}

export const INVENTORY_STATUS_LABELS = {
  draft: 'Черновик',
  counting: 'Подсчёт',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

export const ADJUSTMENT_KIND_LABELS = {
  match: 'Совпадает',
  surplus: 'Излишек',
  shortage: 'Недостача',
};

export const ADJUSTMENT_KIND_STYLES = {
  match: 'bg-gray-100 text-gray-700',
  surplus: 'bg-emerald-100 text-emerald-800',
  shortage: 'bg-red-100 text-red-800',
};
