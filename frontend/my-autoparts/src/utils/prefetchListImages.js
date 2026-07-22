import { buildListImageUrlFallbackChain, normalizeImageUrl } from './apiClient';

const prefetchedUrls = new Set();
const DEFAULT_BATCH_LIMIT = 40;

/** First list/thumb URL for a catalog list item (ProductListItem or full product). */
export function pickPartListImageUrl(part) {
  if (!part) return '';
  if (typeof part.list_photo_url === 'string' && part.list_photo_url.trim()) {
    return normalizeImageUrl(part.list_photo_url.trim()) || '';
  }
  const photos = part.photos || [];
  for (let i = 0; i < photos.length; i += 1) {
    const chain = buildListImageUrlFallbackChain(photos[i]);
    if (chain.length > 0) return chain[0];
  }
  if (typeof part.image === 'string' && part.image.trim()) {
    return normalizeImageUrl(part.image.trim()) || '';
  }
  return '';
}

/**
 * Warm browser HTTP cache for list thumbs as soon as catalog JSON arrives,
 * before virtualizer mounts cards / lazy img starts.
 */
export function prefetchListImages(parts, { limit = DEFAULT_BATCH_LIMIT } = {}) {
  if (typeof window === 'undefined' || !parts?.length) return 0;

  let started = 0;
  for (let i = 0; i < parts.length; i += 1) {
    if (started >= limit) break;
    const url = pickPartListImageUrl(parts[i]);
    if (!url || prefetchedUrls.has(url)) continue;
    prefetchedUrls.add(url);
    const img = new Image();
    img.decoding = 'async';
    try {
      img.fetchPriority = 'low';
    } catch (_e) {
      /* older browsers */
    }
    img.src = url;
    started += 1;
  }
  return started;
}
