import {
  AUTOSERVICE_PERMISSION,
  canAccessAutoserviceSection,
  canAccessAutoserviceSettingsPermission,
  getAutoserviceShopEmployeeWorkMenuItems,
  getDefaultAutoserviceStaffPath,
  hasAnyAutoservicePermission,
  hasAutoservicePermission,
  isAutoserviceShopEmployee,
} from './autoservicePermissions';
import {
  canAccessAutoserviceClientMenu,
  canAccessAutoserviceStaffMenu,
} from './autoservicePublic';
import { getAvailableTabs } from '../pages/Profile/menu/profileMenuConfig';
import {
  CABINET_MODE_AUTOSERVICE,
  CABINET_MODE_BUYER,
  getAvailableCabinetModes,
  showCabinetModeSwitch,
} from './cabinetMode';

const employee = {
  is_employee: true,
  is_director: false,
  is_seller: false,
  is_admin: false,
  organization_id: 'org-1',
  organization_is_autoservice: true,
};

describe('autoservicePermissions', () => {
  it('allows director bypass without explicit codes', () => {
    const director = { ...employee, is_director: true, is_employee: false };
    expect(hasAutoservicePermission(director, [], AUTOSERVICE_PERMISSION.orders)).toBe(true);
    expect(canAccessAutoserviceSettingsPermission(director, [])).toBe(true);
  });

  it('requires explicit autoservice codes for employees', () => {
    expect(hasAutoservicePermission(employee, [], AUTOSERVICE_PERMISSION.orders)).toBe(false);
    expect(
      hasAutoservicePermission(employee, [AUTOSERVICE_PERMISSION.orders], AUTOSERVICE_PERMISSION.orders),
    ).toBe(true);
    expect(hasAnyAutoservicePermission(employee, [AUTOSERVICE_PERMISSION.planner])).toBe(true);
  });

  it('maps route sections to permission codes', () => {
    expect(canAccessAutoserviceSection(employee, [AUTOSERVICE_PERMISSION.finance], 'finance')).toBe(false);
    expect(canAccessAutoserviceSection(employee, [AUTOSERVICE_PERMISSION.ordersOwn], 'orders')).toBe(true);
    expect(canAccessAutoserviceSection(employee, [AUTOSERVICE_PERMISSION.ordersOwn], 'payroll')).toBe(true);
    expect(
      canAccessAutoserviceSection(employee, [AUTOSERVICE_PERMISSION.settings], 'settings'),
    ).toBe(false);
  });

  it('returns first available staff path for employee', () => {
    expect(getDefaultAutoserviceStaffPath(employee, [AUTOSERVICE_PERMISSION.clients])).toBe('/garage');
    expect(getDefaultAutoserviceStaffPath(employee, [AUTOSERVICE_PERMISSION.ordersOwn])).toBe('/autoservice/orders');
    expect(getDefaultAutoserviceStaffPath(employee, [])).toBe('/garage');
  });

  it('lets own-order employees open the orders section', () => {
    expect(
      canAccessAutoserviceSection(employee, [AUTOSERVICE_PERMISSION.ordersOwn], 'orders'),
    ).toBe(true);
    expect(
      canAccessAutoserviceSection(employee, [AUTOSERVICE_PERMISSION.ordersOwn], 'order-form'),
    ).toBe(true);
    expect(
      canAccessAutoserviceSection(employee, [AUTOSERVICE_PERMISSION.ordersOwn], 'order-print'),
    ).toBe(true);
  });
});

describe('autoservice shop employee single menu', () => {
  it('detects shop employees and hides cabinet switch', () => {
    expect(isAutoserviceShopEmployee(employee)).toBe(true);
    expect(getAvailableCabinetModes(employee)).toEqual([CABINET_MODE_BUYER]);
    expect(showCabinetModeSwitch(employee)).toBe(false);
  });

  it('folds orders and payroll into client Autoservice menu', () => {
    const options = {
      showAutoservice: true,
      autoserviceOrganizationId: 'org-1',
      cabinetMode: CABINET_MODE_BUYER,
      organizationIsAutoservice: true,
      permissionCodes: [AUTOSERVICE_PERMISSION.ordersOwn],
      isAutoserviceClient: false,
    };

    expect(canAccessAutoserviceStaffMenu(employee, options)).toBe(true);
    expect(canAccessAutoserviceClientMenu(employee, options)).toBe(true);
    expect(getAutoserviceShopEmployeeWorkMenuItems(employee, options.permissionCodes)).toEqual([
      { id: 'autoservice-orders', label: 'Заказ-наряд' },
      { id: 'autoservice-payroll', label: 'Зарплата' },
    ]);

    const tabs = getAvailableTabs(employee, options.permissionCodes, options);
    expect(tabs.map((tab) => tab.id)).toEqual(['purchases', 'chats', 'autoservice', 'profile']);
    expect(showCabinetModeSwitch(employee, options)).toBe(false);

    const autoserviceTab = tabs.find((tab) => tab.id === 'autoservice');
    expect(autoserviceTab.submenu.map((item) => item.id)).toEqual([
      'autoservice-garage',
      'autoservice-repair-booking',
      'autoservice-repair-history',
      'autoservice-orders',
      'autoservice-payroll',
    ]);
    expect(tabs.find((tab) => tab.id === 'autoservice-staff')).toBeUndefined();
  });

  it('does not expose other staff sections for shop employees', () => {
    expect(
      canAccessAutoserviceSection(employee, [AUTOSERVICE_PERMISSION.finance], 'finance'),
    ).toBe(false);
    expect(
      canAccessAutoserviceSection(employee, [AUTOSERVICE_PERMISSION.clients], 'clients'),
    ).toBe(false);
  });
});

describe('autoservice staff menu filtering', () => {
  it('hides autoservice staff menu for employee without codes', () => {
    const options = {
      showAutoservice: true,
      autoserviceOrganizationId: 'org-1',
      cabinetMode: CABINET_MODE_BUYER,
      organizationIsAutoservice: true,
      permissionCodes: [],
    };

    expect(canAccessAutoserviceStaffMenu(employee, options)).toBe(false);

    const tabs = getAvailableTabs(employee, [], options);
    const staffTab = tabs.find((tab) => tab.id === 'autoservice-staff');
    expect(staffTab).toBeUndefined();
    const autoserviceTab = tabs.find((tab) => tab.id === 'autoservice');
    expect(autoserviceTab?.submenu?.some((item) => item.id === 'autoservice-orders')).toBeFalsy();
  });

  it('shows only granted work items for shop employee with full orders permission', () => {
    const options = {
      showAutoservice: true,
      autoserviceOrganizationId: 'org-1',
      cabinetMode: CABINET_MODE_BUYER,
      organizationIsAutoservice: true,
      permissionCodes: [AUTOSERVICE_PERMISSION.orders, AUTOSERVICE_PERMISSION.clients],
      isAutoserviceClient: true,
    };

    const tabs = getAvailableTabs(employee, options.permissionCodes, options);
    const autoserviceTab = tabs.find((tab) => tab.id === 'autoservice');
    expect(autoserviceTab.submenu.map((item) => item.id)).toEqual([
      'autoservice-garage',
      'autoservice-repair-booking',
      'autoservice-repair-history',
      'autoservice-orders',
      'autoservice-payroll',
    ]);
  });
});
