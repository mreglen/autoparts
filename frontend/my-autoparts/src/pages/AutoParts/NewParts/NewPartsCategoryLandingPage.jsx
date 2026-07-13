import React, { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import SeoLandingPageView from '../../../components/Seo/Landing/SeoLandingPageView';
import { apiRequest } from '../../../utils/apiClient';
import { useSeoLandingPage } from '../../../hooks/useSeoLandingPage';
import NewPartSeoCardTile from './NewPartSeoCardTile';
import { buildNewPartsCategorySeo } from './newPartsCategorySeo';

const KIND = 'category_new';

export default function NewPartsCategoryLandingPage() {
  const { categorySlug } = useParams();

  const fetchCatalogPage = useCallback(async (_resolved, page, pageSize) => {
    return apiRequest(
      `/public/new-parts/cards?category_slug=${encodeURIComponent(categorySlug)}&page=${page}&page_size=${pageSize}`,
    );
  }, [categorySlug]);

  const {
    landing,
    catalogData,
    seo,
    breadcrumbItems,
    page,
    setPage,
    loading,
    error,
    totalPages,
  } = useSeoLandingPage({
    kind: KIND,
    slug: categorySlug,
    breadcrumbPath: `/autoparts/new/category/${categorySlug}`,
    getBreadcrumbContext: (resolved) => ({
      categoryName: resolved?.title_ru,
    }),
    fetchCatalogPage,
    buildSeo: buildNewPartsCategorySeo,
  });

  const popularBrandsSection = useMemo(() => {
    const popularBrands = Array.isArray(catalogData?.popular_brands) ? catalogData.popular_brands : [];
    if (!popularBrands.length) return null;
    return (
      <section className="mb-6 rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Популярные бренды в категории
        </h2>
        <div className="flex flex-wrap gap-2">
          {popularBrands.map((row) => (
            <Link
              key={row.slug}
              to={`/autoparts/new/brand/${row.slug}`}
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-700 min-h-[44px] inline-flex items-center sm:py-1.5"
            >
              {row.brand}
              {row.count ? ` (${row.count})` : ''}
            </Link>
          ))}
        </div>
      </section>
    );
  }, [catalogData?.popular_brands]);

  return (
    <SeoLandingPageView
      kind={KIND}
      slug={categorySlug}
      landing={landing}
      seo={seo}
      catalogData={catalogData}
      breadcrumbItems={breadcrumbItems}
      loading={loading}
      error={error}
      page={page}
      setPage={setPage}
      totalPages={totalPages}
      statsText={
        catalogData?.total
          ? `В каталоге ${catalogData.total} позиций — ${landing?.title_ru || 'категория'}`
          : 'Каталог новых запчастей с доставкой по России'
      }
      renderGridItem={(card, index) => (
        <NewPartSeoCardTile key={card.id} card={card} listPriority={index < 2} />
      )}
      emptyMessage="Пока нет карточек для этой категории."
      emptyLink="/autoparts/new"
      emptyLinkLabel="Перейти к поиску"
      notFoundBackLink="/autoparts/new"
      notFoundBackLabel="К новым запчастям"
      popularQueriesTitle="Популярные артикулы"
      extraBeforeGrid={popularBrandsSection}
    />
  );
}
