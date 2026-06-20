import React from 'react';
import { formatNumber, pageLabel } from './analyticsFormatters';
import { DataTable, Section } from './AnalyticsUi';

export default function LandingConversionSection({ landings }) {
  const rows = landings?.items || [];

  return (
    <Section
      title="Посадочные и конверсии"
      subtitle="Не только визиты — заказы и действия с landing"
    >
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-400">
          Нет посадочных с трафиком за период
        </p>
      ) : (
        <DataTable
          columns={[
            {
              key: 'path',
              label: 'Landing',
              render: (row) => (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {pageLabel(row.path_template)}
                  </p>
                  <p className="truncate font-mono text-[11px] text-gray-400">{row.landing_path}</p>
                </div>
              ),
            },
            {
              key: 'visitors',
              label: 'Посет.',
              align: 'right',
              render: (row) => formatNumber(row.unique_visitors),
            },
            {
              key: 'views',
              label: 'Просм.',
              align: 'right',
              render: (row) => formatNumber(row.views),
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
            {
              key: 'cr',
              label: 'CR',
              align: 'right',
              render: (row) => `${row.conversion_rate}%`,
            },
          ]}
          rows={rows}
          rowKey={(row) => row.path_template}
        />
      )}
    </Section>
  );
}
