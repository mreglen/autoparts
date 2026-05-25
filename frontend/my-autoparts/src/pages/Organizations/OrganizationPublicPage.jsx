import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';
import {
  formatOrganizationPhone,
  getOrganizationDisplayName,
  getOrganizationInitials,
  getOrganizationLogoUrl,
} from './organizationPublicUtils';

function InfoTile({ icon, label, value, href }) {
  const content = href ? (
    <a href={href} className="mt-1 block text-sm font-medium text-indigo-600 hover:underline">
      {value}
    </a>
  ) : (
    <p className="mt-1 text-sm font-medium text-gray-900 break-words">{value}</p>
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      {content}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-48 rounded-3xl bg-gray-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-gray-100" />
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-gray-100" />
    </div>
  );
}

export default function OrganizationPublicPage() {
  const { orgId } = useParams();
  const [organization, setOrganization] = useState(null);
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
        }
      } catch (e) {
        if (!cancelled) {
          setOrganization(null);
          setError(e?.response?.data?.detail || 'Организация не найдена');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-red-800">Организация не найдена</h1>
        <p className="mt-2 text-sm text-red-700">{error || 'Проверьте ссылку или вернитесь к списку.'}</p>
        <Link
          to="/organizations"
          className="mt-6 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm ring-1 ring-red-200 hover:bg-red-50"
        >
          Все организации
        </Link>
      </div>
    );
  }

  const name = getOrganizationDisplayName(organization.name);
  const logoUrl = getOrganizationLogoUrl(organization.logo_organization);
  const phone = formatOrganizationPhone(organization.phone);
  const telHref = organization.phone ? `tel:${organization.phone.replace(/\D/g, '')}` : null;
  const description = (organization.description || '').trim();

  return (
    <div className="mx-auto max-w-5xl">
      <Helmet>
        <title>{name} — организация на Свой Гараж</title>
        <meta
          name="description"
          content={
            description ||
            `Страница организации ${name} на платформе «Свой Гараж»: контакты, адрес и информация о продавце.`
          }
        />
      </Helmet>

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="relative bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-500 px-6 pb-16 pt-8 sm:px-8 sm:pb-20 sm:pt-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_50%)]" />
          <Link
            to="/organizations"
            className="relative inline-flex items-center gap-1 text-sm font-medium text-indigo-100 transition hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Все организации
          </Link>

          <div className="relative mt-8 flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-white/90 bg-white shadow-xl sm:h-28 sm:w-28">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-indigo-600">{getOrganizationInitials(name)}</span>
              )}
            </div>
            <div className="min-w-0 text-white">
              <p className="text-sm font-medium text-indigo-100">Организация на платформе</p>
              <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">{name}</h1>
              <p className="mt-2 font-mono text-xs text-indigo-100/90">ID {organization.id}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4 sm:px-8">
          <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
            <p className="text-xs text-gray-500">Товаров в наличии</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{organization.products_count || 0}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
            <p className="text-xs text-gray-500">Сотрудников</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{organization.members_count || 0}</p>
          </div>
          <div className="rounded-2xl bg-indigo-50 px-4 py-3 ring-1 ring-indigo-100 sm:col-span-2">
            <p className="text-xs text-indigo-700">Каталог запчастей</p>
            <Link
              to="/autoparts/used"
              className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:text-indigo-900"
            >
              Перейти к поиску запчастей
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InfoTile
          label="Адрес"
          value={organization.address || 'Не указан'}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <InfoTile
          label="Телефон"
          value={phone || 'Не указан'}
          href={phone && telHref ? telHref : undefined}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          }
        />
        <InfoTile
          label="Платформа"
          value="Свой Гараж"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M9 21V9a1 1 0 011-1h4a1 1 0 011 1v12M9 21H5a1 1 0 01-1-1v-4a1 1 0 011-1h2M15 21h4a1 1 0 001-1v-4a1 1 0 00-1-1h-2" />
            </svg>
          }
        />
      </div>

      {description && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900">О компании</h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-700">{description}</p>
        </section>
      )}

      <section className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/organizations"
          className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-indigo-200 hover:text-indigo-700"
        >
          ← К списку организаций
        </Link>
        <Link
          to="/catalog"
          className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Открыть каталог
        </Link>
      </section>
    </div>
  );
}
