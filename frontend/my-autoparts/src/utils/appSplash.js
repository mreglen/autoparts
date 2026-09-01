import { isMyPartsFormRoute } from './partRoutes';

/** Минимальное время показа splash при старте / перезагрузке (мс). */
export const APP_SPLASH_MIN_MS = 600;

/** Короткий splash на формах добавления/редактирования (мс). */
export const APP_SPLASH_FORM_MIN_MS = 350;

/** Пауза с логотипом перед полной перезагрузкой по свайпу (мс). */
export const REFRESH_RELOAD_SPLASH_MS = 550;

let splashHideScheduled = false;

export function getAppSplashMinMs(pathname = typeof window !== 'undefined' ? window.location.pathname : '') {
  return isMyPartsFormRoute(pathname) ? APP_SPLASH_FORM_MIN_MS : APP_SPLASH_MIN_MS;
}

export function ensureAppSplashVisible() {
  const splash = document.getElementById('pwa-splash');
  if (!splash) return;
  splash.style.display = 'flex';
  splash.classList.remove('pwa-splash--hide');
  splash.setAttribute('aria-hidden', 'false');
}

export function hideAppSplash() {
  const splash = document.getElementById('pwa-splash');
  if (!splash || splash.classList.contains('pwa-splash--hide')) return;

  splash.classList.add('pwa-splash--hide');
  splash.setAttribute('aria-hidden', 'true');

  const removeSplash = () => splash.remove();
  splash.addEventListener('transitionend', removeSplash, { once: true });
  window.setTimeout(removeSplash, 500);
}

export function scheduleAppSplashHide() {
  if (splashHideScheduled) return;
  splashHideScheduled = true;

  const splashStart = window.__sgSplashStart || Date.now();
  const minMs = getAppSplashMinMs();
  const delay = Math.max(0, minMs - (Date.now() - splashStart));

  window.setTimeout(() => {
    document.documentElement.classList.add('sg-app-ready');
    hideAppSplash();
  }, delay);
}

/** Вызывать после первой отрисовки React (двойной rAF), чтобы не показывать «голый» текст до CSS. */
export function markAppPaintReady() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scheduleAppSplashHide();
    });
  });
}

export function ensureAppSplashBootFallback() {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    if (!document.documentElement.classList.contains('sg-app-ready')) {
      document.documentElement.classList.add('sg-app-ready');
      hideAppSplash();
    }
  }, 10000);
}

export async function showSplashBeforeReload() {
  ensureAppSplashVisible();
  await new Promise((resolve) => {
    window.setTimeout(resolve, REFRESH_RELOAD_SPLASH_MS);
  });
}
