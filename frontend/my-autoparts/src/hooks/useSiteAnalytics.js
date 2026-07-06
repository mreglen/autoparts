import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initSiteAnalyticsLifecycle, trackPageView } from '../utils/siteAnalytics';

export default function useSiteAnalytics() {
  const location = useLocation();

  useEffect(() => initSiteAnalyticsLifecycle(), []);

  useEffect(() => {
    const path = `${location.pathname}${location.search || ''}`;
    const timer = window.setTimeout(() => {
      trackPageView(path);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);
}
