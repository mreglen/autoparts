import React from 'react';
import { formatNumber, SOURCE_LABELS } from './analyticsFormatters';
import { DataTable, Section } from './AnalyticsUi';

export default function SourcesSection({ sources }) {
  const rows = sources?.items || [];

  return (
    <Section title="Источники трафика" subtitle="Organic, direct и другие сегменты">
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-400">Нет данных об источниках</p>
      ) : (
        <DataTable
          columns={[
            {
              key: 'source',
              label: 'Источник',
              render: (row) => SOURCE_LABELS[row.traffic_source] || row.traffic_source,
            },
            {
              key: 'sessions',
              label: 'Сессии',
              align: 'right',
              render: (row) => formatNumber(row.sessions),
            },
            {
              key: 'views',
              label: 'Просмотры',
              align: 'right',
              render: (row) => formatNumber(row.page_views),
            },
            {
              key: 'cart',
              label: 'Корзина',
              align: 'right',
              render: (row) => formatNumber(row.add_to_cart),
            },
            {
              key: 'orders',
              label: 'Заказы',
              align: 'right',
              render: (row) => formatNumber(row.order_placed),
            },
          ]}
          rows={rows}
          rowKey={(row) => row.traffic_source}
        />
      )}
    </Section>
  );
}
