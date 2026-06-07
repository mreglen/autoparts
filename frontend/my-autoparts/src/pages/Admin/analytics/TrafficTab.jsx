import React, { useMemo, useState } from 'react';
import {
  formatDuration,
  formatNumber,
  pageLabel,
} from './analyticsFormatters';
import ActivityTrend from './ActivityTrend';
import PageDetailPanel from './PageDetailPanel';
import { LoadingState, PeriodPills, Section, StatCard } from './AnalyticsUi';

const SORT_OPTIONS = [
  { id: 'views', label: 'Просмотры' },
  { id: 'visitors', label: 'Посетители' },
  { id: 'time', label: 'Время' },
];

export default function TrafficTab({
  days,
  onDaysChange,
  loading,
  summary,
  pages,
  activity,
  selectedPath,
  onSelectPath,
  pageDetail,
  detailLoading,
}) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('views');
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  const filteredPages = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = [...pages];
    if (query) {
      rows = rows.filter((row) => {
        const label = pageLabel(row.path_template).toLowerCase();
        return label.includes(query) || row.path_template.toLowerCase().includes(query);
      });
    }
    rows.sort((a, b) => {
      if (sortBy === 'visitors') {
        return (b.unique_visitors || 0) - (a.unique_visitors || 0);
      }
      if (sortBy === 'time') {
        return (b.avg_duration_sec || 0) - (a.avg_duration_sec || 0);
      }
      return (b.views || 0) - (a.views || 0);
    });
    return rows;
  }, [pages, search, sortBy]);

  const handleSelect = (path) => {
    onSelectPath(path);
    setMobileShowDetail(true);
  };

  const handleClearSelection = () => {
    setMobileShowDetail(false);
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPills value={days} onChange={onDaysChange} />
        <p className="text-sm text-gray-500">за последние {days} дн.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Просмотры" value={formatNumber(summary?.page_views)} accent="indigo" />
        <StatCard label="Посетители" value={formatNumber(summary?.unique_visitors)} accent="emerald" />
        <StatCard
          label="Время / сессия"
          value={formatDuration(summary?.avg_session_duration_sec)}
          accent="amber"
        />
      </div>

      <Section title="Динамика по дням" subtitle={`${days} дн.`}>
        <ActivityTrend activity={activity} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,1fr)_2fr]">
        <Section
          title="Страницы"
          subtitle={`${filteredPages.length} из ${pages.length}`}
          className={mobileShowDetail ? 'hidden lg:block' : ''}
        >
          <div className="space-y-3 border-b border-gray-100 px-4 py-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию или path…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
            <div className="flex flex-wrap gap-1">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSortBy(option.id)}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    sortBy === option.id
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[32rem] overflow-y-auto divide-y divide-gray-50">
            {filteredPages.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">Ничего не найдено</p>
            ) : (
              filteredPages.map((row) => {
                const active = selectedPath === row.path_template;
                return (
                  <button
                    key={row.path_template}
                    type="button"
                    onClick={() => handleSelect(row.path_template)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                      active
                        ? 'border-l-4 border-indigo-600 bg-indigo-50/70'
                        : 'border-l-4 border-transparent hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${active ? 'font-semibold text-indigo-900' : 'font-medium text-gray-900'}`}>
                        {pageLabel(row.path_template)}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-gray-400">
                        {row.path_template}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs tabular-nums text-gray-600">
                      <p className="font-semibold text-gray-900">{formatNumber(row.views)}</p>
                      <p className="text-gray-400">{formatNumber(row.unique_visitors)} пос.</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Section>

        <Section
          title={selectedPath ? pageLabel(selectedPath) : 'Детали страницы'}
          className={!mobileShowDetail && selectedPath ? 'hidden lg:block' : ''}
        >
          <PageDetailPanel
            selectedPath={selectedPath}
            pageDetail={pageDetail}
            detailLoading={detailLoading}
            days={days}
            onClearSelection={handleClearSelection}
          />
        </Section>
      </div>
    </div>
  );
}
