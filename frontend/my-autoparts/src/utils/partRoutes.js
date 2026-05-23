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
