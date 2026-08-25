import { useEffect, useRef } from 'react';
import { getFocusableElements } from '../utils/focusTrapUtils';

/**
 * Traps keyboard focus inside a dialog/drawer panel and restores focus on deactivate.
 *
 * @param {import('react').RefObject<HTMLElement>} containerRef
 * @param {object} options
 * @param {boolean} options.active
 * @param {import('react').RefObject<HTMLElement>} [options.initialFocusRef]
 * @param {import('react').RefObject<HTMLElement>} [options.returnFocusRef]
 * @param {boolean} [options.restoreFocus=true]
 * @param {() => void} [options.onEscape]
 */
export function useFocusTrap(containerRef, {
  active,
  initialFocusRef,
  returnFocusRef,
  restoreFocus = true,
  onEscape,
}) {
  const previousActiveElementRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;

    const returnFocusTarget = returnFocusRef?.current;
    previousActiveElementRef.current = returnFocusTarget || document.activeElement;

    const focusTimer = window.setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const focusable = getFocusableElements(containerRef.current);
      focusable[0]?.focus();
    }, 0);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(containerRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey) {
        if (current === first || !containerRef.current?.contains(current)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (current === last || !containerRef.current?.contains(current)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);

      if (!restoreFocus) return;

      const target = returnFocusTarget || previousActiveElementRef.current;
      if (target && typeof target.focus === 'function' && document.contains(target)) {
        target.focus();
      }
    };
  }, [active, containerRef, initialFocusRef, onEscape, restoreFocus, returnFocusRef]);
}
