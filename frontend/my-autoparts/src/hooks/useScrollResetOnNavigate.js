import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const AUTOSERVICE_DOCUMENT_EDITING_RE =
  /^\/autoservice\/orders\/\d+(\/edit|\/print(\/upd|\/invoice)?|\/print\/upd|\/print\/invoice)$/;

/** Scroll to top on route change; preserve scroll on autoservice document editor/print routes. */
export default function useScrollResetOnNavigate() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (AUTOSERVICE_DOCUMENT_EDITING_RE.test(pathname)) {
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname]);
}
