export const AUTOSERVICE_PERMISSION = {
  planner: 'autoservice.planner',
  orders: 'autoservice.orders',
  warehouse: 'autoservice.warehouse',
  finance: 'autoservice.finance',
  reports: 'autoservice.reports',
  clients: 'autoservice.clients',
  inspections: 'autoservice.inspections',
  settings: 'autoservice.settings',
};

export const AUTOSERVICE_PERMISSION_CODES = Object.values(AUTOSERVICE_PERMISSION);

export const AUTOSERVICE_SECTION_PERMISSION = {
  planner: AUTOSERVICE_PERMISSION.planner,
  orders: AUTOSERVICE_PERMISSION.orders,
  'order-form': AUTOSERVICE_PERMISSION.orders,
  'order-print': AUTOSERVICE_PERMISSION.orders,
  'order-upd-print': AUTOSERVICE_PERMISSION.orders,
  'order-invoice-print': AUTOSERVICE_PERMISSION.orders,
  clients: AUTOSERVICE_PERMISSION.clients,
  inspections: AUTOSERVICE_PERMISSION.inspections,
  finance: AUTOSERVICE_PERMISSION.finance,
  reports: AUTOSERVICE_PERMISSION.reports,
  warehouse: AUTOSERVICE_PERMISSION.warehouse,
  'warehouse-receipts': AUTOSERVICE_PERMISSION.warehouse,
  'warehouse-expenses': AUTOSERVICE_PERMISSION.warehouse,
  settings: AUTOSERVICE_PERMISSION.settings,
};

export const AUTOSERVICE_MENU_ITEMS = [
  { id: 'autoservice-planner', permission: AUTOSERVICE_PERMISSION.planner },
  { id: 'autoservice-orders', permission: AUTOSERVICE_PERMISSION.orders },
  {
    id: 'autoservice-warehouse-group',
    permission: AUTOSERVICE_PERMISSION.warehouse,
    submenu: [
      { id: 'autoservice-warehouse', permission: AUTOSERVICE_PERMISSION.warehouse },
      { id: 'autoservice-warehouse-receipts', permission: AUTOSERVICE_PERMISSION.warehouse },
      { id: 'autoservice-warehouse-expenses', permission: AUTOSERVICE_PERMISSION.warehouse },
    ],
  },
  { id: 'autoservice-finance', permission: AUTOSERVICE_PERMISSION.finance },
  { id: 'autoservice-reports', permission: AUTOSERVICE_PERMISSION.reports },
  { id: 'autoservice-clients', permission: AUTOSERVICE_PERMISSION.clients },
  { id: 'autoservice-inspections', permission: AUTOSERVICE_PERMISSION.inspections },
  { id: 'autoservice-settings', permission: AUTOSERVICE_PERMISSION.settings, settingsOnly: true },
];

export function hasAutoserviceBypass(user) {
  return Boolean(user?.is_admin || user?.is_director || user?.is_seller);
}

export function hasAutoservicePermission(user, permissionCodes, code) {
  if (hasAutoserviceBypass(user)) return true;
  if (!user?.is_employee) return false;
  return Boolean(permissionCodes?.includes(code));
}

export function hasAnyAutoservicePermission(user, permissionCodes) {
  if (hasAutoserviceBypass(user)) return true;
  if (!user?.is_employee) return false;
  return AUTOSERVICE_PERMISSION_CODES.some((code) => permissionCodes?.includes(code));
}

export function canAccessAutoserviceSection(user, permissionCodes, section) {
  const code = AUTOSERVICE_SECTION_PERMISSION[section];
  if (!code) return hasAnyAutoservicePermission(user, permissionCodes);
  return hasAutoservicePermission(user, permissionCodes, code);
}

export function canAccessAutoserviceSettingsPermission(user, permissionCodes) {
  if (hasAutoserviceBypass(user)) return true;
  return hasAutoservicePermission(user, permissionCodes, AUTOSERVICE_PERMISSION.settings);
}

export function getDefaultAutoserviceStaffPath(user, permissionCodes) {
  const first = AUTOSERVICE_MENU_ITEMS.find((item) => {
    if (item.settingsOnly && !canAccessAutoserviceSettingsPermission(user, permissionCodes)) {
      return false;
    }
    return hasAutoservicePermission(user, permissionCodes, item.permission);
  });
  if (!first) return '/garage';
  if (first.submenu?.length) {
    return '/autoservice/warehouse';
  }
  const pathMap = {
    'autoservice-planner': '/autoservice/planner',
    'autoservice-orders': '/autoservice/orders',
    'autoservice-finance': '/autoservice/finance',
    'autoservice-reports': '/autoservice/reports',
    'autoservice-clients': '/autoservice/clients',
    'autoservice-inspections': '/autoservice/inspections',
    'autoservice-settings': '/autoservice/settings',
  };
  return pathMap[first.id] || '/garage';
}
