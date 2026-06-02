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
