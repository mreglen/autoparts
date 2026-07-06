import React from 'react';
import { Link } from 'react-router-dom';
import {
  formatResponseMinutes,
  formatSalesCount,
  pluralSales,
} from '../../utils/organizationTrustUtils';

export default function PartDetailSellerTrust({
  trustStats,
  organizationId,
  organizationName,
  loading = false,
}) {
  if (loading) {
    return (
      <div className="mt-3 animate-pulse space-y-2">
        <div className="h-4 w-40 rounded bg-gray-100" />
        <div className="h-4 w-56 rounded bg-gray-100" />
      </div>
    );
  }

  if (!trustStats) return null;

  const salesLabel = `${formatSalesCount(trustStats.completed_sales_count)} ${pluralSales(trustStats.completed_sales_count)}`;
  const responseLabel = formatResponseMinutes(trustStats.avg_response_minutes);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {trustStats.is_verified_seller ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Проверенный продавец
          </span>
        ) : null}
        {trustStats.completed_sales_count > 0 ? (
          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
            {salesLabel}
          </span>
        ) : null}
        {responseLabel ? (
          <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
            Ответ ~{responseLabel}
          </span>
        ) : null}
      </div>
      {organizationId ? (
        <Link
          to={`/organizations/${organizationId}`}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          Профиль продавца{organizationName ? `: ${organizationName}` : ''}
        </Link>
      ) : null}
    </div>
  );
}
