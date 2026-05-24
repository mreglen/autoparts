export function formatGarageOrderDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatGarageOrderPrice(amount) {
  return `${Number(amount || 0).toLocaleString('ru-RU')} ₽`;
}

export function getGarageDeliveryInfo(order) {
  if (order.delivery_type === 'pickup') {
    return `Самовывоз · ${order.pickup_address || 'адрес уточняется'}`;
  }
  if (order.delivery_type === 'transport') {
    if (order.transport_company) {
      return `${order.transport_company} · ${order.delivery_address || 'адрес уточняется'}`;
    }
    return `Доставка · ${order.delivery_address || 'адрес уточняется'}`;
  }
  return order.delivery_method_name || 'Способ доставки уточняется';
}

export const GARAGE_STATUS_COLORS = {
  pending: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  confirmed: 'bg-blue-50 text-blue-800 ring-1 ring-blue-100',
  rejected: 'bg-red-50 text-red-800 ring-1 ring-red-100',
  assembled: 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100',
  shipped: 'bg-violet-50 text-violet-800 ring-1 ring-violet-100',
  delivered: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100',
  closed: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200',
};

export const GARAGE_STATUS_NAMES = {
  pending: 'В ожидании',
  confirmed: 'Подтверждён',
  rejected: 'Не подтверждён',
  assembled: 'Сформирован',
  shipped: 'В доставке',
  delivered: 'Получен',
  closed: 'Закрыт',
};

export const GARAGE_ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'assembled', 'shipped']);
export const GARAGE_COMPLETED_STATUSES = new Set(['delivered', 'closed']);

export const AVITO_STATUS_COLORS = {
  on_confirmation: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  ready_to_ship: 'bg-blue-50 text-blue-800 ring-1 ring-blue-100',
  in_transit: 'bg-violet-50 text-violet-800 ring-1 ring-violet-100',
  delivered: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100',
  canceled: 'bg-red-50 text-red-800 ring-1 ring-red-100',
  closed: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200',
  on_return: 'bg-orange-50 text-orange-800 ring-1 ring-orange-100',
  in_dispute: 'bg-pink-50 text-pink-800 ring-1 ring-pink-100',
};

export const AVITO_ACTIVE_STATUSES = new Set(['on_confirmation', 'ready_to_ship', 'in_transit', 'in_dispute']);
export const AVITO_COMPLETED_STATUSES = new Set(['delivered', 'closed']);
export const AVITO_CANCELED_STATUSES = new Set(['canceled', 'on_return']);
