import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../../Breadcrumbs/Breadcrumbs';
import PageAmbientBackground from '../../PageAmbientBackground/PageAmbientBackground';
import SeoCrossLinksSection from '../SeoCrossLinksSection';
import { PageSeoHelmet } from '../../../utils/pageSeo';
import SeoLandingCatalogPagination from './SeoLandingCatalogPagination';
import SeoLandingContentBlock from './SeoLandingContentBlock';
import SeoLandingFaqSection from './SeoLandingFaqSection';
import SeoLandingHero from './SeoLandingHero';
import SeoLandingPopularQueries from './SeoLandingPopularQueries';
import SeoLandingShell from './SeoLandingShell';
import SeoLandingSimilarCategories from './SeoLandingSimilarCategories';

function LoadingState() {
  return (
    <div className="relative min-h-[50vh] px-4 py-16">
      <PageAmbientBackground />
      <p className="text-center text-sm text-gray-500">Загрузка каталога…</p>
    </div>
  );
}

function NotFoundState({ error, backLink, backLabel }) {
  return (
    <div className="relative min-h-[50vh] px-4 py-16">
      <PageAmbientBackground />
      <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Страница не найдена</h1>
        <p className="mt-2 text-sm text-gray-500">{error || 'Посадочная недоступна.'}</p>
        {backLink ? (
          <Link to={backLink} className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
            {backLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function SeoLandingPageView({
  kind,
  slug,
  landing,
  seo,
  catalogData,
  breadcrumbItems,
  loading,
  error,
  page,
  setPage,
  totalPages,
  statsText,
  renderGridItem,
  emptyMessage,
  emptyLink,
  emptyLinkLabel,
  notFoundBackLink,
  notFoundBackLabel,
  extraBeforeGrid = null,
  popularQueriesTitle = 'Популярные запросы',
}) {
  if (loading && !landing) {
    return <LoadingState />;
  }

  if (!landing || !seo) {
    return (
      <NotFoundState
        error={error}
        backLink={notFoundBackLink}
        backLabel={notFoundBackLabel}
      />
    );
  }

  const content = landing.content;
  const popularQueries = content?.popular_queries?.length
    ? content.popular_queries
    : [];

  return (
    <SeoLandingShell>
      <PageSeoHelmet seo={seo} />
      <Helmet>
        {content?.faq_json_ld ? (
          <script type="application/ld+json">{content.faq_json_ld}</script>
        ) : null}
        {seo.jsonLd?.map((block) => (
          <script key={block['@type']} type="application/ld+json">
            {JSON.stringify(block)}
          </script>
        ))}
      </Helmet>

      <Breadcrumbs items={breadcrumbItems} includeJsonLd />

      <SeoLandingHero h1={seo.h1} statsText={statsText} total={catalogData?.total || 0} />

      {content?.about_html ? (
        <SeoLandingContentBlock title="О разделе" html={content.about_html} />
      ) : null}

      {content?.order_delivery_html ? (
        <SeoLandingContentBlock title="Заказ и доставка" html={content.order_delivery_html} />
      ) : null}

      <SeoLandingFaqSection faqItems={content?.faq_items} />

      <SeoLandingPopularQueries queries={popularQueries} title={popularQueriesTitle} />

      {kind?.startsWith('category_') ? (
        <SeoLandingSimilarCategories kind={kind} slug={slug} />
      ) : null}

      <SeoCrossLinksSection kind={kind} slug={slug} />

      {extraBeforeGrid}

      {catalogData?.items?.length ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 sm:text-xl">Каталог</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {catalogData.items.map((item, index) => renderGridItem(item, index))}
          </div>
          <SeoLandingCatalogPagination
            page={page}
            totalPages={totalPages}
            loading={loading}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-8 text-center text-sm text-gray-500">
          {emptyMessage}{' '}
          {emptyLink ? (
            <Link to={emptyLink} className="text-indigo-600 hover:underline">
              {emptyLinkLabel}
            </Link>
          ) : null}
        </div>
      )}
    </SeoLandingShell>
  );
}
