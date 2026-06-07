import React, { useMemo, useState } from 'react';
import { formatDay, formatNumber } from './analyticsFormatters';
import { DataTable } from './AnalyticsUi';

export default function ActivityTrend({ activity = [], compact = false, title = 'Динамика по дням' }) {
  const [tableOpen, setTableOpen] = useState(false);

  const sorted = useMemo(
    () => [...activity].sort((a, b) => new Date(a.day) - new Date(b.day)),
    [activity]
  );

  const maxViews = useMemo(
    () => Math.max(1, ...sorted.map((row) => Number(row.page_views) || 0)),
    [sorted]
  );

  if (!sorted.length) {
    return <p className="py-6 text-center text-sm text-gray-400">Нет данных за период</p>;
  }

  const barHeight = compact ? 'h-20' : 'h-32';
  const showTable = !compact || tableOpen;

  return (
    <div className="space-y-4 p-4">
      {!compact && <p className="text-xs font-medium text-gray-500">{title}</p>}

      <div className={`flex items-end gap-1 ${barHeight}`}>
        {sorted.map((row) => {
          const views = Number(row.page_views) || 0;
          const heightPct = Math.max(4, Math.round((views / maxViews) * 100));
          return (
            <div
              key={row.day}
              className="group flex flex-1 flex-col items-center justify-end gap-1"
              title={`${formatDay(row.day)}: ${formatNumber(views)} просм., ${formatNumber(row.unique_visitors)} посет.`}
            >
              <div
                className="w-full max-w-[2rem] rounded-t-md bg-indigo-500/80 transition group-hover:bg-indigo-600"
                style={{ height: `${heightPct}%` }}
              />
              <span className="hidden text-[10px] text-gray-400 sm:block">{formatDay(row.day)}</span>
            </div>
          );
        })}
      </div>

      {compact && (
        <button
          type="button"
          onClick={() => setTableOpen((v) => !v)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 lg:hidden"
        >
          {tableOpen ? 'Скрыть таблицу' : 'Таблица по дням'}
        </button>
      )}

      <div className={compact && !showTable ? 'hidden lg:block' : showTable ? '' : 'hidden'}>
        <DataTable
          columns={[
            { key: 'day', label: 'Дата', render: (r) => formatDay(r.day) },
            {
              key: 'pv',
              label: 'Просм.',
              align: 'right',
              render: (r) => formatNumber(r.page_views),
            },
            {
              key: 'uv',
              label: 'Посет.',
              align: 'right',
              render: (r) => formatNumber(r.unique_visitors),
            },
          ]}
          rows={[...sorted].reverse()}
          rowKey={(r) => r.day}
        />
      </div>
    </div>
  );
}
