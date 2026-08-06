import React from 'react';
import {
  formatResponseMinutes,
  formatSalesCount,
  pluralSales,
} from '../../utils/organizationTrustUtils';
import { Badge, Card } from '../../components/UI';

export default function OrganizationTrustStatsPanel({ trustStats, loading = false }) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-28 animate-pulse rounded-sg bg-surface-muted" />
        ))}
      </div>
    );
  }

  if (!trustStats) return null;

  const responseLabel = formatResponseMinutes(trustStats.avg_response_minutes);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-ink">Надёжность продавца</h2>
        {trustStats.is_verified_seller ? (
          <Badge tone="success">Проверенный продавец</Badge>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card padding="md" className="border-brand-100 bg-brand-50 shadow-none">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Успешные продажи</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-ink">
            {formatSalesCount(trustStats.completed_sales_count)}
          </p>
          <p className="text-sm text-ink-muted">{pluralSales(trustStats.completed_sales_count)} на платформе</p>
        </Card>

        <Card padding="md" className="bg-surface-muted shadow-none">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">В каталоге</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-ink">
            {formatSalesCount(trustStats.catalog_products_count)}
          </p>
          <p className="text-sm text-ink-muted">позиций в наличии</p>
        </Card>

        <Card padding="md" className="bg-surface-muted shadow-none">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Среднее время ответа</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-ink">
            {responseLabel || '—'}
          </p>
          <p className="text-sm text-ink-muted">
            {responseLabel ? 'по чатам за 90 дней' : 'пока недостаточно данных'}
          </p>
        </Card>
      </div>
    </section>
  );
}
