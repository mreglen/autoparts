import { apiAxios, apiAxiosUnauth } from './apiClient';
import {
  buildNewPartDetailPath,
  buildNewPartSearchFallbackPath,
} from './partRoutes';
import {
  buildRosskoLookupText,
  isRosskoDeliverableStock,
  mapPartToStocksData,
  pickBestRosskoPart,
} from '../pages/AutoParts/NewParts/rosskoHelpers';
import {
  extractProductDescription,
  formatProductDisplayTitle,
} from './productDisplayName';

const ROSSKO_SEARCH_DEFAULTS = {
  delivery_id: '000000001',
  address_id: 176458,
};

function filterAvailableStocks(stocksData) {
  return (stocksData || []).filter(
    (stock) => isRosskoDeliverableStock(stock)
      && stock?.price
      && stock.price !== '0'
      && stock.price !== 0
      && (stock.available_count || 0) > 0,
  );
}

function buildCreateOrGetPayload({ brand, article, part, stocks }) {
  const mainStock = stocks[0];
  const displayTitle = formatProductDisplayTitle(brand, article, part?.name);
  const title = extractProductDescription(part?.name, brand, article) || part?.name || '';

  return {
    source: 'rossko',
    supplier_stock_id: String(mainStock?.stock_id || ''),
    brand,
    article,
    name: displayTitle,
    description: title,
    price: mainStock?.price ?? null,
    currency: 'RUB',
    stock_count: Number(mainStock?.available_count) || 0,
    delivery_start: mainStock?.delivery_start || null,
    delivery_end: mainStock?.delivery_end || null,
    image_url: null,
    guid: part?.guid ? String(part.guid) : null,
    stocks: stocks.map((stock) => ({
      stock_id: String(stock.stock_id),
      price: stock.price,
      available_count: Number(stock.available_count) || 0,
      delivery_start: stock.delivery_start || null,
      delivery_end: stock.delivery_end || null,
    })),
  };
}

async function resolveExistingCardPath(brand, article) {
  try {
    const response = await apiAxiosUnauth.get('/public/new-parts/cards/resolve', {
      params: { brand, article },
    });
    const cardId = Number(response?.data?.card_id);
    if (cardId > 0) {
      return buildNewPartDetailPath({ id: cardId, brand, article });
    }
  } catch (_error) {
    // card may not exist yet
  }
  return null;
}

async function fetchRosskoPart(brand, article) {
  const response = await apiAxios.post('/rossko/GetSearch', {
    text: buildRosskoLookupText(article, brand),
    ...ROSSKO_SEARCH_DEFAULTS,
  });
  return pickBestRosskoPart(response.data, article, brand);
}

export function isPlainLeftClick(event) {
  return event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey;
}

export async function resolveNewPartDetailPath({
  brand,
  article,
  part = null,
  stocksData = null,
}) {
  const brandText = String(brand || '').trim();
  const articleText = String(article || '').trim();
  if (!brandText || !articleText) {
    return null;
  }

  const existingPath = await resolveExistingCardPath(brandText, articleText);
  if (existingPath) {
    return existingPath;
  }

  let rosskoPart = part;
  let stocks = filterAvailableStocks(stocksData);

  if (!rosskoPart || stocks.length === 0) {
    try {
      rosskoPart = await fetchRosskoPart(brandText, articleText);
      stocks = filterAvailableStocks(mapPartToStocksData(rosskoPart));
    } catch (_error) {
      return buildNewPartSearchFallbackPath({ brand: brandText, article: articleText });
    }
  }

  if (!rosskoPart || stocks.length === 0) {
    return buildNewPartSearchFallbackPath({ brand: brandText, article: articleText });
  }

  try {
    const payload = buildCreateOrGetPayload({
      brand: brandText,
      article: articleText,
      part: rosskoPart,
      stocks,
    });
    const response = await apiAxiosUnauth.post('/public/new-parts/cards/create-or-get', payload);
    const cardData = response?.data;
    const cardId = Number(cardData?.id);
    if (cardId > 0) {
      return buildNewPartDetailPath(cardData)
        || cardData?.canonical_url?.replace(/^https?:\/\/[^/]+/, '')
        || `/autoparts/new/part/${cardId}`;
    }
  } catch (_error) {
    // fallback below
  }

  return buildNewPartSearchFallbackPath({ brand: brandText, article: articleText });
}
