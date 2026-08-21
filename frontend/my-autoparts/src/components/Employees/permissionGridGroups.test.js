import { groupPermissionsForGrid } from './permissionGridGroups';

describe('groupPermissionsForGrid autoservice', () => {
  it('groups autoservice.* permissions under Автосервис', () => {
    const permissions = [
      { id: 1, code: 'autoservice.planner', name: 'Планировщик' },
      { id: 2, code: 'autoservice.orders', name: 'Заказ-наряды' },
      { id: 3, code: 'finance.reports', name: 'Финансовые отчёты' },
    ];

    const groups = groupPermissionsForGrid(permissions);
    const autoserviceGroup = groups.find((group) => group.id === 'autoservice');

    expect(autoserviceGroup).toBeTruthy();
    expect(autoserviceGroup.title).toBe('Автосервис');
    expect(autoserviceGroup.permissions.map((item) => item.code)).toEqual([
      'autoservice.orders',
      'autoservice.planner',
    ]);
  });
});
