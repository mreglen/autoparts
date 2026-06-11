import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import PageAmbientBackground from '../../../components/PageAmbientBackground/PageAmbientBackground';
import SeoCrossLinksSection from '../../../components/Seo/SeoCrossLinksSection';
import { apiRequest } from '../../../utils/apiClient';
import { buildBreadcrumbJsonLd, buildBreadcrumbsForPath } from '../../../utils/breadcrumbs';
import { PageSeoHelmet } from '../../../utils/pageSeo';
import NewPartSeoCardTile from './NewPartSeoCardTile';
import { buildNewPartsCategorySeo } from './newPartsCategorySeo';

const PAGE_SIZE = 48;

export default function NewPartsCategoryLandingPage() {
  const { categorySlug } = useParams();
  const [landing, setLanding] = useState(null);
  const [cardsData, setCardsData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPage = useCallback(async () => {
    if (!categorySlug) return;
    setLoading(true);
    setError(null);
    try {
      const resolved = await apiRequest(
        `/public/seo/landings/category_new/${encodeURIComponent(categorySlug)}`,
      );
      setLanding(resolved);
      const cards = await apiRequest(
        `/public/new-parts/cards?category_slug=${encodeURIComponent(categorySlug)}&page=${page}&page_size=${PAGE_SIZE}`,
      );
      setCardsData(cards);
    } catch (e) {
      setError(e?.message || 'Страница не найдена');
      setLanding(null);
      setCardsData(null);
    } finally {
      setLoading(false);
    }
  }, [categorySlug, page]);

  useEffect(() => {
    setPage(1);
  }, [categorySlug]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const seo = useMemo(() => {
    if (!landing) return null;
    return buildNewPartsCategorySeo({
      landing,
      total: cardsData?.total || 0,
      items: cardsData?.items || [],
    });
  }, [landing, cardsData]);

  const breadcrumbItems = useMemo(
    () =>
      buildBreadcrumbsForPath(`/autoparts/new/category/${categorySlug}`, {
        categoryName: landing?.title_ru,
      }),
    [categorySlug, landing],
  );

  const breadcrumbJsonLd = useMemo(
    () => buildBreadcrumbJsonLd(breadcrumbItems),
    [breadcrumbItems],
  );

  const popularArticles = useMemo(() => {
    const items = Array.isArray(cardsData?.items) ? [...cardsData.items] : [];
    return items
      .sort((a, b) => (Number(b.stock_count) || 0) - (Number(a.stock_count) || 0))
      .slice(0, 12);
  }, [cardsData?.items]);

  const popularBrands = useMemo(
    () => (Array.isArray(cardsData?.popular_brands) ? cardsData.popular_brands : []),
    [cardsData?.popular_brands],
  );

  const totalPages = Math.max(1, Math.ceil((cardsData?.total || 0) / PAGE_SIZE));

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
          <p className="mt-2 text-sm text-gray-500">{error || 'Посадочная для этой категории недоступна.'}</p>
          <Link to="/autoparts/new" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
            К новым запчастям
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
            {cardsData?.total
              ? `В каталоге ${cardsData.total} позиций — ${landing.title_ru}`
              : 'Каталог новых запчастей с доставкой по России'}
          </p>
        </header>

        {landing.intro_html ? (
          <section
            className="prose prose-sm mb-8 max-w-none rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm"
            dangerouslySetInnerHTML={{ __html: landing.intro_html }}
          />
        ) : null}

        <SeoCrossLinksSection kind="category_new" slug={categorySlug} />

        {popularBrands.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Популярные бренды в категории
            </h2>
            <div className="flex flex-wrap gap-2">
              {popularBrands.map((row) => (
                <Link
                  key={row.slug}
                  to={`/autoparts/new/brand/${row.slug}`}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-700"
                >
                  {row.brand}
                  {row.count ? ` (${row.count})` : ''}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {popularArticles.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Популярные артикулы
            </h2>
            <div className="flex flex-wrap gap-2">
              {popularArticles.map((card) => (
                <Link
                  key={card.id}
                  to={card.canonical_url?.startsWith('http')
                    ? card.canonical_url.replace(/^https?:\/\/[^/]+/, '')
                    : card.canonical_url}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-700"
                >
                  {card.article}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {cardsData?.items?.length ? (
          <section>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cardsData.items.map((card) => (
                <NewPartSeoCardTile key={card.id} card={card} />
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
            Пока нет карточек для этой категории.{' '}
            <Link to="/autoparts/new" className="text-indigo-600 hover:underline">
              Перейти к поиску
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
