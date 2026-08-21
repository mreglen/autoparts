import {
  AUTOSERVICE_PERMISSION,
  canAccessAutoserviceSection,
  canAccessAutoserviceSettingsPermission,
  getDefaultAutoserviceStaffPath,
  hasAnyAutoservicePermission,
  hasAutoservicePermission,
} from './autoservicePermissions';
import { canAccessAutoserviceStaffMenu } from './autoservicePublic';
import { getAvailableTabs } from '../pages/Profile/menu/profileMenuConfig';
import { CABINET_MODE_AUTOSERVICE } from './cabinetMode';

const employee = {
  is_employee: true,
  is_director: false,
  is_seller: false,
  is_admin: false,
  organization_id: 'org-1',
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
    expect(canAccessAutoserviceSection(employee, [AUTOSERVICE_PERMISSION.finance], 'finance')).toBe(true);
    expect(canAccessAutoserviceSection(employee, [AUTOSERVICE_PERMISSION.finance], 'reports')).toBe(false);
    expect(
      canAccessAutoserviceSection(employee, [AUTOSERVICE_PERMISSION.settings], 'settings'),
    ).toBe(true);
  });

  it('returns first available staff path for employee', () => {
    expect(getDefaultAutoserviceStaffPath(employee, [AUTOSERVICE_PERMISSION.clients])).toBe('/autoservice/clients');
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

describe('autoservice staff menu filtering', () => {
  it('hides autoservice staff menu for employee without codes', () => {
    const options = {
      showAutoservice: true,
      autoserviceOrganizationId: 'org-1',
      cabinetMode: CABINET_MODE_AUTOSERVICE,
      organizationIsAutoservice: true,
      permissionCodes: [],
    };

    expect(canAccessAutoserviceStaffMenu(employee, options)).toBe(false);

    const tabs = getAvailableTabs(employee, [], options);
    const staffTab = tabs.find((tab) => tab.id === 'autoservice-staff');
    expect(staffTab).toBeUndefined();
  });

  it('shows only granted autoservice submenu items', () => {
    const options = {
      showAutoservice: true,
      autoserviceOrganizationId: 'org-1',
      cabinetMode: CABINET_MODE_AUTOSERVICE,
      organizationIsAutoservice: true,
      permissionCodes: [AUTOSERVICE_PERMISSION.orders, AUTOSERVICE_PERMISSION.clients],
    };

    expect(canAccessAutoserviceStaffMenu(employee, options)).toBe(true);

    const tabs = getAvailableTabs(employee, options.permissionCodes, options);
    const staffTab = tabs.find((tab) => tab.id === 'autoservice-staff');

    expect(staffTab).toBeTruthy();
    expect(staffTab.submenu.map((item) => item.id)).toEqual([
      'autoservice-orders',
      'autoservice-clients',
    ]);
  });

  it('shows orders menu for employees with own-order permission', () => {
    const options = {
      showAutoservice: true,
      autoserviceOrganizationId: 'org-1',
      cabinetMode: CABINET_MODE_AUTOSERVICE,
      organizationIsAutoservice: true,
      permissionCodes: [AUTOSERVICE_PERMISSION.ordersOwn],
    };

    const tabs = getAvailableTabs(employee, options.permissionCodes, options);
    const staffTab = tabs.find((tab) => tab.id === 'autoservice-staff');

    expect(staffTab).toBeTruthy();
    expect(staffTab.submenu.map((item) => item.id)).toEqual(['autoservice-orders']);
  });
});
