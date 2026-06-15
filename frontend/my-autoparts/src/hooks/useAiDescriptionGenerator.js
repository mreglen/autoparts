import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../utils/apiClient';

export function useAiDescriptionGenerator({ brand, article, name, isNew, partTypeId, productId }) {
  const [access, setAccess] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/products/ai-description/access');
        if (!cancelled) setAccess(data);
      } catch (_e) {
        if (!cancelled) setAccess({ enabled: false, remaining_today: 0 });
      } finally {
        if (!cancelled) setLoadingAccess(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canGenerate =
    Boolean(access?.enabled) &&
    Boolean((brand || '').trim()) &&
    Boolean((article || '').trim()) &&
    Boolean((name || '').trim()) &&
    !generating;

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await apiRequest('/products/generate-description', {
        method: 'POST',
        body: JSON.stringify({
          brand: (brand || '').trim(),
          article: (article || '').trim(),
          name: (name || '').trim(),
          is_new: Boolean(isNew),
          part_type_id: partTypeId ? parseInt(partTypeId, 10) : null,
          product_id: productId ? parseInt(productId, 10) : null,
        }),
      });
      setAccess((prev) =>
        prev
          ? {
              ...prev,
              remaining_today: Math.max(0, (prev.remaining_today || 0) - 1),
              org_used: (prev.org_used || 0) + 1,
              global_used: (prev.global_used || 0) + 1,
            }
          : prev
      );
      return result?.description || '';
    } catch (e) {
      setError(e?.message || 'Не удалось сгенерировать описание');
      return null;
    } finally {
      setGenerating(false);
    }
  }, [brand, article, name, isNew, partTypeId, productId]);

  return {
    access,
    loadingAccess,
    generating,
    error,
    canGenerate,
    generate,
    clearError: () => setError(null),
  };
}
