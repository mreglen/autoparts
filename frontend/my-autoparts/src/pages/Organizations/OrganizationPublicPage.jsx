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
import { Badge, Button, Card, EmptyState, Skeleton } from '../../components/UI';

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-36" />
      <Card padding="lg">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <Skeleton className="h-28 w-28 rounded-sg-lg sm:h-32 sm:w-32" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 w-full rounded-sg-lg" />
        <Skeleton className="h-28 w-full rounded-sg-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-sg-lg" />
        <Skeleton className="h-28 w-full rounded-sg-lg" />
        <Skeleton className="h-28 w-full rounded-sg-lg" />
      </div>
    </div>
  );
}

function InfoTile({ label, children }) {
  return (
    <Card padding="md" className="bg-surface-subtle shadow-none">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <div className="mt-2">{children}</div>
    </Card>
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
        <div className="relative w-full pb-12">
          <PageAmbientBackground />
          <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <DetailSkeleton />
          </div>
        </div>
      </>
    );
  }

  if (error || !organization) {
    return (
      <div className="relative w-full pb-12">
        <Helmet>
          <title>Организация не найдена — Свой Гараж</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <PageAmbientBackground />
        <div className="relative mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
          <EmptyState
            illustration="error"
            title="Организация не найдена"
            description={error || 'Проверьте ссылку или вернитесь к списку.'}
          />
          <div className="flex justify-center">
            <Button as={Link} to="/organizations" variant="secondary">
              Все организации
            </Button>
          </div>
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
  const catalogHref = `/autoparts/used?organization_id=${encodeURIComponent(orgId)}`;

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

      <div className="relative mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Button
          as={Link}
          to="/organizations"
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-brand-700 hover:text-brand-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Все организации
        </Button>

        <Card padding="lg">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-sg-lg border border-line bg-surface-muted sm:h-32 sm:w-32">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-brand-600">
                  {getOrganizationInitials(name)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">Продавец на «Свой Гараж»</Badge>
                {organization.has_catalog_items ? (
                  <Badge tone="success">Запчасти в каталоге</Badge>
                ) : null}
                {orgId != null ? (
                  <span className="font-mono text-xs text-ink-faint" title="Идентификатор организации">
                    ID {orgId}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
                {name}
              </h1>
              {organization.address ? (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
                  {organization.address}
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                {organization.has_catalog_items ? (
                  <Button as={Link} to={catalogHref}>
                    Смотреть запчасти
                  </Button>
                ) : null}
                {phone && telHref ? (
                  <Button as="a" href={telHref} variant="secondary">
                    Позвонить
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <InfoTile label="Телефон">
            {phone && telHref ? (
              <a href={telHref} className="block text-lg font-semibold text-brand-600 hover:underline">
                {phone}
              </a>
            ) : (
              <p className="text-sm text-ink-muted">Не указан</p>
            )}
          </InfoTile>
          <InfoTile label="Каталог запчастей">
            {organization.has_catalog_items ? (
              <Link
                to={catalogHref}
                className="inline-flex items-center gap-1 text-lg font-semibold text-brand-600 hover:text-brand-700"
              >
                Перейти к поиску
                <span aria-hidden>→</span>
              </Link>
            ) : (
              <p className="text-sm text-ink-soft">Сейчас нет позиций в открытом каталоге</p>
            )}
          </InfoTile>
        </div>

        {trustLoading || trustStats ? (
          <Card padding="lg">
            <OrganizationTrustStatsPanel trustStats={trustStats} loading={trustLoading} />
          </Card>
        ) : null}

        {catalogSummary?.brands?.length ? (
          <Card padding="lg">
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
                  className="flex min-h-[44px] items-center justify-center rounded-sg border border-line bg-surface-subtle px-3 py-2.5 text-center text-sm font-medium text-ink-soft transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                >
                  {brand.name}
                  {brand.count ? ` (${brand.count})` : ''}
                </Link>
              ))}
            </div>
          </Card>
        ) : null}

        {description ? (
          <Card padding="lg">
            <h2 className="text-xl font-bold text-ink">О компании</h2>
            <p className="mt-4 whitespace-pre-line text-base leading-8 text-ink-soft">{description}</p>
          </Card>
        ) : null}

        <Card padding="md" className="bg-surface-subtle shadow-none">
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to="/organizations" variant="secondary">
              ← К списку
            </Button>
            <Button as={Link} to="/catalog">
              Открыть каталог
            </Button>
            <Button as={Link} to="/about" variant="ghost">
              О платформе
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
