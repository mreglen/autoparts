import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../utils/apiClient';

export function useAiDescriptionGenerator({
  brand,
  article,
  name,
  description,
  isNew,
  partTypeId,
  productId,
  authReady = true,
}) {
  const [access, setAccess] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const loadAccess = useCallback(async () => {
    if (!authReady) return;
    setLoadingAccess(true);
    try {
      const data = await apiRequest('/products/ai-description/access');
      setAccess(data);
    } catch (e) {
      setAccess({
        show_ui: false,
        enabled: false,
        reason: e?.message || 'Не удалось проверить доступ к AI-описаниям',
        remaining_today: 0,
      });
    } finally {
      setLoadingAccess(false);
    }
  }, [authReady]);

  useEffect(() => {
    if (!authReady) {
      setLoadingAccess(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      await loadAccess();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, loadAccess]);

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
          existing_description: (description || '').trim() || null,
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
  }, [brand, article, name, description, isNew, partTypeId, productId]);

  return {
    access,
    loadingAccess,
    generating,
    error,
    canGenerate,
    generate,
    clearError: () => setError(null),
    reloadAccess: loadAccess,
  };
}
