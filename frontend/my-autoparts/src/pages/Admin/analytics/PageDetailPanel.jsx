import React, { useState } from 'react';
import {
  formatDuration,
  formatNumber,
  pageLabel,
} from './analyticsFormatters';
import ActivityTrend from './ActivityTrend';
import { DataTable, LoadingState, StatCard } from './AnalyticsUi';

const INSTANCE_PREVIEW = 10;

export default function PageDetailPanel({
  selectedPath,
  pageDetail,
  detailLoading,
  days,
  onClearSelection,
}) {
  const [showAllUrls, setShowAllUrls] = useState(false);

  if (!selectedPath) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-gray-400">Выберите страницу из списка</p>
      </div>
    );
  }

  if (detailLoading) {
    return <LoadingState label="Загрузка деталей…" />;
  }

  if (!pageDetail) {
    return null;
  }

  const instances = pageDetail.instances || [];
  const visibleInstances = showAllUrls ? instances : instances.slice(0, INSTANCE_PREVIEW);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">{pageLabel(selectedPath)}</h3>
          <p className="mt-0.5 truncate font-mono text-xs text-gray-500">{selectedPath}</p>
        </div>
        {onClearSelection && (
          <button
            type="button"
            onClick={onClearSelection}
            className="shrink-0 text-xs text-gray-500 hover:text-gray-700 lg:hidden"
          >
            ← Назад
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <StatCard label="Просмотры" value={formatNumber(pageDetail.page_views)} accent="indigo" />
        <StatCard label="Посетители" value={formatNumber(pageDetail.unique_visitors)} accent="emerald" />
        <StatCard label="Ср. время" value={formatDuration(pageDetail.avg_duration_sec)} accent="amber" />
      </div>

      <div className="rounded-lg border border-gray-100 bg-gray-50/50">
        <ActivityTrend
          activity={pageDetail.activity || []}
          compact
          title={`По дням · ${days} дн.`}
        />
      </div>

      {instances.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-500">
              Топ URL ({formatNumber(instances.length)})
            </p>
            {instances.length > INSTANCE_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAllUrls((v) => !v)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                {showAllUrls ? 'Свернуть' : `Показать все (${instances.length})`}
              </button>
            )}
          </div>
          <DataTable
            columns={[
              {
                key: 'url',
                label: 'Путь',
                render: (r) => (
                  <span className="font-mono text-xs text-gray-600">{r.path_raw}</span>
                ),
              },
              {
                key: 'v',
                label: 'Просм.',
                align: 'right',
                render: (r) => formatNumber(r.views),
              },
              {
                key: 't',
                label: 'Время',
                align: 'right',
                render: (r) => formatDuration(r.avg_duration_sec),
              },
            ]}
            rows={visibleInstances}
            rowKey={(r) => r.path_raw}
          />
        </div>
      )}
    </div>
  );
}
