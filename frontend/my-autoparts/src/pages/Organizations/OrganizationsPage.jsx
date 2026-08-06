import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';
import PageAmbientBackground from '../../components/PageAmbientBackground/PageAmbientBackground';
import {
  formatOrganizationPhone,
  getOrganizationDisplayName,
  getOrganizationInitials,
  getOrganizationLogoUrl,
} from './organizationPublicUtils';
import { buildOrganizationsListSeo } from './organizationSeo';
import YandexWebmasterCounter from '../../components/Seo/YandexWebmasterCounter';
import { Badge, Button, Card, PageHeader } from '../../components/UI';

function OrganizationCard({ org }) {
  const name = getOrganizationDisplayName(org.name);
  const logoUrl = getOrganizationLogoUrl(org.logo_organization);
  const phone = formatOrganizationPhone(org.phone);
  const description = (org.description || '').trim();

  return (
    <Card
      as={Link}
      to={`/organizations/${org.id}`}
      hover
      padding="md"
      className="group flex h-full flex-col transition-colors hover:border-brand-200"
    >
      <div className="flex flex-1 flex-col">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-sg border border-line bg-surface-muted">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="text-xl font-bold text-brand-600">{getOrganizationInitials(name)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="line-clamp-2 text-lg font-bold leading-snug text-ink transition group-hover:text-brand-700">
              {name}
            </h2>
            {org.address && (
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{org.address}</p>
            )}
          </div>
        </div>

        {description && (
          <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-ink-soft">{description}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {phone && (
            <Badge tone="neutral">
              <svg className="mr-1.5 h-3.5 w-3.5 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {phone}
            </Badge>
          )}
          {org.has_catalog_items && (
            <Badge tone="success">Запчасти в каталоге</Badge>
          )}
          <span className="ml-auto text-xs font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100">
            Подробнее →
          </span>
        </div>
      </div>
    </Card>
  );
}

function OrganizationsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="animate-pulse rounded-sg-lg border border-line bg-surface p-6">
          <div className="flex gap-4">
            <div className="h-16 w-16 rounded-sg bg-surface-subtle" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 rounded-sg bg-surface-subtle" />
              <div className="h-4 w-full rounded bg-surface-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiAxiosUnauth.get('/public/organizations');
        if (!cancelled) {
          setOrganizations(Array.isArray(res.data) ? res.data : []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          const detail = e?.response?.data?.detail;
          setError(typeof detail === 'string' ? detail : 'Не удалось загрузить организации');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredOrganizations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter((org) => {
      const haystack = [org.name, org.address, org.phone, org.description].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [organizations, searchQuery]);

  const seo = useMemo(() => buildOrganizationsListSeo(organizations.length), [organizations.length]);

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
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
        <script type="application/ld+json">{JSON.stringify(seo.jsonLd)}</script>
      </Helmet>

      <PageAmbientBackground />

      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Card padding="lg">
          <p className="text-sm font-semibold text-brand-700">Партнёры платформы</p>
          <PageHeader
            className="mb-0 mt-2"
            title="Организации на «Свой Гараж»"
            subtitle="Компании, которые продают автозапчасти через наш сервис. Откройте карточку организации, чтобы узнать контакты, адрес и описание."
          />
          {!loading && !error && (
            <p className="mt-4 text-sm font-medium text-ink-muted">
              В каталоге: {organizations.length}{' '}
              {organizations.length === 1 ? 'организация' : organizations.length < 5 ? 'организации' : 'организаций'}
            </p>
          )}

          <div className="relative mt-8 max-w-xl">
            <label htmlFor="org-search" className="sr-only">
              Поиск организаций
            </label>
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="org-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию, адресу или телефону…"
              className="w-full rounded-sg border border-line bg-surface-muted py-3 pl-12 pr-4 text-sm text-ink shadow-sg-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </Card>

        <div className="mt-8">
          {loading && <OrganizationsSkeleton />}

          {!loading && error && (
            <Card className="border-danger-100 bg-danger-50 px-6 py-10 text-center" padding="md">
              <p className="text-base font-semibold text-danger-700">Не удалось загрузить каталог</p>
              <p className="mt-2 text-sm text-danger-600">{error}</p>
              <Button
                type="button"
                variant="secondary"
                className="mt-5"
                onClick={() => window.location.reload()}
              >
                Обновить страницу
              </Button>
            </Card>
          )}

          {!loading && !error && filteredOrganizations.length === 0 && (
            <Card className="border-dashed px-6 py-16 text-center" padding="md">
              <p className="text-lg font-semibold text-ink">Организации не найдены</p>
              <p className="mt-2 text-sm text-ink-muted">
                {searchQuery ? 'Попробуйте изменить запрос поиска.' : 'Пока нет опубликованных организаций.'}
              </p>
            </Card>
          )}

          {!loading && !error && filteredOrganizations.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredOrganizations.map((org) => (
                <OrganizationCard key={org.id} org={org} />
              ))}
            </div>
          )}
        </div>
      </div>
      <YandexWebmasterCounter />
    </div>
  );
}
