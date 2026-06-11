import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import PageAmbientBackground from '../../../components/PageAmbientBackground/PageAmbientBackground';
import SeoCrossLinksSection from '../../../components/Seo/SeoCrossLinksSection';
import { apiRequest } from '../../../utils/apiClient';
import { buildBreadcrumbJsonLd, buildBreadcrumbsForPath } from '../../../utils/breadcrumbs';
import { PageSeoHelmet } from '../../../utils/pageSeo';
import ProductCard from '../ProductCard';
import { fetchUsedCatalogProducts } from './usedCatalogApi';
import { buildUsedPartsGeoSeo } from './usedPartsGeoSeo';

const PAGE_SIZE = 48;

export default function UsedPartsGeoLandingPage() {
  const { geoSlug } = useParams();
  const [landing, setLanding] = useState(null);
  const [productsData, setProductsData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPage = useCallback(async () => {
    if (!geoSlug) return;
    setLoading(true);
    setError(null);
    try {
      const resolved = await apiRequest(
        `/public/seo/landings/geo/${encodeURIComponent(geoSlug)}`,
      );
      setLanding(resolved);
      const city = resolved?.city || resolved?.title_ru;
      if (!city) {
        throw new Error('Город не найден');
      }
      const products = await fetchUsedCatalogProducts({
        city,
        page,
        page_size: PAGE_SIZE,
      });
      setProductsData(products);
    } catch (e) {
      setError(e?.message || 'Страница не найдена');
      setLanding(null);
      setProductsData(null);
    } finally {
      setLoading(false);
    }
  }, [geoSlug, page]);

  useEffect(() => {
    setPage(1);
  }, [geoSlug]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const seo = useMemo(() => {
    if (!landing) return null;
    return buildUsedPartsGeoSeo({
      landing,
      total: productsData?.total || 0,
      items: productsData?.items || [],
    });
  }, [landing, productsData]);

  const breadcrumbItems = useMemo(
    () =>
      buildBreadcrumbsForPath(`/autoparts/used/geo/${geoSlug}`, {
        cityName: landing?.city || landing?.title_ru,
      }),
    [geoSlug, landing],
  );

  const breadcrumbJsonLd = useMemo(
    () => buildBreadcrumbJsonLd(breadcrumbItems),
    [breadcrumbItems],
  );

  const totalPages = Math.max(1, Math.ceil((productsData?.total || 0) / PAGE_SIZE));

  if (loading && !landing) {
    return (
      <div className="relative min-h-[50vh] px-4 py-16">
        <PageAmbientBackground />
        <p className="text-center text-sm text-gray-500">Загрузка каталога…</p>
      </div>
    );
  }

  if (!landing || !seo) {
    return (
      <div className="relative min-h-[50vh] px-4 py-16">
        <PageAmbientBackground />
        <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Страница не найдена</h1>
          <p className="mt-2 text-sm text-gray-500">{error || 'Посадочная для этого города недоступна.'}</p>
          <Link to="/autoparts/used" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
            К б/у запчастям
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative pb-16">
      <PageAmbientBackground />
      <PageSeoHelmet seo={seo} />
      <Helmet>
        {breadcrumbJsonLd ? (
          <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
        ) : null}
        {seo.jsonLd?.map((block) => (
          <script key={block['@type']} type="application/ld+json">
            {JSON.stringify(block)}
          </script>
        ))}
      </Helmet>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <nav className="mb-4 text-sm text-gray-500">
          {breadcrumbItems.map((item, index) => (
            <span key={`${item.label}-${index}`}>
              {index > 0 ? ' / ' : null}
              {item.href ? (
                <Link to={item.href} className="hover:text-indigo-600">
                  {item.label}
                </Link>
              ) : (
                <span className="text-gray-700">{item.label}</span>
              )}
            </span>
          ))}
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{seo.h1}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {productsData?.total
              ? `${productsData.total} объявлений от продавцов в регионе`
              : 'Объявления продавцов с фото и ценами'}
          </p>
        </header>

        {landing.intro_html ? (
          <section
            className="prose prose-sm mb-8 max-w-none rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm"
            dangerouslySetInnerHTML={{ __html: landing.intro_html }}
          />
        ) : null}

        <SeoCrossLinksSection kind="geo" slug={geoSlug} />

        {productsData?.items?.length ? (
          <section>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {productsData.items.map((product) => (
                <ProductCard key={product.id} part={product} hideConditionAndQuantity />
              ))}
            </div>

            {totalPages > 1 ? (
              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
                >
                  Назад
                </button>
                <span className="text-sm text-gray-600">
                  Страница {page} из {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
                >
                  Вперёд
                </button>
              </div>
            ) : null}
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-8 text-center text-sm text-gray-500">
            Пока нет объявлений в этом городе.{' '}
            <Link to="/autoparts/used" className="text-indigo-600 hover:underline">
              Перейти к поиску
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
