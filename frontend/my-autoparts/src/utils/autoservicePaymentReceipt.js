export const AUTOSERVICE_PAYMENT_METHOD_LABELS = {
  cash: 'Наличными',
  card: 'Банковской картой',
  bank: 'На расчётный счёт',
};

export const AUTOSERVICE_PAYMENT_RECEIPT_TITLES = {
  cash: 'Кассовый чек',
  card: 'Чек об оплате банковской картой',
  bank: 'Квитанция об оплате на расчётный счёт',
  mixed: 'Квитанция об оплате',
};

export function resolvePaymentReceiptTitle(methods) {
  const unique = [...new Set((methods || []).filter(Boolean))];
  if (unique.length === 1) {
    return AUTOSERVICE_PAYMENT_RECEIPT_TITLES[unique[0]] || AUTOSERVICE_PAYMENT_RECEIPT_TITLES.mixed;
  }
  return AUTOSERVICE_PAYMENT_RECEIPT_TITLES.mixed;
}

export function paymentReceiptPrintUrl(orderId, paymentIds) {
  const ids = (paymentIds || []).filter(Boolean);
  if (!orderId || ids.length === 0) return '';
  const query = new URLSearchParams({ payments: ids.join(',') });
  return `/autoservice/orders/${orderId}/print/receipt?${query.toString()}`;
}

export function parsePaymentReceiptQuery(search) {
  const params = new URLSearchParams(search || '');
  const raw = String(params.get('payments') || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}
