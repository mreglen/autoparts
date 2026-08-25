import { useEffect, useState } from 'react';
import { isBrowserOffline } from '../utils/networkStatus';

export default function useNetworkStatus() {
  const [offline, setOffline] = useState(() => isBrowserOffline());

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return { offline, online: !offline };
}
