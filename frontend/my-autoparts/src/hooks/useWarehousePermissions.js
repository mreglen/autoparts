const WAREHOUSE_PERMISSIONS = ['my-parts', 'stock-in', 'stock-out', 'warehouse-sales'];

export function userHasWarehouseQrAccess(user, permissionCodes = []) {
  if (!user) return false;
  if (user.is_admin || user.is_seller) return true;
  if (user.is_employee && Array.isArray(permissionCodes)) {
    return WAREHOUSE_PERMISSIONS.some((code) => permissionCodes.includes(code));
  }
  return false;
}

export function useWarehousePermissions(user, permissionCodes = []) {
  const isStaff = Boolean(user?.is_admin || user?.is_seller || user?.is_employee);
  const has = (code) => {
    if (!user) return false;
    if (user.is_admin || user.is_seller) return true;
    if (user.is_employee) return permissionCodes.includes(code);
    return false;
  };

  return {
    canViewQrCard: userHasWarehouseQrAccess(user, permissionCodes),
    canPrint: has('settings.printers'),
    canSell: has('warehouse-sales'),
    canStockOut: has('stock-out'),
    canStockIn: has('stock-in'),
    canEditParts: has('my-parts'),
    canEditCells: has('my-parts'),
    isStaff,
  };
}

export { WAREHOUSE_PERMISSIONS };
