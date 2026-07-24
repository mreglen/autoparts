/** Прогрев кэша браузера для превью списков (без блокировки UI). */
const warmedUrls = new Set();
const PRELOAD_LINK_COUNT = 8;

function injectPreloadLink(url) {
  if (typeof document === 'undefined') return;
  let selector = `link[data-sg-preload="${url}"]`;
  try {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      selector = `link[data-sg-preload="${CSS.escape(url)}"]`;
    }
  } catch (_e) {
    /* keep raw selector */
  }
  if (document.head.querySelector(selector)) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = url;
  link.setAttribute('data-sg-preload', url);
  document.head.appendChild(link);
}

export function prefetchListImages(urls, { limit = 16, preloadCount = PRELOAD_LINK_COUNT } = {}) {
  if (typeof window === 'undefined' || !urls?.length || limit <= 0) return;

  let count = 0;
  for (const raw of urls) {
    if (!raw || typeof raw !== 'string') continue;
    const url = raw.trim();
    if (!url || warmedUrls.has(url)) continue;
    warmedUrls.add(url);
    if (count < preloadCount) {
      injectPreloadLink(url);
    }
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    count += 1;
    if (count >= limit) break;
  }
}
