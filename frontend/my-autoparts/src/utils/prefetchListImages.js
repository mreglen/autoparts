/** Прогрев кэша браузера для превью списков (без блокировки UI). */
const warmedUrls = new Set();

export function prefetchListImages(urls, { limit = 16 } = {}) {
  if (typeof window === 'undefined' || !urls?.length || limit <= 0) return;

  let count = 0;
  for (const raw of urls) {
    if (!raw || typeof raw !== 'string') continue;
    const url = raw.trim();
    if (!url || warmedUrls.has(url)) continue;
    warmedUrls.add(url);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    count += 1;
    if (count >= limit) break;
  }
}
