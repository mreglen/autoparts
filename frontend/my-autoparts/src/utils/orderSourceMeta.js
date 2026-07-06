export const ORDER_SOURCE_META = {
  used: {
    logo: '/logos/svoygarage.png',
    label: 'Б/у',
    title: 'Свой Гараж · Б/у',
  },
  new: {
    logo: '/logos/svoygarage.png',
    label: 'Новые',
    title: 'Новые запчасти · от поставщика',
  },
  avito: {
    logo: '/logos/avito.png',
    label: 'Авито',
    title: 'Авито',
  },
};

export function getOrderSourceMeta(source) {
  return ORDER_SOURCE_META[source] || null;
}

export function buildUnifiedOrders(usedOrders, newOrders, avitoOrders, options = {}) {
  const { canViewNewOrders = false, avitoProActive = false } = options;
  const items = [];

  (usedOrders || []).forEach((order) => {
    items.push({ source: 'used', order, createdAt: order.created_at });
  });

  if (canViewNewOrders) {
    (newOrders || []).forEach((order) => {
      items.push({ source: 'new', order, createdAt: order.created_at });
    });
  }

  if (avitoProActive) {
    (avitoOrders || []).forEach((order) => {
      items.push({ source: 'avito', order, createdAt: order.created_at });
    });
  }

  return items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export function getUnifiedOrderKey(entry) {
  if (!entry?.order) return '';
  const id = entry.source === 'avito' ? entry.order.id : entry.order.id;
  return `${entry.source}-${id}`;
}
