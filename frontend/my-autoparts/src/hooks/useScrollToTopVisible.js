import { useEffect, useState } from 'react';
import { getAppScrollTop } from '../utils/scrollContainer';

export function useScrollToTopVisible(threshold = 240) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(getAppScrollTop() > threshold);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const root = document.getElementById('root');
    root?.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      root?.removeEventListener('scroll', onScroll);
    };
  }, [threshold]);

  return visible;
}
