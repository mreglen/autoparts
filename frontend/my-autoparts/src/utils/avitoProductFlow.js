import {
  buildNewPartSearchFallbackPath,
  navigateGarageOrderItem,
} from './partRoutes';
import { getAvitoOrderChatId } from '../pages/Sales/avitoOrderDisplay';

const DEFAULT_AVITO_URL = 'https://www.avito.ru';

export function getWarehouseProductId(item) {
  return (
    item?.product_id
    || item?.productId
    || item?.linked_product_id
    || item?.linkedProductId
    || null
  );
}

/** Avito item / ad id — never use generic line-item `id`. */
export function extractAvitoItemId(item) {
  return (
    item?.avitoId
    || item?.avito_id
    || item?.avitoItemId
    || item?.avito_item_id
    || item?.avito_context_id
    || item?.itemId
    || item?.offerId
    || null
  );
}

export function buildAvitoFallbackUrl(item) {
  const directUrl =
    item?.avitoUrl
    || item?.url
    || item?.avito_context_url
    || item?.avito_url
    || null;
  if (directUrl) return directUrl;

  const avitoId = extractAvitoItemId(item);
  if (avitoId) return `https://www.avito.ru/items/${encodeURIComponent(String(avitoId))}`;

  return DEFAULT_AVITO_URL;
}

function hasAvitoUrl(item) {
  const url = item?.avitoUrl || item?.avito_url || item?.avito_context_url || item?.url;
  return Boolean(url && String(url).toLowerCase().includes('avito'));
}

function getAvitoLookupIds(item, order) {
  const ids = [
    extractAvitoItemId(item),
    item?.chatId,
    item?.chat_id,
    item?.internal_code,
    item?.internalCode,
  ];
  if (order) {
    ids.push(getAvitoOrderChatId(order));
  }
  return [...new Set(ids.map((value) => String(value || '').trim()).filter(Boolean))];
}

function navigateUsedProduct(navigate, item, productId) {
  const brand = item?.brand || item?.product?.brand;
  const article = item?.partnumber || item?.article || item?.product?.partnumber;

  if (brand && article) {
    navigate(
      `/part/${productId}-${encodeURIComponent(String(brand))}-${encodeURIComponent(String(article))}`,
    );
    return;
  }

  navigate(`/part/${productId}`);
}

function isGarageNewPartItem(item, orderType) {
  if (orderType === 'new') return true;
  const article = item?.partnumber || item?.article;
  return Boolean(item?.seo_card_id || (item?.brand && article));
}

export function openProductNotFoundPage(item) {
  const avitoUrl = buildAvitoFallbackUrl(item);
  const avitoId = extractAvitoItemId(item);
  const title = item?.title || item?.name || item?.product_name || '';

  const params = new URLSearchParams();
  params.set('avitoUrl', avitoUrl);
  if (avitoId) params.set('avitoId', String(avitoId));
  if (title) params.set('title', String(title));
  window.open(`/product-not-found?${params.toString()}`, '_blank');
}

async function resolveSiteProductFromAvito({ item, order, dispatch, fetchLinkThunk }) {
  const lookupIds = getAvitoLookupIds(item, order);
  for (const lookupId of lookupIds) {
    try {
      const linkData = await dispatch(fetchLinkThunk(lookupId)).unwrap();
      if (linkData?.linked && linkData?.product_id) {
        return linkData.product_id;
      }
    } catch {
      // try next id
    }
  }
  return null;
}

/**
 * Unified navigation from order line items (sales, purchases, Avito orders).
 * Svoy Garage / Rossko → site catalog; Avito → site product first, then Avito fallback.
 */
export async function openOrderItemProductFlow({
  item,
  orderType = 'used',
  order = null,
  dispatch,
  navigate,
  fetchLinkThunk,
}) {
  const productId = getWarehouseProductId(item);
  if (productId) {
    navigateUsedProduct(navigate, item, productId);
    return;
  }

  if (isGarageNewPartItem(item, orderType)) {
    navigateGarageOrderItem(navigate, item, 'new');
    return;
  }

  const lookupIds = getAvitoLookupIds(item, order);
  const isAvitoContext = orderType === 'avito' || lookupIds.length > 0 || hasAvitoUrl(item);

  if (isAvitoContext && dispatch && fetchLinkThunk) {
    const linkedProductId = await resolveSiteProductFromAvito({
      item,
      order,
      dispatch,
      fetchLinkThunk,
    });
    if (linkedProductId) {
      navigateUsedProduct(navigate, { ...item, product_id: linkedProductId }, linkedProductId);
      return;
    }

    if (lookupIds.length > 0 || hasAvitoUrl(item)) {
      openProductNotFoundPage(item);
      return;
    }
  }

  const brand = item?.brand || item?.product?.brand;
  const article = item?.partnumber || item?.article || item?.product?.partnumber;
  if (brand && article) {
    if (orderType === 'new') {
      navigate(buildNewPartSearchFallbackPath(item));
      return;
    }
    navigate(`/autoparts/used?q=${encodeURIComponent(`${brand} ${article}`.trim())}`);
  }
}

/** @deprecated Prefer openOrderItemProductFlow */
export async function openAvitoProductFlow({
  item,
  order = null,
  dispatch,
  navigate,
  fetchLinkThunk,
}) {
  return openOrderItemProductFlow({
    item,
    orderType: 'avito',
    order,
    dispatch,
    navigate,
    fetchLinkThunk,
  });
}
