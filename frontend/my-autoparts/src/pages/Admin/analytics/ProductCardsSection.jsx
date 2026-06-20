import React from 'react';
import { formatDuration, formatNumber } from './analyticsFormatters';
import { DataTable, Section } from './AnalyticsUi';

export default function ProductCardsSection({ productCards }) {
  const rows = productCards?.items || [];

  return (
    <Section
      title="Топ карточек товаров"
      subtitle={`${formatNumber(productCards?.unique_cards || 0)} карточек · ${formatNumber(productCards?.total_views || 0)} просмотров`}
    >
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-400">Нет просмотров карточек</p>
      ) : (
        <DataTable
          columns={[
            {
              key: 'name',
              label: 'Товар',
              render: (row) => (
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-900">
                    {[row.brand, row.article].filter(Boolean).join(' · ') || row.path_raw}
                  </p>
                  {row.name ? (
                    <p className="truncate text-xs text-gray-500">{row.name}</p>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'views',
              label: 'Просм.',
              align: 'right',
              render: (row) => formatNumber(row.views),
            },
            {
              key: 'visitors',
              label: 'Посет.',
              align: 'right',
              render: (row) => formatNumber(row.unique_visitors),
            },
            {
              key: 'time',
              label: 'Время',
              align: 'right',
              render: (row) => formatDuration(row.avg_duration_sec),
            },
          ]}
          rows={rows.slice(0, 20)}
          rowKey={(row) => row.path_raw}
        />
      )}
    </Section>
  );
}
