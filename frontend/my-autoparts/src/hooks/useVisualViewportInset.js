import { useEffect, useState } from 'react';

/** Ignore small innerHeight vs visualViewport gaps from browser chrome / URL bar. */
export const KEYBOARD_INSET_THRESHOLD_PX = 120;

export function computeVisualViewportInset(innerHeight, vvHeight, vvOffsetTop = 0) {
  const raw = Math.max(0, Number(innerHeight) - Number(vvHeight) - Number(vvOffsetTop || 0));
  if (!Number.isFinite(raw) || raw < KEYBOARD_INSET_THRESHOLD_PX) {
    return 0;
  }
  return Math.round(raw);
}

/**
 * Keyboard inset (px) for mobile chat composer — uses Visual Viewport API when available.
 */
export default function useVisualViewportInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;

    const update = () => {
      setInset(computeVisualViewportInset(window.innerHeight, vv.height, vv.offsetTop));
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return inset;
}
