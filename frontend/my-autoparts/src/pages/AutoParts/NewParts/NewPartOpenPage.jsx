import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { resolveNewPartDetailPath } from '../../../utils/openNewPartFromCatalog';

export default function NewPartOpenPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);

  const brand = searchParams.get('brand') || '';
  const article = searchParams.get('article') || '';
  const backTo = searchParams.get('back') || '/autoparts/new';

  useEffect(() => {
    let cancelled = false;

    if (!brand.trim() || !article.trim()) {
      setError('Не указаны бренд или артикул');
      return undefined;
    }

    (async () => {
      try {
        const path = await resolveNewPartDetailPath({
          brand,
          article,
          part: location.state?.rosskoPart,
          stocksData: location.state?.stocksData,
        });
        if (cancelled) return;
        if (path) {
          navigate(path, { replace: true, state: { backTo } });
          return;
        }
        setError('Не удалось открыть карточку');
      } catch (_err) {
        if (!cancelled) {
          setError('Не удалось открыть карточку');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brand, article, backTo, navigate, location.state]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-8 text-center shadow-sm">
        {error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <p className="text-gray-600">Открываем карточку…</p>
        )}
      </div>
    </div>
  );
}
