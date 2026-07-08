import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** True when React Router history has a prior entry (idx > 0). */
export function canGoBackInHistory() {
  const historyIdx = window.history.state?.idx;
  return typeof historyIdx === 'number' && historyIdx > 0;
}

/**
 * Navigate to the previous page when possible, otherwise optional fallback.
 * Honors `location.state.backTo` when it is an absolute in-app path.
 */
export function navigateBack(navigate, { fallback, explicitBack } = {}) {
  if (typeof explicitBack === 'string' && explicitBack.startsWith('/')) {
    navigate(explicitBack);
    return;
  }

  if (canGoBackInHistory()) {
    navigate(-1);
    return;
  }

  if (fallback) {
    navigate(fallback);
  }
}

/** Returns a stable callback that goes back in browser history or uses fallback. */
export default function useHistoryBack(fallback) {
  const navigate = useNavigate();
  const location = useLocation();
  const explicitBack = location.state?.backTo;

  return useCallback(() => {
    navigateBack(navigate, { fallback, explicitBack });
  }, [navigate, fallback, explicitBack]);
}
