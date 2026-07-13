import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';
import { buildNewPartDetailPath } from '../../utils/partRoutes';
import { slugifyBrand } from '../../utils/slugUtils';
import {
  PART_DETAIL_CACHE,
  readPartDetailCache,
  writePartDetailCache,
} from '../../utils/partDetailCache';

export default function PartDetailSeoCrossLinks({
  brand,
  article,
  isNew,
  organizationId,
  organizationName,
  usedCatalogPath,
  deferEnabled = true,
}) {
  const [newPartHref, setNewPartHref] = useState(null);
  const brandText = (brand || '').trim();
  const articleText = (article || '').trim();
  const brandSlug = brandText ? slugifyBrand(brandText) : '';
  const catalogHref = usedCatalogPath
    || (brandText && articleText
      ? `/autoparts/used?q=${encodeURIComponent(`${brandText} ${articleText}`)}`
      : null);

  useEffect(() => {
    if (!deferEnabled || isNew || !brandText || !articleText) {
      setNewPartHref(null);
      return undefined;
    }
    const cacheKey = `${brandText}|${articleText}`;
    const cachedHref = readPartDetailCache(PART_DETAIL_CACHE.newPartResolve, cacheKey);
    if (cachedHref !== null) {
      setNewPartHref(cachedHref);
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
        let href = null;
        if (data?.canonical_url) {
          const path = data.canonical_url.replace(/^https?:\/\/[^/]+/, '');
          href = path || data.canonical_url;
        } else if (data?.card_id) {
          href = buildNewPartDetailPath({ id: data.card_id, brand: brandText, article: articleText });
        }
        writePartDetailCache(PART_DETAIL_CACHE.newPartResolve, cacheKey, href);
        setNewPartHref(href);
      } catch (_e) {
        if (!cancelled) {
          writePartDetailCache(PART_DETAIL_CACHE.newPartResolve, cacheKey, null);
          setNewPartHref(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deferEnabled, isNew, brandText, articleText]);

  if (!brandText) {
    return null;
  }

  if (isNew) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {catalogHref ? (
          <Link
            to={catalogHref}
            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 sm:text-sm"
          >
            Б/у по артикулу
          </Link>
        ) : null}
        {brandSlug ? (
          <Link
            to={`/autoparts/used/brand/${encodeURIComponent(brandSlug)}`}
            className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 sm:text-sm"
          >
            Все б/у {brandText}
          </Link>
        ) : null}
        {brandSlug ? (
          <Link
            to={`/autoparts/new/brand/${encodeURIComponent(brandSlug)}`}
            className="rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100 sm:text-sm"
          >
            Все новые {brandText}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {catalogHref ? (
        <Link
          to={catalogHref}
          className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 sm:text-sm"
        >
          Каталог по артикулу
        </Link>
      ) : null}
      {brandSlug ? (
        <Link
          to={`/autoparts/used/brand/${encodeURIComponent(brandSlug)}`}
          className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 sm:text-sm"
        >
          Все б/у {brandText}
        </Link>
      ) : null}
      {newPartHref ? (
        <Link
          to={newPartHref}
          className="rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100 sm:text-sm"
        >
          Новая аналогичная
        </Link>
      ) : null}
      {organizationId ? (
        <Link
          to={`/organizations/${organizationId}`}
          className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 sm:text-sm"
        >
          {organizationName ? `Продавец: ${organizationName}` : 'Страница продавца'}
        </Link>
      ) : null}
    </div>
  );
}
