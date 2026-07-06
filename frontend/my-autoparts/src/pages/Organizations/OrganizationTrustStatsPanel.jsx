import React from 'react';
import {
  formatResponseMinutes,
  formatSalesCount,
  pluralSales,
} from '../../utils/organizationTrustUtils';

export default function OrganizationTrustStatsPanel({ trustStats, loading = false }) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!trustStats) return null;

  const responseLabel = formatResponseMinutes(trustStats.avg_response_minutes);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Надёжность продавца</h2>
        {trustStats.is_verified_seller ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
            Проверенный продавец
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Успешные продажи</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
            {formatSalesCount(trustStats.completed_sales_count)}
          </p>
          <p className="text-sm text-gray-600">{pluralSales(trustStats.completed_sales_count)} на платформе</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">В каталоге</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
            {formatSalesCount(trustStats.catalog_products_count)}
          </p>
          <p className="text-sm text-gray-600">позиций в наличии</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Среднее время ответа</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
            {responseLabel || '—'}
          </p>
          <p className="text-sm text-gray-600">
            {responseLabel ? 'по чатам за 90 дней' : 'пока недостаточно данных'}
          </p>
        </div>
      </div>
    </section>
  );
}
