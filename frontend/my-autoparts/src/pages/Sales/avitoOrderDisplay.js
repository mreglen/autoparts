/**
 * Разбор полей заказа Авито для UI (согласовано с AvitoOrderCard и ответом API / синком БД).
 */

export function getAvitoOrderItems(order) {
  const avitoData = order.avito_data || {};
  const raw = avitoData.items ?? avitoData.products;
  return Array.isArray(raw) ? raw : [];
}

export function getAvitoDisplayTotal(order) {
  const avitoData = order.avito_data || {};
  const prices = avitoData.prices || {};
  const t = prices.total;
  if (t != null && t !== '') return Number(t);
  return Number(order.total_amount ?? 0);
}

export function getAvitoBuyerAndDelivery(order) {
  const avitoData = order.avito_data || {};
  const delivery = avitoData.delivery || {};
  const buyerFromDelivery = delivery.buyerInfo || {};
  const buyerFromRoot = avitoData.buyer || {};

  const buyerName =
    buyerFromDelivery.fullName ||
    buyerFromRoot.fullName ||
    buyerFromRoot.name ||
    order.recipient_name ||
    [order.avito_last_name, order.avito_first_name, order.avito_patronymic]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    'Не указан';

  const buyerPhone =
    buyerFromDelivery.phoneNumber ||
    buyerFromRoot.phone ||
    order.recipient_phone ||
    '';

  return { avitoData, delivery, buyerName, buyerPhone: buyerPhone || 'Не указан' };
}

const PICKUP_HINTS = ['самовывоз', 'вывоз', 'pickup', 'пвз', 'point'];

export function isAvitoPickupDelivery(delivery) {
  const serviceName = (delivery.serviceName || '').toLowerCase();
  const serviceType = String(
    delivery.serviceType ?? delivery.deliveryType ?? ''
  ).toLowerCase();
  const combined = `${serviceName} ${serviceType}`;
  return PICKUP_HINTS.some((k) => combined.includes(k));
}

/** Строка доставки для мобильной карточки: как на десктопе, с явной меткой самовывоза при необходимости */
export function getAvitoMobileDeliveryText(delivery) {
  const serviceName = delivery.serviceName || 'Не указан';
  const pickup = isAvitoPickupDelivery(delivery);
  if (!pickup) return serviceName;
  const sn = serviceName.toLowerCase();
  if (PICKUP_HINTS.some((k) => sn.includes(k))) return serviceName;
  return `Самовывоз — ${serviceName}`;
}

export function getAvitoLineItemTitle(item) {
  return item.title || item.name || item.adTitle || 'Товар';
}

export function getAvitoLineItemQty(item) {
  const q = item.count ?? item.quantity;
  return q != null && q !== '' ? Number(q) : 1;
}

export function getAvitoLineItemTotal(item) {
  const pt = item.prices?.total;
  if (pt != null && pt !== '') return Number(pt);
  const unit = Number(item.price ?? item.prices?.price ?? 0);
  return unit * getAvitoLineItemQty(item);
}

const AVITO_SKIP_REASON_LABELS = {
  already_processed: 'Заказ уже полностью проведён на складе',
  no_items: 'В заказе нет позиций',
  listing_not_found: 'Товар не привязан к объявлению Авито',
  product_not_found: 'Товар не найден в каталоге',
  missing_storage_location: 'У товара не указана ячейка склада',
  zero_price: 'Нет цены в заказе Авито и в карточке товара',
  insufficient_quantity: 'Недостаточно товара на складе',
  stock_out_error: 'Ошибка списания со склада',
  item_processing_error: 'Ошибка обработки позиции',
};

export function getAvitoSkipReasonLabel(code) {
  if (!code) return 'Неизвестная причина';
  return AVITO_SKIP_REASON_LABELS[code] || code;
}

export function getAvitoWarehouseFulfillment(order) {
  return order?.warehouse_fulfillment || null;
}

export function getAvitoWarehouseMismatch(order) {
  return Boolean(getAvitoWarehouseFulfillment(order)?.mismatch);
}

export function getAvitoWarehouseCanRetry(order) {
  return Boolean(getAvitoWarehouseFulfillment(order)?.can_retry);
}

export function getAvitoSkipReasonsForDisplay(order) {
  const wf = getAvitoWarehouseFulfillment(order);
  const reasons = wf?.skip_reasons;
  if (!Array.isArray(reasons) || reasons.length === 0) return [];
  return reasons.map((r) => {
    if (typeof r === 'string') {
      return { code: r, label: getAvitoSkipReasonLabel(r) };
    }
    const code = r?.code || 'unknown';
    return {
      code,
      label: r?.message || getAvitoSkipReasonLabel(code),
    };
  });
}
