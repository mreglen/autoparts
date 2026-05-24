import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../utils/apiClient';

export function useAvitoAccountStatus(organizationId, { enabled = true } = {}) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async (options = {}) => {
    if (!organizationId || !enabled) {
      setStatus(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const force = options.force ? '?force=1' : '';
      const data = await apiRequest(
        `/organizations/${organizationId}/avito/account-status${force}`,
        { method: 'GET' },
      );
      setStatus(data);
      return data;
    } catch (e) {
      setError(e?.message || String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [organizationId, enabled]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { status, loading, error, refetch };
}
