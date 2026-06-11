import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';
import { buildNewPartDetailPath } from '../../utils/partRoutes';
import { slugifyBrand } from '../../utils/slugUtils';

export default function PartDetailSeoCrossLinks({ brand, article, isNew, organizationId, organizationName }) {
  const [newPartHref, setNewPartHref] = useState(null);
  const brandText = (brand || '').trim();
  const articleText = (article || '').trim();
  const brandSlug = brandText ? slugifyBrand(brandText) : '';

  useEffect(() => {
    if (isNew || !brandText || !articleText) {
      setNewPartHref(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await apiAxiosUnauth.get('/public/new-parts/cards/resolve', {
          params: { brand: brandText, article: articleText },
        });
        const data = response?.data;
        if (cancelled) return;
        if (data?.canonical_url) {
          const path = data.canonical_url.replace(/^https?:\/\/[^/]+/, '');
          setNewPartHref(path || data.canonical_url);
          return;
        }
        if (data?.card_id) {
          setNewPartHref(buildNewPartDetailPath({ id: data.card_id, brand: brandText, article: articleText }));
        }
      } catch (_e) {
        if (!cancelled) setNewPartHref(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNew, brandText, articleText]);

  if (isNew || !brandText) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      {brandSlug ? (
        <Link
          to={`/autoparts/used/brand/${encodeURIComponent(brandSlug)}`}
          className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
        >
          Все б/у {brandText}
        </Link>
      ) : null}
      {newPartHref ? (
        <Link
          to={newPartHref}
          className="inline-flex items-center rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
        >
          Новая аналогичная
        </Link>
      ) : null}
      {organizationId ? (
        <Link
          to={`/organizations/${organizationId}`}
          className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          {organizationName ? `Продавец: ${organizationName}` : 'Страница продавца'}
        </Link>
      ) : null}
    </div>
  );
}
