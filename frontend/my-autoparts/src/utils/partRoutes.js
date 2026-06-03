/** Разбор сегмента URL `/part/:productId` (id-brand-article или только id). */
export function parsePartDetailParam(combinedParam) {
  if (!combinedParam) {
    return { productId: null, brand: null, article: null };
  }

  const parts = String(combinedParam).split('-');
  if (parts.length >= 3) {
    return {
      productId: parts[0],
      article: decodeURIComponent(parts[parts.length - 1]),
      brand: decodeURIComponent(parts.slice(1, -1).join('-')),
    };
  }
  if (parts.length === 1) {
    return { productId: parts[0], brand: null, article: null };
  }
  return { productId: combinedParam, brand: null, article: null };
}

export function buildPartDetailPath(product) {
  if (!product) return '/autoparts/used';

  if (typeof product !== 'object') {
    return `/part/${product}`;
  }

  const id = product.id;
  const brand = product.brand || '';
  const article = product.article || '';

  if (id && brand && article) {
    return `/part/${id}-${encodeURIComponent(brand)}-${encodeURIComponent(article)}`;
  }

  if (id) {
    return `/part/${id}`;
  }

  return '/autoparts/used';
}

/** Разбор сегмента `/autoparts/new/part/:cardId` (id-brand-article или только id). */
export function parseNewPartDetailParam(combinedParam) {
  return parsePartDetailParam(combinedParam);
}

export function buildNewPartDetailPath(card) {
  if (!card) return '/autoparts/new';

  const id = card.id ?? card.card_id;
  const brand = card.brand || '';
  const article = card.article || '';

  if (id && brand && article) {
    return `/autoparts/new/part/${id}-${encodeURIComponent(brand)}-${encodeURIComponent(article)}`;
  }

  if (id) {
    return `/autoparts/new/part/${id}`;
  }

  return '/autoparts/new';
}

export function canLinkGarageOrderItem(item, orderType) {
  if (orderType === 'new') {
    const article = item?.partnumber || item?.article;
    return Boolean(item?.seo_card_id || (item?.brand && article));
  }
  return Boolean(item?.product_id);
}

export function buildNewPartSearchFallbackPath(item) {
  const brand = item?.brand;
  const article = item?.partnumber || item?.article;
  if (!brand || !article) return '/autoparts/new';
  return `/autoparts/new?q=${encodeURIComponent(`${brand} ${article}`.trim())}`;
}

/** Переход к карточке товара из заказа (б/у — /part/..., новые — /autoparts/new/part/...). */
export function navigateGarageOrderItem(navigate, item, orderType) {
  if (orderType === 'new') {
    if (item?.seo_card_id) {
      navigate(
        buildNewPartDetailPath({
          id: item.seo_card_id,
          brand: item.brand,
          article: item.partnumber || item.article,
        })
      );
      return;
    }
    navigate(buildNewPartSearchFallbackPath(item));
    return;
  }

  if (!item?.product_id) return;

  const productId = item.product_id;
  const brand = item.brand || item.product?.brand;
  const article = item.partnumber || item.product?.partnumber;

  if (brand && article) {
    navigate(
      `/part/${productId}-${encodeURIComponent(String(brand))}-${encodeURIComponent(String(article))}`
    );
    return;
  }

  navigate(`/part/${productId}`);
}
