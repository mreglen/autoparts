export const AUTOSERVICE_PERMISSION = {
  planner: 'autoservice.planner',
  orders: 'autoservice.orders',
  ordersOwn: 'autoservice.orders.own',
  payrollOwn: 'autoservice.orders.own',
  warehouse: 'autoservice.warehouse',
  finance: 'autoservice.finance',
  reports: 'autoservice.reports',
  clients: 'autoservice.clients',
  inspections: 'autoservice.inspections',
  settings: 'autoservice.settings',
};

export const AUTOSERVICE_PERMISSION_CODES = Object.values(AUTOSERVICE_PERMISSION);

export const AUTOSERVICE_ORDERS_SECTION_CODES = [
  AUTOSERVICE_PERMISSION.orders,
  AUTOSERVICE_PERMISSION.ordersOwn,
];

export const AUTOSERVICE_SECTION_PERMISSION = {
  planner: AUTOSERVICE_PERMISSION.planner,
  orders: AUTOSERVICE_ORDERS_SECTION_CODES,
  'order-form': AUTOSERVICE_ORDERS_SECTION_CODES,
  'order-print': AUTOSERVICE_ORDERS_SECTION_CODES,
  'order-upd-print': AUTOSERVICE_PERMISSION.orders,
  'order-invoice-print': AUTOSERVICE_PERMISSION.orders,
  clients: AUTOSERVICE_PERMISSION.clients,
  inspections: AUTOSERVICE_PERMISSION.inspections,
  finance: AUTOSERVICE_PERMISSION.finance,
  reports: AUTOSERVICE_PERMISSION.reports,
  payroll: AUTOSERVICE_ORDERS_SECTION_CODES,
  warehouse: AUTOSERVICE_PERMISSION.warehouse,
  'warehouse-receipts': AUTOSERVICE_PERMISSION.warehouse,
  'warehouse-expenses': AUTOSERVICE_PERMISSION.warehouse,
  settings: AUTOSERVICE_PERMISSION.settings,
};

export const AUTOSERVICE_MENU_ITEMS = [
  { id: 'autoservice-planner', permission: AUTOSERVICE_PERMISSION.planner },
  {
    id: 'autoservice-orders',
    permission: AUTOSERVICE_PERMISSION.orders,
    anyOf: AUTOSERVICE_ORDERS_SECTION_CODES,
  },
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
  {
    id: 'autoservice-payroll',
    permission: AUTOSERVICE_PERMISSION.payrollOwn,
    anyOf: [AUTOSERVICE_PERMISSION.payrollOwn],
    employeeOnly: true,
  },
  { id: 'autoservice-clients', permission: AUTOSERVICE_PERMISSION.clients },
  { id: 'autoservice-inspections', permission: AUTOSERVICE_PERMISSION.inspections },
  { id: 'autoservice-settings', permission: AUTOSERVICE_PERMISSION.settings, settingsOnly: true },
];

/** Work pages for shop employees (folded into client Autoservice menu). */
export const AUTOSERVICE_SHOP_EMPLOYEE_WORK_ITEMS = [
  {
    id: 'autoservice-orders',
    label: 'Заказ-наряды',
    permission: AUTOSERVICE_PERMISSION.orders,
    anyOf: AUTOSERVICE_ORDERS_SECTION_CODES,
  },
  {
    id: 'autoservice-payroll',
    label: 'Зарплата',
    permission: AUTOSERVICE_PERMISSION.payrollOwn,
    anyOf: AUTOSERVICE_ORDERS_SECTION_CODES,
  },
];

export function hasAutoserviceBypass(user) {
  return Boolean(user?.is_admin || user?.is_director || user?.is_seller);
}

/** Employee of an autoservice org without seller/director roles. */
export function isAutoserviceShopEmployee(user) {
  if (!user) return false;
  if (user.is_admin || user.is_director || user.is_seller) return false;
  if (!user.is_employee) return false;
  return user.organization_is_autoservice === true;
}

export function hasAutoservicePermission(user, permissionCodes, code) {
  if (hasAutoserviceBypass(user)) return true;
  if (!user?.is_employee) return false;
  return Boolean(permissionCodes?.includes(code));
}

export function hasAnyListedAutoservicePermission(user, permissionCodes, codes) {
  const list = Array.isArray(codes) ? codes : [codes];
  return list.some((code) => hasAutoservicePermission(user, permissionCodes, code));
}

export function getAutoserviceShopEmployeeWorkMenuItems(user, permissionCodes) {
  if (!isAutoserviceShopEmployee(user)) return [];
  return AUTOSERVICE_SHOP_EMPLOYEE_WORK_ITEMS.filter((item) => {
    if (item.anyOf?.length) {
      return hasAnyListedAutoservicePermission(user, permissionCodes, item.anyOf);
    }
    return hasAutoservicePermission(user, permissionCodes, item.permission);
  }).map((item) => ({ id: item.id, label: item.label }));
}

export function canAccessRepairOrders(user, permissionCodes) {
  return hasAnyListedAutoservicePermission(user, permissionCodes, AUTOSERVICE_ORDERS_SECTION_CODES);
}

export function canReviewRepairOrders(user, permissionCodes) {
  return hasAutoservicePermission(user, permissionCodes, AUTOSERVICE_PERMISSION.orders);
}

export function hasAnyAutoservicePermission(user, permissionCodes) {
  if (hasAutoserviceBypass(user)) return true;
  if (!user?.is_employee) return false;
  return AUTOSERVICE_PERMISSION_CODES.some((code) => permissionCodes?.includes(code));
}

export function canAccessAutoserviceSection(user, permissionCodes, section) {
  if (section === 'payroll' && hasAutoserviceBypass(user)) {
    return false;
  }
  // Shop employees: only orders (+ form/print) and payroll for now.
  if (isAutoserviceShopEmployee(user)) {
    const allowed = new Set(['orders', 'order-form', 'order-print', 'payroll']);
    if (!allowed.has(section)) return false;
  }
  const code = AUTOSERVICE_SECTION_PERMISSION[section];
  if (!code) return hasAnyAutoservicePermission(user, permissionCodes);
  return hasAnyListedAutoservicePermission(user, permissionCodes, code);
}

export function canAccessAutoserviceSettingsPermission(user, permissionCodes) {
  if (hasAutoserviceBypass(user)) return true;
  return hasAutoservicePermission(user, permissionCodes, AUTOSERVICE_PERMISSION.settings);
}

export function getDefaultAutoserviceStaffPath(user, permissionCodes) {
  const menuSource = isAutoserviceShopEmployee(user)
    ? AUTOSERVICE_SHOP_EMPLOYEE_WORK_ITEMS
    : AUTOSERVICE_MENU_ITEMS;
  const first = menuSource.find((item) => {
    if (item.settingsOnly && !canAccessAutoserviceSettingsPermission(user, permissionCodes)) {
      return false;
    }
    if (item.employeeOnly && hasAutoserviceBypass(user)) {
      return false;
    }
    if (item.anyOf?.length) {
      return hasAnyListedAutoservicePermission(user, permissionCodes, item.anyOf);
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
    'autoservice-payroll': '/autoservice/payroll',
    'autoservice-clients': '/autoservice/clients',
    'autoservice-inspections': '/autoservice/inspections',
    'autoservice-settings': '/autoservice/settings',
  };
  return pathMap[first.id] || '/garage';
}
