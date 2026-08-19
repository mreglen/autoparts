export const RETURN_REASONS = [
  { id: 'defect', label: 'Брак / неисправность' },
  { id: 'wrong_item', label: 'Не тот товар' },
  { id: 'not_as_described', label: 'Не соответствует описанию' },
  { id: 'changed_mind', label: 'Передумал' },
  { id: 'other', label: 'Другое' },
];

export const RETURN_STATUS_LABELS = {
  requested: 'Заявка создана',
  reviewing: 'На рассмотрении',
  approved: 'Возврат согласован',
  rejected: 'Отклонён',
  cancelled: 'Отменён',
  sent: 'Отправлен поставщику',
  received: 'Товар получен',
  refunded: 'Деньги возвращены',
  closed: 'Закрыто',
};

export const RETURN_STATUS_COLORS = {
  requested: 'bg-amber-50 text-amber-800 ring-amber-100',
  reviewing: 'bg-blue-50 text-blue-800 ring-blue-100',
  approved: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
  rejected: 'bg-red-50 text-red-800 ring-red-100',
  cancelled: 'bg-gray-100 text-gray-700 ring-gray-200',
  sent: 'bg-violet-50 text-violet-800 ring-violet-100',
  received: 'bg-indigo-50 text-indigo-800 ring-indigo-100',
  refunded: 'bg-teal-50 text-teal-800 ring-teal-100',
  closed: 'bg-gray-100 text-gray-700 ring-gray-200',
};

export const TERMINAL_RETURN_STATUSES = new Set(['rejected', 'cancelled', 'closed']);

export const SELLER_NEXT_STATUSES = {
  requested: ['reviewing', 'approved', 'rejected'],
  reviewing: ['approved', 'rejected'],
  approved: ['received'],
  received: ['refunded'],
  refunded: ['closed'],
};

export function getReturnStatusLabel(code) {
  return RETURN_STATUS_LABELS[code] || code;
}

export function getReturnStatusColor(code) {
  return RETURN_STATUS_COLORS[code] || RETURN_STATUS_COLORS.requested;
}

export function getReturnReasonLabel(id) {
  return RETURN_REASONS.find((r) => r.id === id)?.label || id;
}

export function isUsedOrderReturnEligible(order) {
  if (!order) return false;
  const status = order.status_code || '';
  if (!['delivered', 'closed'].includes(status)) return false;
  const items = order.items || [];
  return items.some((item) => item.product_id);
}

export const AVITO_RETURN_STATUS_LABELS = {
  on_return: 'На возврате',
  in_dispute: 'Спор',
  in_transit_return: 'Возврат в пути',
  on_delivery_return: 'Доставка возврата',
};
