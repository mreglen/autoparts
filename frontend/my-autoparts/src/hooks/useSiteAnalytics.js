import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initSiteAnalyticsLifecycle, trackPageView } from '../utils/siteAnalytics';

export default function useSiteAnalytics() {
  const location = useLocation();

  useEffect(() => initSiteAnalyticsLifecycle(), []);

  useEffect(() => {
    trackPageView(`${location.pathname}${location.search || ''}`);
  }, [location.pathname, location.search]);
}
