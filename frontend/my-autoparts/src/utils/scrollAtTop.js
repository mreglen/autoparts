/** True when the window and scrollable ancestors of `target` are at the top. */
export function isTouchAtScrollTop(target) {
  if (typeof window === 'undefined') return false;

  const root = document.getElementById('root');
  if (
    root
    && document.documentElement.classList.contains('mobile-shell')
    && root.scrollHeight > root.clientHeight + 1
    && root.scrollTop > 1
  ) {
    return false;
  }

  if (window.scrollY > 1 || document.documentElement.scrollTop > 1) return false;

  let node = target;
  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      const overflow = style.overflow;
      const scrollableY =
        overflowY === 'auto' ||
        overflowY === 'scroll' ||
        overflowY === 'overlay' ||
        overflow === 'auto' ||
        overflow === 'scroll' ||
        overflow === 'overlay';

      if (scrollableY && node.scrollHeight > node.clientHeight + 1 && node.scrollTop > 1) {
        return false;
      }
    }
    node = node.parentElement;
  }

  return true;
}
