const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const weekdays = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function parseSupplierPrice(price) {
  const numericPrice = parseFloat(price);
  if (Number.isNaN(numericPrice) || numericPrice <= 0) return 0;
  return parseFloat(numericPrice.toFixed(2));
}

export function applyMarkup(price, markupPercent = 0) {
  const base = parseSupplierPrice(price);
  if (!base) return 0;
  const mult = 1 + Number(markupPercent) / 100;
  return parseFloat((base * mult).toFixed(2));
}

export function formatPriceRub(price) {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  return amount.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatDeliveryTimeText(deliveryStart, deliveryEnd) {
  const parts = formatDeliveryParts(deliveryStart, deliveryEnd);
  if (!parts) return '—';
  return `${parts.dateLine}, ${parts.timeLine}`;
}

/** Returns { dateLine, timeLine } or null. dateLine = day/month/weekday (or Сегодня/Завтра). */
export function formatDeliveryParts(deliveryStart, deliveryEnd) {
  if (!deliveryStart || !deliveryEnd) return null;
  try {
    const startDate = new Date(deliveryStart);
    const endDate = new Date(deliveryEnd);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = startDate.getDate() === today.getDate()
      && startDate.getMonth() === today.getMonth()
      && startDate.getFullYear() === today.getFullYear();
    const isTomorrow = startDate.getDate() === tomorrow.getDate()
      && startDate.getMonth() === tomorrow.getMonth()
      && startDate.getFullYear() === tomorrow.getFullYear();

    const dateLine = isToday
      ? 'Сегодня'
      : isTomorrow
        ? 'Завтра'
        : `${startDate.getDate()} ${monthNames[startDate.getMonth()]} ${weekdays[startDate.getDay()]}`;

    const startTime = startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const endTime = endDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return {
      dateLine,
      timeLine: `с ${startTime} до ${endTime}`,
    };
  } catch (_e) {
    return null;
  }
}

export function getMinStockPrice(stocks, markupPercent = 0) {
  const prices = (stocks || [])
    .map((stock) => applyMarkup(stock?.price, markupPercent))
    .filter((value) => value > 0);
  if (!prices.length) return null;
  return Math.min(...prices);
}

export function summarizeStocks(stocks, markupPercent = 0) {
  const active = (stocks || []).filter(
    (stock) => stock?.price && Number(stock.price) > 0 && Number(stock.available_count || 0) > 0
  );
  const minPrice = getMinStockPrice(active, markupPercent);
  const totalQty = active.reduce((sum, stock) => sum + Number(stock.available_count || 0), 0);
  return {
    warehouseCount: active.length,
    minPrice,
    totalQty,
    active,
  };
}
