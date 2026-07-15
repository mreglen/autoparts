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

const DELIVERY_TYPE_LABELS = {
  pickup: 'Самовывоз',
  pvz: 'ПВЗ',
  courier: 'Курьер',
  transport: 'Доставка',
};

function formatDeliveryAddress(order) {
  const parts = [
    order.delivery_region_name,
    order.delivery_address,
  ].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return 'адрес уточняется';
}

export function getGarageDeliveryInfo(order) {
  if (order.delivery_method_name) {
    return order.delivery_method_name;
  }

  const type = order.delivery_type || '';
  const typeLabel = DELIVERY_TYPE_LABELS[type] || (type ? type : null);

  if (type === 'pickup') {
    const addr = order.pickup_address || formatDeliveryAddress(order);
    return `${typeLabel || 'Самовывоз'} · ${addr}`;
  }

  if (type === 'pvz' || type === 'courier' || type === 'transport') {
    const carrier = order.transport_company;
    const addr = formatDeliveryAddress(order);
    if (carrier) {
      return `${typeLabel ? `${typeLabel} · ` : ''}${carrier} · ${addr}`;
    }
    return `${typeLabel || 'Доставка'} · ${addr}`;
  }

  if (typeLabel) {
    return `${typeLabel} · ${formatDeliveryAddress(order)}`;
  }

  return 'Способ доставки уточняется';
}

export const GARAGE_STATUS_COLORS = {
  pending: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  confirmed: 'bg-blue-50 text-blue-800 ring-1 ring-blue-100',
  rejected: 'bg-red-50 text-red-800 ring-1 ring-red-100',
  assembled: 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100',
  ready_for_pickup: 'bg-teal-50 text-teal-800 ring-1 ring-teal-100',
  shipped: 'bg-violet-50 text-violet-800 ring-1 ring-violet-100',
  delivered: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100',
  closed: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200',

  // Новые запчасти (нормализованные 5 стадий Rossko)
  new_waiting_confirmation: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  new_assembling: 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100',
  new_shipped: 'bg-violet-50 text-violet-800 ring-1 ring-violet-100',
  new_awaiting_arrival: 'bg-sky-50 text-sky-800 ring-1 ring-sky-100',
  new_ready_for_pickup: 'bg-teal-50 text-teal-800 ring-1 ring-teal-100',
  new_received: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100',
};

export const GARAGE_STATUS_NAMES = {
  pending: 'В ожидании',
  confirmed: 'Подтверждён',
  rejected: 'Не подтверждён',
  assembled: 'Сформирован',
  ready_for_pickup: 'К выдаче',
  shipped: 'В доставке',
  delivered: 'Получен',
  closed: 'Закрыт',

  new_waiting_confirmation: 'Ждёт подтверждения',
  new_assembling: 'Комплектуется',
  new_shipped: 'Отгружено',
  new_awaiting_arrival: 'Ожидает поступления',
  new_ready_for_pickup: 'К выдаче',
  new_received: 'Получен',
};

export const GARAGE_ACTIVE_STATUSES = new Set([
  'pending',
  'confirmed',
  'assembled',
  'ready_for_pickup',
  'shipped',

  'new_waiting_confirmation',
  'new_assembling',
  'new_shipped',
  'new_awaiting_arrival',
  'new_ready_for_pickup',
]);

export const GARAGE_COMPLETED_STATUSES = new Set(['delivered', 'closed', 'new_received']);

export const USED_ORDER_BUYER_HINTS = {
  pending: 'Продавец проверяет наличие. Обычно отвечает в течение рабочего дня.',
  confirmed: 'Заказ подтверждён. Продавец готовит товар.',
  assembled: 'Заказ собран. Ожидайте передачи или доставки.',
  ready_for_pickup: 'Покажите QR или назовите код при получении.',
  shipped: 'Товар передан в доставку или курьеру.',
  delivered: 'Заказ получен. Спасибо за покупку!',
  rejected: 'Продавец не подтвердил заказ. Напишите ему в чат.',
  closed: 'Заказ закрыт.',
};

export const NEW_ORDER_BUYER_HINTS = {
  new_waiting_confirmation: 'Заказ принят. Ждём подтверждения.',
  new_assembling: 'Заказ комплектуется.',
  new_shipped: 'Заказ отгружен поставщиком.',
  new_awaiting_arrival: 'Ожидаем поступление на точку выдачи.',
  new_ready_for_pickup: 'Покажите QR или назовите код при получении.',
  new_received: 'Заказ получен. Спасибо за покупку!',
};

export function getUsedOrderBuyerHint(statusCode) {
  const code = statusCode || 'pending';
  return USED_ORDER_BUYER_HINTS[code] || USED_ORDER_BUYER_HINTS.pending;
}

export function getNewOrderBuyerHint(statusCode) {
  const code = statusCode || 'new_waiting_confirmation';
  return NEW_ORDER_BUYER_HINTS[code] || null;
}

export function getGarageStatusName(statusCode) {
  return GARAGE_STATUS_NAMES[statusCode] || statusCode || 'В ожидании';
}

export function getGarageStatusColor(statusCode) {
  return GARAGE_STATUS_COLORS[statusCode] || 'bg-gray-100 text-gray-700 ring-1 ring-gray-200';
}

/** Статус для покупателя по умолчанию (новые запчасти), меняется только вручную. */
export const DEFAULT_NEW_PARTS_CUSTOMER_STATUS = 'new_waiting_confirmation';

export function normalizeNewPartsCustomerStatus(statusCode) {
  const code = statusCode || '';
  if (!code || code === 'pending') return DEFAULT_NEW_PARTS_CUSTOMER_STATUS;
  return code;
}

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
