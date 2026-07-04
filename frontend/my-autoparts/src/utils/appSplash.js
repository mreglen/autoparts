/** Минимальное время показа splash при старте / перезагрузке (мс). */
export const APP_SPLASH_MIN_MS = 1500;

/** Пауза с логотипом перед полной перезагрузкой по свайпу (мс). */
export const REFRESH_RELOAD_SPLASH_MS = 550;

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
  const splashStart = window.__sgSplashStart || Date.now();
  const delay = Math.max(0, APP_SPLASH_MIN_MS - (Date.now() - splashStart));

  window.setTimeout(hideAppSplash, delay);
}

export async function showSplashBeforeReload() {
  ensureAppSplashVisible();
  await new Promise((resolve) => {
    window.setTimeout(resolve, REFRESH_RELOAD_SPLASH_MS);
  });
}
