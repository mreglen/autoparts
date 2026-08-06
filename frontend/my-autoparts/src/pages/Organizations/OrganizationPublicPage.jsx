import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { apiAxiosUnauth, normalizeImageUrl } from '../../utils/apiClient';
import PageAmbientBackground from '../../components/PageAmbientBackground/PageAmbientBackground';
import {
  formatOrganizationPhone,
  getOrganizationDisplayName,
  getOrganizationInitials,
  getOrganizationLogoUrl,
} from './organizationPublicUtils';
import { buildOrganizationDetailSeo, buildOrganizationLoadingSeo } from './organizationSeo';
import { PageSeoHelmet } from '../../utils/pageSeo';
import OrganizationTrustStatsPanel from './OrganizationTrustStatsPanel';

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-56 rounded-sg-lg bg-surface-subtle" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-32 rounded-sg bg-surface-muted" />
        <div className="h-32 rounded-sg bg-surface-muted" />
      </div>
    </div>
  );
}

export default function OrganizationPublicPage() {
  const { orgId } = useParams();
  const [organization, setOrganization] = useState(null);
  const [catalogSummary, setCatalogSummary] = useState(null);
  const [trustStats, setTrustStats] = useState(null);
  const [trustLoading, setTrustLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await apiAxiosUnauth.get(`/public/organizations/${orgId}`);
        if (!cancelled) {
          setOrganization(res.data);
          const name = (res.data?.name || '').trim();
          if (name && orgId) {
            sessionStorage.setItem(`org-bc-name:${orgId}`, name);
          }
        }
        if (res.data?.has_catalog_items) {
          try {
            const summaryRes = await apiAxiosUnauth.get(
              `/public/organizations/${orgId}/catalog-summary`,
            );
            if (!cancelled) setCatalogSummary(summaryRes.data);
          } catch (_summaryError) {
            if (!cancelled) setCatalogSummary(null);
          }
        } else if (!cancelled) {
          setCatalogSummary(null);
        }
        try {
          setTrustLoading(true);
          const trustRes = await apiAxiosUnauth.get(`/public/organizations/${orgId}/trust-stats`);
          if (!cancelled) setTrustStats(trustRes?.data || null);
        } catch (_trustError) {
          if (!cancelled) setTrustStats(null);
        } finally {
          if (!cancelled) setTrustLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setOrganization(null);
          const detail = e?.response?.data?.detail;
          setError(typeof detail === 'string' ? detail : 'Организация не найдена');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const seo = useMemo(
    () =>
      organization
        ? buildOrganizationDetailSeo(organization)
        : buildOrganizationLoadingSeo(orgId),
    [organization, orgId],
  );

  if (loading) {
    return (
      <>
        <PageSeoHelmet seo={seo} />
        <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <DetailSkeleton />
        </div>
      </>
    );
  }

  if (error || !organization) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Helmet>
          <title>Организация не найдена — Свой Гараж</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="rounded-sg-lg border border-danger-100 bg-danger-50 px-6 py-12 text-center">
          <h1 className="text-xl font-semibold text-danger-700">Организация не найдена</h1>
          <p className="mt-2 text-sm text-danger-600">{error || 'Проверьте ссылку или вернитесь к списку.'}</p>
          <Link
            to="/organizations"
            className="mt-6 inline-flex rounded-sg border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-brand-600 shadow-sg-sm hover:bg-surface-muted"
          >
            Все организации
          </Link>
        </div>
      </div>
    );
  }

  const name = getOrganizationDisplayName(organization.name);
  const logoUrl = getOrganizationLogoUrl(organization.logo_organization);
  const phone = formatOrganizationPhone(organization.phone);
  const telHref = organization.phone ? `tel:${organization.phone.replace(/\D/g, '')}` : null;
  const description = (organization.description || '').trim();
  const ogImage = organization.logo_organization
    ? normalizeImageUrl(organization.logo_organization)
    : seo.imageUrl;

  return (
    <div className="relative w-full pb-12">
      <Helmet>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <link rel="canonical" href={seo.canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Свой Гараж" />
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        <meta property="og:url" content={seo.canonicalUrl} />
        <meta property="og:locale" content="ru_RU" />
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
        {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}
        <script type="application/ld+json">{JSON.stringify(seo.jsonLd)}</script>
      </Helmet>

      <PageAmbientBackground />

      <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <article className="overflow-hidden rounded-sg-lg border border-line bg-surface shadow-sg">
          <div className="border-b border-line bg-surface-muted px-6 py-10 sm:px-10 sm:py-12">
            <Link
              to="/organizations"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition hover:text-brand-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Все организации
            </Link>

            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-sg-lg border border-line bg-surface shadow-sg sm:h-32 sm:w-32">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-brand-600">{getOrganizationInitials(name)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-brand-700">Продавец на «Свой Гараж»</p>
                <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">{name}</h1>
                {organization.address && (
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
                    {organization.address}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
            <div className="rounded-sg border border-line bg-surface-muted p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Телефон</p>
              {phone && telHref ? (
                <a href={telHref} className="mt-2 block text-lg font-semibold text-brand-600 hover:underline">
                  {phone}
                </a>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">Не указан</p>
              )}
            </div>
            <div className="rounded-sg border border-line bg-surface-muted p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Каталог запчастей</p>
              {organization.has_catalog_items ? (
                <Link
                  to={`/autoparts/used?organization_id=${encodeURIComponent(orgId)}`}
                  className="mt-2 inline-flex items-center gap-1 text-lg font-semibold text-brand-600 hover:text-brand-700"
                >
                  Перейти к поиску
                  <span aria-hidden>→</span>
                </Link>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">Сейчас нет позиций в открытом каталоге</p>
              )}
            </div>
          </div>

          <section className="border-t border-line px-6 py-8 sm:px-8">
            <OrganizationTrustStatsPanel trustStats={trustStats} loading={trustLoading} />
          </section>

          {catalogSummary?.brands?.length ? (
            <section className="border-t border-line px-6 py-8 sm:px-8">
              <h2 className="text-xl font-bold text-ink">Бренды в каталоге</h2>
              <p className="mt-2 text-sm text-ink-muted">
                {catalogSummary.total_count
                  ? `${catalogSummary.total_count} позиций от ${name}`
                  : 'Популярные бренды продавца'}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {catalogSummary.brands.map((brand) => (
                  <Link
                    key={brand.slug || brand.name}
                    to={`/autoparts/used?organization_id=${encodeURIComponent(orgId)}&brand=${encodeURIComponent(brand.name)}`}
                    className="flex min-h-[44px] items-center justify-center rounded-sg border border-line bg-surface px-3 py-2.5 text-center text-sm font-medium text-ink-soft transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {brand.name}
                    {brand.count ? ` (${brand.count})` : ''}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {description && (
            <section className="border-t border-line px-6 py-8 sm:px-8">
              <h2 className="text-xl font-bold text-ink">О компании</h2>
              <p className="mt-4 whitespace-pre-line text-base leading-8 text-ink-soft">{description}</p>
            </section>
          )}

          <footer className="flex flex-wrap gap-3 border-t border-line bg-surface-muted px-6 py-5 sm:px-8">
            <Link
              to="/organizations"
              className="inline-flex items-center rounded-sg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand-200 hover:text-brand-700"
            >
              ← К списку
            </Link>
            <Link
              to="/catalog"
              className="inline-flex items-center rounded-sg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Открыть каталог
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center rounded-sg px-4 py-2.5 text-sm font-semibold text-ink-muted transition hover:text-brand-700"
            >
              О платформе
            </Link>
          </footer>
        </article>
      </div>
    </div>
  );
}
