import React from 'react';
import { formatOrganizationPhone } from '../../pages/Organizations/organizationPublicUtils';

export default function SellerStatsRow({ profile, orgDetail, catalogSummary }) {
  const phone = formatOrganizationPhone(orgDetail?.phone);
  const address = (orgDetail?.address || '').trim();
  const brandCount = catalogSummary?.brands?.length ?? 0;
  const topBrands = (catalogSummary?.brands || []).slice(0, 3).map((b) => b.name).join(', ');

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">В наличии</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
          {profile.catalog_products_count ?? 0}
        </p>
        <p className="text-sm text-gray-600">позиций в каталоге</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Бренды</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">{brandCount}</p>
        <p className="text-sm text-gray-600 line-clamp-2">
          {topBrands || 'в каталоге продавца'}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Контакты</p>
        {phone ? (
          <a
            href={`tel:${(orgDetail?.phone || '').replace(/\D/g, '')}`}
            className="mt-2 block text-lg font-semibold text-indigo-600 hover:underline"
          >
            {phone}
          </a>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Телефон не указан</p>
        )}
        {address ? (
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">{address}</p>
        ) : null}
      </div>
    </div>
  );
}
