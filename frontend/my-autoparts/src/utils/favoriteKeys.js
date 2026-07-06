export function productFavoriteKey(productId) {
  const id = Number(productId);
  return Number.isFinite(id) && id > 0 ? `product:${id}` : '';
}

export function rosskoFavoriteKey(brand, partnumber) {
  const brandKey = String(brand || '').trim().toUpperCase();
  const partKey = String(partnumber || '').trim().toUpperCase();
  if (!brandKey || !partKey) return '';
  return `rossko:${brandKey}:${partKey}`;
}

export function favoriteKeyFromItem(item) {
  if (!item) return '';
  if (item.is_rossko || item.kind === 'rossko') {
    return rosskoFavoriteKey(item.brand, item.article);
  }
  return productFavoriteKey(item.id);
}

export function isRosskoFavoriteItem(item) {
  return Boolean(item?.is_rossko || item?.kind === 'rossko');
}

export function engagementItemKey(item) {
  const key = favoriteKeyFromItem(item);
  if (key) return key;
  return item?.id ? `product:${item.id}` : 'unknown';
}
