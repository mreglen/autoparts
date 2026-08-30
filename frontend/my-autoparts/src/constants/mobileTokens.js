/**
 * Mobile shell tokens — sync with :root vars in src/index.css.
 * Shell (header + bottom nav): Tailwind `lg:hidden` / `hidden lg:block` (< 1024px).
 */

/** Tailwind breakpoints — keep in sync with tailwind.config defaults */
export const LG_MIN_WIDTH = 1024;
export const MD_MIN_WIDTH = 768;

/** MobileBottomNav content row (h-14) */
export const MOBILE_BOTTOM_NAV_H = '3.5rem';

/** pb-safe on bottom nav */
export const MOBILE_BOTTOM_NAV_SAFE_PAD = 'max(0.5rem, env(safe-area-inset-bottom, 0px))';

/** Scroll padding to clear bottom nav (layouts, long pages) */
export const MOBILE_PAGE_BOTTOM_PAD = `calc(${MOBILE_BOTTOM_NAV_H} + ${MOBILE_BOTTOM_NAV_SAFE_PAD})`;

/** Fixed sticky CTA bar sits above bottom nav (includes nav safe padding) */
export const MOBILE_STICKY_BOTTOM_OFFSET = `calc(${MOBILE_BOTTOM_NAV_H} + ${MOBILE_BOTTOM_NAV_SAFE_PAD})`;

/** Scroll padding when product detail sticky bar is visible (mobile) */
export const MOBILE_PRODUCT_STICKY_SCROLL_PAD = 'max-md:pb-32';

/** Overlay z-index scale (bottom-fixed and full-screen layers) */
export const Z_MOBILE_HEADER = 40;
export const Z_MOBILE_STICKY_FOOTER = 45;
export const Z_MOBILE_PWA_PROMPT = 48;
export const Z_MOBILE_BOTTOM_NAV = 50;
export const Z_COOKIE_BANNER = 56;
export const Z_MOBILE_DRAWER = 60;
export const Z_MODAL = 110;
export const Z_CONTEXT_MENU = 120;

export const MOBILE_Z_INDEX = {
  header: Z_MOBILE_HEADER,
  stickyFooter: Z_MOBILE_STICKY_FOOTER,
  pwaPrompt: Z_MOBILE_PWA_PROMPT,
  bottomNav: Z_MOBILE_BOTTOM_NAV,
  cookieBanner: Z_COOKIE_BANNER,
  drawer: Z_MOBILE_DRAWER,
  modal: Z_MODAL,
  contextMenu: Z_CONTEXT_MENU,
};
