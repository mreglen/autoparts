import { useEffect, useRef, useState } from 'react';

/**
 * Defer secondary work until after first paint (idle) and/or when a sentinel
 * enters the viewport. Network for gated effects should start only when enabled.
 *
 * @param {{ mode?: 'idle' | 'visible' | 'idle-or-visible', rootMargin?: string, idleTimeoutMs?: number, active?: boolean }} options
 * @returns {{ enabled: boolean, sentinelRef: import('react').RefObject<HTMLElement | null> }}
 */
export default function useDeferredMount({
  mode = 'idle',
  rootMargin = '200px',
  idleTimeoutMs = 1200,
  active = true,
} = {}) {
  const [enabled, setEnabled] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setEnabled(false);
      return undefined;
    }

    let cancelled = false;
    let idleId = null;
    let timeoutId = null;
    let raf1 = null;
    let raf2 = null;
    let observer = null;

    const enable = () => {
      if (!cancelled) setEnabled(true);
    };

    const scheduleIdle = () => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
            idleId = window.requestIdleCallback(enable, { timeout: idleTimeoutMs });
          } else {
            timeoutId = window.setTimeout(enable, Math.min(200, idleTimeoutMs));
          }
        });
      });
    };

    const watchVisible = () => {
      const node = sentinelRef.current;
      if (!node || typeof IntersectionObserver === 'undefined') {
        scheduleIdle();
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            enable();
            if (observer) observer.disconnect();
          }
        },
        { root: null, rootMargin, threshold: 0 },
      );
      observer.observe(node);
    };

    if (mode === 'idle') {
      scheduleIdle();
    } else if (mode === 'visible') {
      watchVisible();
    } else {
      // idle-or-visible: whichever comes first
      scheduleIdle();
      watchVisible();
    }

    return () => {
      cancelled = true;
      if (raf1 != null) cancelAnimationFrame(raf1);
      if (raf2 != null) cancelAnimationFrame(raf2);
      if (timeoutId != null) clearTimeout(timeoutId);
      if (idleId != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (observer) observer.disconnect();
    };
  }, [active, mode, rootMargin, idleTimeoutMs]);

  return { enabled, sentinelRef };
}
