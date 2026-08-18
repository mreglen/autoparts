import { useEffect } from 'react';

/** Разрешает pinch-zoom на страницах предпросмотра документов (глобально max-scale=1). */
export function useAllowViewportZoom() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return undefined;
    const prev = meta.getAttribute('content');
    meta.setAttribute(
      'content',
      'width=device-width, initial-scale=1, minimum-scale=0.25, maximum-scale=5, viewport-fit=cover',
    );
    return () => {
      if (prev) meta.setAttribute('content', prev);
    };
  }, []);
}
