import React, { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import SeoLandingPageView from '../../../components/Seo/Landing/SeoLandingPageView';
import ProductCard from '../ProductCard';
import { useSeoLandingPage } from '../../../hooks/useSeoLandingPage';
import { fetchUsedCatalogProducts } from './usedCatalogApi';
import { buildUsedPartsGeoSeo } from './usedPartsGeoSeo';

const KIND = 'geo';

export default function UsedPartsGeoLandingPage() {
  const { geoSlug } = useParams();

  const fetchCatalogPage = useCallback(async (resolved, page, pageSize) => {
    const city = resolved?.city || resolved?.title_ru;
    if (!city) throw new Error('Город не найден');
    return fetchUsedCatalogProducts({
      city,
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
    slug: geoSlug,
    breadcrumbPath: `/autoparts/used/geo/${geoSlug}`,
    getBreadcrumbContext: (resolved) => ({
      cityName: resolved?.city || resolved?.title_ru,
    }),
    fetchCatalogPage,
    buildSeo: buildUsedPartsGeoSeo,
  });

  return (
    <SeoLandingPageView
      kind={KIND}
      slug={geoSlug}
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
          ? `${catalogData.total} объявлений в ${landing?.city || landing?.title_ru || 'городе'}`
          : 'Объявления продавцов с фото и ценами'
      }
      renderGridItem={(product) => (
        <ProductCard key={product.id} part={product} hideConditionAndQuantity />
      )}
      emptyMessage="Пока нет объявлений для этого города."
      emptyLink="/autoparts/used"
      emptyLinkLabel="Перейти к поиску"
      notFoundBackLink="/autoparts/used"
      notFoundBackLabel="К б/у запчастям"
    />
  );
}
