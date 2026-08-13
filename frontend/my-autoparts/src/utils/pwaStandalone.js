import { useEffect, useState } from 'react';

export const PWA_START_PATH = '/autoparts/new';

export function isPwaStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    document.documentElement.classList.contains('pwa-standalone') ||
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.matchMedia?.('(display-mode: fullscreen)')?.matches === true ||
    window.navigator.standalone === true
  );
}

export function usePwaStandalone() {
  const [standalone, setStandalone] = useState(isPwaStandalone);

  useEffect(() => {
    const update = () => setStandalone(isPwaStandalone());
    const standaloneMq = window.matchMedia?.('(display-mode: standalone)');
    const fullscreenMq = window.matchMedia?.('(display-mode: fullscreen)');
    standaloneMq?.addEventListener?.('change', update);
    fullscreenMq?.addEventListener?.('change', update);
    update();
    return () => {
      standaloneMq?.removeEventListener?.('change', update);
      fullscreenMq?.removeEventListener?.('change', update);
    };
  }, []);

  return standalone;
}
