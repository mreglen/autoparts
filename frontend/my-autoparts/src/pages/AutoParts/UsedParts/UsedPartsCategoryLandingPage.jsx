import React, { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import SeoLandingPageView from '../../../components/Seo/Landing/SeoLandingPageView';
import ProductCard from '../ProductCard';
import { useSeoLandingPage } from '../../../hooks/useSeoLandingPage';
import { fetchUsedCatalogProducts } from './usedCatalogApi';
import { buildUsedPartsCategorySeo } from './usedPartsCategorySeo';

const KIND = 'category_used';

export default function UsedPartsCategoryLandingPage() {
  const { categorySlug } = useParams();

  const fetchCatalogPage = useCallback(async (resolved, page, pageSize) => {
    if (!resolved?.part_type_id) throw new Error('Категория не найдена');
    return fetchUsedCatalogProducts({
      part_type_id: [resolved.part_type_id],
      page,
      page_size: pageSize,
    });
  }, []);

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
    breadcrumbPath: `/autoparts/used/category/${categorySlug}`,
    getBreadcrumbContext: (resolved) => ({
      categoryName: resolved?.title_ru,
    }),
    fetchCatalogPage,
    buildSeo: buildUsedPartsCategorySeo,
  });

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
          ? `${catalogData.total} объявлений — ${landing?.title_ru || 'категория'}`
          : 'Объявления продавцов с фото и ценами'
      }
      renderGridItem={(product) => (
        <ProductCard key={product.id} part={product} hideConditionAndQuantity />
      )}
      emptyMessage="Пока нет объявлений для этой категории."
      emptyLink="/autoparts/used"
      emptyLinkLabel="Перейти к поиску"
      notFoundBackLink="/autoparts/used"
      notFoundBackLabel="К б/у запчастям"
    />
  );
}
