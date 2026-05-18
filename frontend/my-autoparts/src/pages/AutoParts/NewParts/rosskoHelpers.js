export const getRosskoStockCount = (part) => {
  const stocks = part?.stocks?.stock;
  if (!stocks) return 0;
  const arr = Array.isArray(stocks) ? stocks : [stocks];
  return arr.reduce((sum, s) => sum + (parseInt(s?.count, 10) || 0), 0);
};

export const getRosskoMinPrice = (part) => {
  const stocks = part?.stocks?.stock;
  if (!stocks) return 0;
  const arr = Array.isArray(stocks) ? stocks : [stocks];
  return arr.reduce((min, s) => {
    const p = parseFloat(s?.price) || 0;
    if (!p) return min;
    return min === 0 ? p : Math.min(min, p);
  }, 0);
};

export const getRosskoEarliestDelivery = (part) => {
  const stocks = part?.stocks?.stock;
  if (!stocks) return Number.POSITIVE_INFINITY;
  const arr = Array.isArray(stocks) ? stocks : [stocks];
  let min = Number.POSITIVE_INFINITY;
  arr.forEach((s) => {
    if (!s?.deliveryStart) return;
    const t = new Date(s.deliveryStart).getTime();
    if (!Number.isNaN(t) && t < min) min = t;
  });
  return min;
};

export const isRosskoFastDelivery = (part) => {
  const stocks = part?.stocks?.stock;
  if (!stocks) return false;
  const arr = Array.isArray(stocks) ? stocks : [stocks];
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return arr.some((s) => {
    if (!s?.deliveryStart) return false;
    const d = new Date(s.deliveryStart);
    return (
      d.getDate() === today.getDate()
      && d.getMonth() === today.getMonth()
      && d.getFullYear() === today.getFullYear()
    ) || (
      d.getDate() === tomorrow.getDate()
      && d.getMonth() === tomorrow.getMonth()
      && d.getFullYear() === tomorrow.getFullYear()
    );
  });
};

export const mapPartToStocksData = (part) => {
  if (!part?.stocks?.stock) return [];
  const stocksArray = Array.isArray(part.stocks.stock) ? part.stocks.stock : [part.stocks.stock];
  return stocksArray
    .filter((stock) => stock && typeof stock === 'object')
    .map((stock) => ({
      stock_id: stock.id,
      price: parseFloat(stock.price) || 0,
      available_count: parseInt(stock.count, 10) || 0,
      delivery_start: stock.deliveryStart,
      delivery_end: stock.deliveryEnd,
      description: stock.description,
    }));
};

export const QUICK_SEARCH_CHIPS = [
  'W712/75',
  'тормозные колодки',
  'масляный фильтр',
  'KYB',
  'свечи зажигания',
  'антифриз',
  'ремень ГРМ',
  'фильтр салона',
];

export const POPULAR_BRANDS = ['MANN', 'BOSCH', 'KYB', 'NGK', 'VALEO', 'SACHS', 'FEBI', 'MAHLE'];
