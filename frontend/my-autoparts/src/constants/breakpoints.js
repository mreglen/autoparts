/** Tailwind `md` breakpoint — keep in sync with tailwind.config */
export const MD_MIN_WIDTH = 768;
export const MD_MAX_WIDTH = MD_MIN_WIDTH - 1;

/** Media query for “narrow / mobile shell” layout */
export const MOBILE_MAX_MEDIA = `(max-width: ${MD_MAX_WIDTH}px)`;

export function getIsNarrowViewport() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MOBILE_MAX_MEDIA).matches;
}

/** Subscribe to narrow viewport changes; returns unsubscribe */
export function subscribeNarrowViewport(callback) {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }
  const mq = window.matchMedia(MOBILE_MAX_MEDIA);
  const handler = () => callback(mq.matches);
  if (mq.addEventListener) {
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }
  mq.addListener(handler);
  return () => mq.removeListener(handler);
}
