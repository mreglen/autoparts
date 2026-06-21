const PERMISSION_GROUP_DEFS = [
  {
    id: 'sales',
    title: 'Продажи',
    description: 'Заказы и продажи покупателям',
    match: (code) =>
      code.startsWith('sales.') || code === 'warehouse-sales' || code === 'sales.returns',
  },
  {
    id: 'warehouse',
    title: 'Склад',
    description: 'Запчасти, автомобили, движение товара',
    match: (code) =>
      ['my-parts', 'vehicles', 'stock-in', 'stock-out'].includes(code),
  },
  {
    id: 'finance',
    title: 'Финансы',
    description: 'Отчёты и аналитика',
    match: (code) => code.startsWith('finance.'),
  },
  {
    id: 'settings',
    title: 'Настройки',
    description: 'Печать, интеграции, адреса',
    match: (code) =>
      code.startsWith('settings.') ||
      code === 'storage-addresses' ||
      code === 'sellers',
  },
  {
    id: 'admin',
    title: 'Администрирование',
    description: 'Журнал и служебные разделы',
    match: (code) => code.startsWith('admin.'),
  },
];

export function groupPermissionsForGrid(permissions) {
  const sorted = [...(permissions || [])].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', 'ru')
  );
  const assigned = new Set();
  const groups = [];

  for (const def of PERMISSION_GROUP_DEFS) {
    const items = sorted.filter((p) => {
      if (assigned.has(p.id)) return false;
      return def.match(p.code || '');
    });
    items.forEach((p) => assigned.add(p.id));
    if (items.length > 0) {
      groups.push({
        id: def.id,
        title: def.title,
        description: def.description,
        permissions: items,
      });
    }
  }

  const rest = sorted.filter((p) => !assigned.has(p.id));
  if (rest.length > 0) {
    groups.push({
      id: 'other',
      title: 'Прочее',
      description: 'Дополнительные права',
      permissions: rest,
    });
  }

  return groups;
}
