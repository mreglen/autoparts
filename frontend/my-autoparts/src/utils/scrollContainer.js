/** Scroll container: #root on mobile-shell/PWA, otherwise window/document. */
export function getAppScrollElement() {
  const root = document.getElementById('root');
  const mobileShell = document.documentElement.classList.contains('mobile-shell')
    || document.documentElement.classList.contains('pwa-standalone');

  if (mobileShell && root) {
    return root;
  }

  return null;
}

export function getAppScrollTop() {
  const root = getAppScrollElement();
  if (root) {
    return root.scrollTop;
  }
  return window.scrollY || document.documentElement.scrollTop || 0;
}

export function scrollAppToTop(behavior = 'smooth') {
  const root = getAppScrollElement();
  if (root) {
    root.scrollTo({ top: 0, behavior });
    return;
  }
  window.scrollTo({ top: 0, behavior });
}
