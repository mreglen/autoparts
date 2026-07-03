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

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-56 rounded-3xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-32 rounded-2xl bg-slate-100" />
        <div className="h-32 rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

export default function OrganizationPublicPage() {
  const { orgId } = useParams();
  const [organization, setOrganization] = useState(null);
  const [catalogSummary, setCatalogSummary] = useState(null);
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
        <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-12 text-center">
          <h1 className="text-xl font-semibold text-red-800">Организация не найдена</h1>
          <p className="mt-2 text-sm text-red-700">{error || 'Проверьте ссылку или вернитесь к списку.'}</p>
          <Link
            to="/organizations"
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-indigo-600 shadow-sm ring-1 ring-red-200 hover:bg-red-50"
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
        <article className="overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/70 backdrop-blur-sm">
          <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-800 px-6 py-10 sm:px-10 sm:py-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.35),transparent_45%)]" />
            <Link
              to="/organizations"
              className="relative inline-flex items-center gap-1.5 text-sm font-medium text-indigo-200 transition hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Все организации
            </Link>

            <div className="relative mt-8 flex flex-col gap-6 sm:flex-row sm:items-end">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-white/20 bg-white shadow-2xl sm:h-32 sm:w-32">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-indigo-600">{getOrganizationInitials(name)}</span>
                )}
              </div>
              <div className="min-w-0 text-white">
                <p className="text-sm font-medium text-indigo-200">Продавец на «Свой Гараж»</p>
                <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{name}</h1>
                {organization.address && (
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-indigo-100/90 sm:text-base">
                    {organization.address}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Телефон</p>
              {phone && telHref ? (
                <a href={telHref} className="mt-2 block text-lg font-semibold text-indigo-600 hover:underline">
                  {phone}
                </a>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Не указан</p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Каталог запчастей</p>
              {organization.has_catalog_items ? (
                <Link
                  to={`/autoparts/used?organization_id=${encodeURIComponent(orgId)}`}
                  className="mt-2 inline-flex items-center gap-1 text-lg font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Перейти к поиску
                  <span aria-hidden>→</span>
                </Link>
              ) : (
                <p className="mt-2 text-sm text-slate-600">Сейчас нет позиций в открытом каталоге</p>
              )}
            </div>
          </div>

          {catalogSummary?.brands?.length ? (
            <section className="border-t border-slate-100 px-6 py-8 sm:px-8">
              <h2 className="text-xl font-bold text-slate-900">Бренды в каталоге</h2>
              <p className="mt-2 text-sm text-slate-600">
                {catalogSummary.total_count
                  ? `${catalogSummary.total_count} позиций от ${name}`
                  : 'Популярные бренды продавца'}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {catalogSummary.brands.map((brand) => (
                  <Link
                    key={brand.slug || brand.name}
                    to={`/autoparts/used?organization_id=${encodeURIComponent(orgId)}&brand=${encodeURIComponent(brand.name)}`}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 min-h-[44px] flex items-center justify-center text-center"
                  >
                    {brand.name}
                    {brand.count ? ` (${brand.count})` : ''}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {description && (
            <section className="border-t border-slate-100 px-6 py-8 sm:px-8">
              <h2 className="text-xl font-bold text-slate-900">О компании</h2>
              <p className="mt-4 whitespace-pre-line text-base leading-8 text-slate-700">{description}</p>
            </section>
          )}

          <footer className="flex flex-wrap gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-5 sm:px-8">
            <Link
              to="/organizations"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700"
            >
              ← К списку
            </Link>
            <Link
              to="/catalog"
              className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Открыть каталог
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:text-indigo-700"
            >
              О платформе
            </Link>
          </footer>
        </article>
      </div>
    </div>
  );
}
