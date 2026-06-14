import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import SeoLandingPageView from '../../../components/Seo/Landing/SeoLandingPageView';
import ProductCard from '../ProductCard';
import { useSeoLandingPage } from '../../../hooks/useSeoLandingPage';
import { fetchUsedCatalogProducts } from './usedCatalogApi';
import { buildUsedPartsBrandSeo } from './usedPartsBrandSeo';

const KIND = 'brand_used';

export default function UsedPartsBrandLandingPage() {
  const { brandSlug } = useParams();

  const fetchCatalogPage = useCallback(async (resolved, page, pageSize) => {
    const brandName = resolved?.brand_name || resolved?.title_ru;
    if (!brandName) throw new Error('Бренд не найден');
    return fetchUsedCatalogProducts({
      brand: [brandName],
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
    slug: brandSlug,
    breadcrumbPath: `/autoparts/used/brand/${brandSlug}`,
    getBreadcrumbContext: (resolved) => ({
      brandName: resolved?.brand_name || resolved?.title_ru,
    }),
    fetchCatalogPage,
    buildSeo: buildUsedPartsBrandSeo,
  });

  return (
    <SeoLandingPageView
      kind={KIND}
      slug={brandSlug}
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
          ? `${catalogData.total} объявлений от продавцов`
          : 'Объявления продавцов с фото и ценами'
      }
      renderGridItem={(product) => (
        <ProductCard key={product.id} part={product} hideConditionAndQuantity />
      )}
      emptyMessage="Пока нет объявлений для этого бренда."
      emptyLink="/autoparts/used"
      emptyLinkLabel="Перейти к поиску"
      notFoundBackLink="/autoparts/used"
      notFoundBackLabel="К б/у запчастям"
    />
  );
}
