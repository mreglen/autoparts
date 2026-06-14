import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import SeoLandingPageView from '../../../components/Seo/Landing/SeoLandingPageView';
import { apiRequest } from '../../../utils/apiClient';
import { useSeoLandingPage } from '../../../hooks/useSeoLandingPage';
import NewPartSeoCardTile from './NewPartSeoCardTile';
import { buildNewPartsBrandSeo } from './newPartsBrandSeo';

const KIND = 'brand_new';

export default function NewPartsBrandLandingPage() {
  const { brandSlug } = useParams();

  const fetchCatalogPage = useCallback(async (resolved, page, pageSize) => {
    const brandName = resolved?.brand_name || resolved?.title_ru;
    if (!brandName) throw new Error('Бренд не найден');
    return apiRequest(
      `/public/new-parts/cards?brand=${encodeURIComponent(brandName)}&page=${page}&page_size=${pageSize}`,
    );
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
    breadcrumbPath: `/autoparts/new/brand/${brandSlug}`,
    getBreadcrumbContext: (resolved) => ({
      brandName: resolved?.brand_name || resolved?.title_ru,
    }),
    fetchCatalogPage,
    buildSeo: buildNewPartsBrandSeo,
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
          ? `В каталоге ${catalogData.total} позиций ${landing?.brand_name || landing?.title_ru || ''}`
          : 'Каталог новых запчастей с доставкой по России'
      }
      renderGridItem={(card) => <NewPartSeoCardTile key={card.id} card={card} />}
      emptyMessage="Пока нет карточек для этого бренда."
      emptyLink="/autoparts/new"
      emptyLinkLabel="Перейти к поиску"
      notFoundBackLink="/autoparts/new"
      notFoundBackLabel="К новым запчастям"
      popularQueriesTitle="Популярные артикулы"
    />
  );
}
