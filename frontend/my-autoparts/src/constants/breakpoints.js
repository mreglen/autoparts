import { LG_MIN_WIDTH, MD_MIN_WIDTH } from './mobileTokens';

/** Tailwind `md` — phone vs tablet */
export { MD_MIN_WIDTH };
export const MD_MAX_WIDTH = MD_MIN_WIDTH - 1;

/** Tailwind `lg` — mobile shell vs desktop */
export { LG_MIN_WIDTH };
export const LG_MAX_WIDTH = LG_MIN_WIDTH - 1;

/** Phone-only (< 768px): PTR, PWA prompt, compact phone UX */
export const PHONE_MAX_MEDIA = `(max-width: ${MD_MAX_WIDTH}px)`;

/** @deprecated Use PHONE_MAX_MEDIA — kept for useIsNarrowMobile */
export const MOBILE_MAX_MEDIA = PHONE_MAX_MEDIA;

/** Mobile shell (< 1024px): bottom nav + MobileHeader */
export const MOBILE_SHELL_MAX_MEDIA = `(max-width: ${LG_MAX_WIDTH}px)`;

export function getIsNarrowViewport() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(PHONE_MAX_MEDIA).matches;
}

export function getIsMobileShell() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MOBILE_SHELL_MAX_MEDIA).matches;
}

function subscribeMediaQuery(media, callback) {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }
  const mq = window.matchMedia(media);
  const handler = () => callback(mq.matches);
  if (mq.addEventListener) {
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }
  mq.addListener(handler);
  return () => mq.removeListener(handler);
}

/** Subscribe to phone viewport changes; returns unsubscribe */
export function subscribeNarrowViewport(callback) {
  return subscribeMediaQuery(PHONE_MAX_MEDIA, callback);
}

/** Subscribe to mobile shell viewport changes; returns unsubscribe */
export function subscribeMobileShell(callback) {
  return subscribeMediaQuery(MOBILE_SHELL_MAX_MEDIA, callback);
}
