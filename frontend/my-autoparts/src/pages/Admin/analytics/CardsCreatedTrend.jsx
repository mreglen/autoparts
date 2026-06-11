import React, { useMemo } from 'react';
import { formatDay, formatNumber } from './analyticsFormatters';
import { DataTable } from './AnalyticsUi';

export default function CardsCreatedTrend({ activity = [], title = 'Создано карточек по дням' }) {
  const sorted = useMemo(
    () => [...activity].sort((a, b) => new Date(a.day) - new Date(b.day)),
    [activity],
  );

  const maxCreated = useMemo(
    () => Math.max(1, ...sorted.map((row) => Number(row.created) || 0)),
    [sorted],
  );

  if (!sorted.length) {
    return <p className="py-6 text-center text-sm text-gray-400">Нет данных о создании карточек</p>;
  }

  return (
    <div className="space-y-4 p-4">
      <p className="text-xs font-medium text-gray-500">{title}</p>
      <div className="flex h-28 items-end gap-1">
        {sorted.map((row) => {
          const created = Number(row.created) || 0;
          const heightPct = Math.max(4, Math.round((created / maxCreated) * 100));
          return (
            <div
              key={row.day}
              className="group flex flex-1 flex-col items-center justify-end gap-1"
              title={`${formatDay(row.day)}: ${formatNumber(created)}`}
            >
              <div
                className="w-full max-w-[2rem] rounded-t-md bg-emerald-500/80 transition group-hover:bg-emerald-600"
                style={{ height: `${heightPct}%` }}
              />
              <span className="hidden text-[10px] text-gray-400 sm:block">{formatDay(row.day)}</span>
            </div>
          );
        })}
      </div>
      <DataTable
        columns={[
          { key: 'day', label: 'Дата', render: (r) => formatDay(r.day) },
          {
            key: 'created',
            label: 'Создано',
            align: 'right',
            render: (r) => formatNumber(r.created),
          },
        ]}
        rows={[...sorted].reverse()}
        rowKey={(r) => r.day}
      />
    </div>
  );
}
