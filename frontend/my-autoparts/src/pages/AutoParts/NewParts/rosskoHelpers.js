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

export function mapPartToInStockData(part) {
  return mapPartToStocksData(part).filter(
    (stock) => stock?.price && stock.price !== 0 && (stock.available_count || 0) > 0,
  );
}

export function hasRosskoInStock(part) {
  return mapPartToInStockData(part).length > 0;
}

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

export function rosskoPartDedupeKey(part) {
  const guid = String(part?.guid || '').trim();
  if (guid) return guid;
  const brand = String(part?.brand || '').trim();
  const article = getPartArticleNorm(part);
  return `${brand}|${article}`;
}

function rosskoStocksArray(part) {
  const stocks = part?.stocks?.stock;
  if (!stocks) return [];
  return Array.isArray(stocks) ? stocks : [stocks];
}

function mergeRosskoPartStocks(existingPart, incomingPart) {
  if (!existingPart || !incomingPart) return existingPart || incomingPart;
  const byId = new Map();
  [...rosskoStocksArray(existingPart), ...rosskoStocksArray(incomingPart)].forEach((stock) => {
    if (!stock || stock.id == null) return;
    const id = String(stock.id);
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, stock);
      return;
    }
    const prevCount = parseInt(prev.count, 10) || 0;
    const nextCount = parseInt(stock.count, 10) || 0;
    if (nextCount > prevCount) {
      byId.set(id, stock);
    }
  });
  const merged = Array.from(byId.values());
  if (!merged.length) return existingPart;
  return {
    ...existingPart,
    stocks: { stock: merged.length === 1 ? merged[0] : merged },
  };
}

/** Remove duplicate Rossko parts (same guid or brand+article), merge warehouse stocks. */
export function dedupeRosskoParts(parts) {
  const list = Array.isArray(parts) ? parts : [];
  const byKey = new Map();
  const order = [];

  list.forEach((part) => {
    if (!part || typeof part !== 'object') return;
    const key = rosskoPartDedupeKey(part);
    if (!key || key === '|') return;
    if (!byKey.has(key)) {
      byKey.set(key, part);
      order.push(key);
      return;
    }
    byKey.set(key, mergeRosskoPartStocks(byKey.get(key), part));
  });

  return order.map((key) => byKey.get(key));
}

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
      const key = rosskoPartDedupeKey(cross);
      if (!key || key === '|' || seen.has(key)) return;
      if (!hasRosskoInStock(cross)) return;
      seen.add(key);
      out.push(cross);
    });
  });
  return out;
};

export function getPartArticleNorm(part) {
  return normalizeArticle(part?.partnumber || part?.article || part?.oem);
}

export function rosskoPartMatchesOem(part, oemNorm) {
  if (!oemNorm) return false;
  const candidates = [part?.partnumber, part?.article, part?.oem];
  return candidates.some((value) => {
    const pn = normalizeArticle(value);
    if (!pn) return false;
    return pn === oemNorm || pn.includes(oemNorm) || oemNorm.includes(pn);
  });
}

/** Part matches catalog OEM by article (top-level or cross). */
export function isRosskoOriginalOemPart(part, oemNorm) {
  return rosskoPartMatchesOem(part, oemNorm);
}

/** Top-level Rossko hits plus crosses with available stock, deduped. */
export function collectRosskoOfferParts(parts) {
  const list = Array.isArray(parts) ? parts : [];
  const seen = new Set();
  const out = [];

  const add = (part) => {
    if (!part || typeof part !== 'object') return;
    if (!hasRosskoInStock(part)) return;
    const key = rosskoPartDedupeKey(part);
    if (!key || key === '|' || seen.has(key)) return;
    seen.add(key);
    out.push(part);
  };

  list.forEach(add);
  collectRosskoAnalogs(list).forEach(add);
  return out;
}

export function splitRosskoOriginalAndAnalogs(parts, oemNorm) {
  const all = collectRosskoOfferParts(parts);
  const originals = [];
  const analogs = [];
  all.forEach((part) => {
    if (isRosskoOriginalOemPart(part, oemNorm)) originals.push(part);
    else analogs.push(part);
  });
  return { originals, analogs };
}

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

export function buildRosskoOemSearchQueries(oem, brandHint) {
  const trimmed = String(oem || '').trim();
  if (!trimmed) return [];
  const queries = [trimmed];
  const brand = String(brandHint || '').trim();
  if (brand) {
    queries.push(buildRosskoLookupText(trimmed, brand));
  }
  const normalized = normalizeArticle(trimmed);
  if (normalized && normalized !== trimmed) {
    queries.push(normalized);
    if (brand) queries.push(buildRosskoLookupText(normalized, brand));
  }
  return [...new Set(queries.map((entry) => entry.trim()).filter(Boolean))];
}

export async function searchRosskoParts(apiPost, {
  text,
  delivery_id = '000000001',
  address_id = 176458,
}) {
  const response = await apiPost('/rossko/GetSearch', { text, delivery_id, address_id });
  return getRosskoParts(response?.data || response);
}

export async function searchRosskoPartsForOem(apiPost, {
  oem,
  brandHint = '',
  delivery_id = '000000001',
  address_id = 176458,
}) {
  const queries = buildRosskoOemSearchQueries(oem, brandHint);
  let merged = [];
  for (const text of queries) {
    const parts = await searchRosskoParts(apiPost, { text, delivery_id, address_id });
    if (!parts.length) continue;
    merged = dedupeRosskoParts([...merged, ...parts]);
    if (merged.some(hasRosskoInStock)) break;
  }
  return merged;
}

