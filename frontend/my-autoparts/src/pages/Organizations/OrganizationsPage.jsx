import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';
import PageIntro from '../../components/PageIntro/PageIntro';
import {
  formatOrganizationPhone,
  getOrganizationDisplayName,
  getOrganizationInitials,
  getOrganizationLogoUrl,
} from './organizationPublicUtils';

function OrganizationCard({ org }) {
  const name = getOrganizationDisplayName(org.name);
  const logoUrl = getOrganizationLogoUrl(org.logo_organization);
  const phone = formatOrganizationPhone(org.phone);
  const description = (org.description || '').trim();

  return (
    <Link
      to={`/organizations/${org.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg"
    >
      <div className="relative h-28 bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_55%)]" />
        <div className="absolute -bottom-8 left-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-indigo-600">{getOrganizationInitials(name)}</span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-11">
        <h2 className="line-clamp-2 text-lg font-semibold text-gray-900 group-hover:text-indigo-700">
          {name}
        </h2>
        {org.address && (
          <p className="mt-2 line-clamp-2 text-sm text-gray-500">{org.address}</p>
        )}
        {description && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-600">{description}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          {phone && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
              {phone}
            </span>
          )}
          {org.products_count > 0 && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              {org.products_count} в наличии
            </span>
          )}
          {org.members_count > 0 && (
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
              {org.members_count} сотрудн.
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function OrganizationsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="h-28 bg-gray-200" />
          <div className="space-y-3 px-5 pb-5 pt-11">
            <div className="h-5 w-2/3 rounded bg-gray-200" />
            <div className="h-4 w-full rounded bg-gray-100" />
            <div className="h-4 w-5/6 rounded bg-gray-100" />
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
          setError(e?.response?.data?.detail || 'Не удалось загрузить организации');
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
      const haystack = [
        org.name,
        org.address,
        org.phone,
        org.description,
        org.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [organizations, searchQuery]);

  const totalProducts = useMemo(
    () => organizations.reduce((sum, org) => sum + (org.products_count || 0), 0),
    [organizations]
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Helmet>
        <title>Организации — Свой Гараж</title>
        <meta
          name="description"
          content="Список организаций-партнёров на платформе «Свой Гараж»: контакты, адреса и информация о продавцах автозапчастей."
        />
      </Helmet>

      <PageIntro
        title="Организации"
        description="Зарегистрированные организации на платформе «Свой Гараж». Выберите компанию, чтобы посмотреть контакты и описание."
      />

      <section className="mb-6 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-700">Партнёры платформы</p>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              Здесь собраны все организации, зарегистрированные в системе. Нажмите на карточку,
              чтобы открыть страницу организации.
            </p>
            {!loading && (
              <div className="mt-4 flex flex-wrap gap-3">
                <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200">
                  {organizations.length} организаций
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200">
                  {totalProducts} позиций в наличии
                </span>
              </div>
            )}
          </div>

          <div className="w-full lg:max-w-sm">
            <label htmlFor="org-search" className="sr-only">
              Поиск организаций
            </label>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                id="org-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по названию, адресу, телефону…"
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
        </div>
      </section>

      {loading && <OrganizationsSkeleton />}

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && filteredOrganizations.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-16 text-center">
          <p className="text-base font-medium text-gray-900">Организации не найдены</p>
          <p className="mt-2 text-sm text-gray-500">
            {searchQuery ? 'Попробуйте изменить запрос поиска.' : 'Пока нет зарегистрированных организаций.'}
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
  );
}
