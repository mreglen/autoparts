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

/** Цена продажи из Rossko: без копеек, к ближайшему значению, кратному 5 или 10 ₽. */
export const roundRosskoSalePrice = (rawPrice) => {
  const rubles = Math.round(Math.max(0, Number(rawPrice) || 0));
  if (rubles <= 0) return 0;
  const to5 = Math.round(rubles / 5) * 5;
  const to10 = Math.round(rubles / 10) * 10;
  return Math.abs(rubles - to5) <= Math.abs(rubles - to10) ? to5 : to10;
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

export const normalizeArticle = (value) => {
  if (!value) return '';
  return String(value).replace(/[^A-Za-z0-9А-Яа-яЁё]/gi, '').toUpperCase();
};

export const getRosskoParts = (data) => {
  let parts = data?.PartsList?.Part;
  if (!parts) return [];
  return Array.isArray(parts) ? parts : [parts];
};

/** Analog / cross parts nested under a Rossko Part. */
export const collectRosskoCrossParts = (part) => {
  let crossParts = part?.crosses?.Part;
  if (!crossParts) return [];
  return Array.isArray(crossParts) ? crossParts : [crossParts];
};

export const collectRosskoAnalogs = (parts) => {
  const list = Array.isArray(parts) ? parts : [];
  const seen = new Set();
  const out = [];
  list.forEach((part) => {
    collectRosskoCrossParts(part).forEach((cross) => {
      const guid = String(cross?.guid || '').trim();
      const key =
        guid
        || `${String(cross?.brand || '').trim()}|${normalizeArticle(cross?.partnumber || cross?.article)}`;
      if (!key || key === '|' || seen.has(key)) return;
      if (!mapPartToStocksData(cross).length) return;
      seen.add(key);
      out.push(cross);
    });
  });
  return out;
};

const scoreRosskoPart = (part, queryArticleNorm, queryBrandLower) => {
  let score = 0;
  const pn = normalizeArticle(part?.partnumber);
  const brandLower = String(part?.brand || '').trim().toLowerCase();

  if (queryArticleNorm && pn === queryArticleNorm) score += 100;
  else if (queryArticleNorm && (pn.startsWith(queryArticleNorm) || queryArticleNorm.startsWith(pn))) score += 50;
  else if (queryArticleNorm && pn.includes(queryArticleNorm)) score += 20;

  if (queryBrandLower && brandLower === queryBrandLower) score += 30;
  else if (queryBrandLower && brandLower.includes(queryBrandLower)) score += 10;

  if (getRosskoStockCount(part) > 0) score += 10;

  const price = getRosskoMinPrice(part);
  if (price > 0) score += 5;

  return score;
};

export const pickBestRosskoPart = (data, article, brand) => {
  const parts = getRosskoParts(data);
  if (!parts.length) return null;

  const queryArticleNorm = normalizeArticle(article);
  const queryBrandLower = String(brand || '').trim().toLowerCase();

  const ranked = parts
    .map((part) => ({
      part,
      score: scoreRosskoPart(part, queryArticleNorm, queryBrandLower),
      price: getRosskoMinPrice(part),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.price && b.price) return a.price - b.price;
      return 0;
    });

  return ranked[0]?.part || null;
};

export const buildRosskoLookupText = (article, brand) => {
  const articleTrimmed = String(article || '').trim();
  const brandTrimmed = String(brand || '').trim();
  return brandTrimmed ? `${brandTrimmed} ${articleTrimmed}` : articleTrimmed;
};

