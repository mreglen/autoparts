/**
 * Компактная навигация (шапка, нижняя панель, выезжающее меню) — Tailwind `lg:hidden` / `hidden lg:block`.
 * До 1024px: как на телефоне. От 1024px: десктопная шапка и боковое меню профиля.
 */

/** Z-index above bottom nav (nav ~40), below full-screen overlays/modals */
export const Z_MOBILE_STICKY_FOOTER = 45;

/** Bottom offset to clear `MobileBottomNav` (h-14 = 3.5rem) + safe area */
export const MOBILE_STICKY_BOTTOM_OFFSET = 'calc(3.5rem + env(safe-area-inset-bottom, 0px))';
