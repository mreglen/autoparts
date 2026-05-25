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

function OrganizationCard({ org }) {
  const name = getOrganizationDisplayName(org.name);
  const logoUrl = getOrganizationLogoUrl(org.logo_organization);
  const phone = formatOrganizationPhone(org.phone);
  const description = (org.description || '').trim();

  return (
    <Link
      to={`/organizations/${org.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/70 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-indigo-200/80"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 opacity-0 transition group-hover:opacity-100" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-indigo-50 shadow-inner">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="text-xl font-bold text-indigo-600">{getOrganizationInitials(name)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="line-clamp-2 text-lg font-bold leading-snug text-slate-900 transition group-hover:text-indigo-700">
              {name}
            </h2>
            {org.address && (
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-500">{org.address}</p>
            )}
          </div>
        </div>

        {description && (
          <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-slate-600">{description}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {phone && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {phone}
            </span>
          )}
          {org.has_catalog_items && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
              Запчасти в каталоге
            </span>
          )}
          <span className="ml-auto text-xs font-semibold text-indigo-600 opacity-0 transition group-hover:opacity-100">
            Подробнее →
          </span>
        </div>
      </div>
    </Link>
  );
}

function OrganizationsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex gap-4">
            <div className="h-16 w-16 rounded-2xl bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 rounded-lg bg-slate-200" />
              <div className="h-4 w-full rounded bg-slate-100" />
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
        <header className="relative overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-white via-white to-indigo-50/70 p-6 shadow-xl shadow-indigo-950/5 ring-1 ring-slate-200/60 sm:p-8 md:p-10">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-indigo-400/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Партнёры платформы</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Организации на «Свой Гараж»
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
              Компании, которые продают автозапчасти через наш сервис. Откройте карточку организации, чтобы
              узнать контакты, адрес и описание.
            </p>
            {!loading && !error && (
              <p className="mt-4 text-sm font-medium text-slate-500">
                В каталоге: {organizations.length}{' '}
                {organizations.length === 1 ? 'организация' : organizations.length < 5 ? 'организации' : 'организаций'}
              </p>
            )}
          </div>

          <div className="relative mt-8 max-w-xl">
            <label htmlFor="org-search" className="sr-only">
              Поиск организаций
            </label>
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
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
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </header>

        <div className="mt-8">
          {loading && <OrganizationsSkeleton />}

          {!loading && error && (
            <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-10 text-center">
              <p className="text-base font-semibold text-red-800">Не удалось загрузить каталог</p>
              <p className="mt-2 text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
              >
                Обновить страницу
              </button>
            </div>
          )}

          {!loading && !error && filteredOrganizations.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center backdrop-blur-sm">
              <p className="text-lg font-semibold text-slate-900">Организации не найдены</p>
              <p className="mt-2 text-sm text-slate-500">
                {searchQuery ? 'Попробуйте изменить запрос поиска.' : 'Пока нет опубликованных организаций.'}
              </p>
            </div>
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
    </div>
  );
}
