import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { API_BASE, apiRequest } from '../../utils/apiClient';

const PERIOD_OPTIONS = [
  { value: 1, label: '1 дн.' },
  { value: 7, label: '7 дн.' },
  { value: 30, label: '30 дн.' },
  { value: 90, label: '90 дн.' },
];

const TABS = [
  { id: 'pages', label: 'Страницы' },
  { id: 'sitemap', label: 'Sitemap' },
];

const PAGE_LABELS = {
  '/': 'Главная',
  '/catalog': 'Каталог',
  '/autoparts/new': 'Новые',
  '/autoparts/new/filters': 'Фильтры · новые',
  '/autoparts/used': 'Б/у',
  '/autoparts/used/filters': 'Фильтры · б/у',
  '/about': 'О компании',
  '/delivery': 'Доставка',
  '/payment': 'Оплата',
  '/cart': 'Корзина',
  '/order-reg': 'Заказ',
  '/auth': 'Вход',
  '/part/:productId': 'Карточки товаров',
};

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total}с`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m < 60) return s ? `${m}м ${s}с` : `${m}м`;
  const h = Math.floor(m / 60);
  return `${h}ч ${m % 60}м`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('ru-RU').format(Number(value) || 0);
}

function formatDay(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pageLabel(path) {
  return PAGE_LABELS[path] || path;
}

function formatSyncStats(sync) {
  if (!sync) return '';
  const parts = [
    sync.created != null && `создано ${sync.created}`,
    sync.updated_existing != null && `обновлено ${sync.updated_existing}`,
    sync.skipped != null && `пропущено ${sync.skipped}`,
    sync.not_found != null && `не найдено ${sync.not_found}`,
    sync.errors != null && sync.errors > 0 && `ошибок ${sync.errors}`,
  ].filter(Boolean);
  return parts.join(', ');
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

function Panel({ title, action, children, className = '' }) {
  return (
    <section
      className={`overflow-hidden rounded-lg border border-gray-200 bg-white ${className}`.trim()}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
          {title ? <h2 className="text-sm font-semibold text-gray-900">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Table({ columns, rows, empty = 'Нет данных', onRowClick, rowKey }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80 text-xs text-gray-500">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-2 font-medium ${col.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer hover:bg-indigo-50/60' : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2.5 text-gray-800 ${col.align === 'right' ? 'text-right tabular-nums' : ''}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function LoadingBlock() {
  return <p className="py-12 text-center text-sm text-gray-400">Загрузка…</p>;
}

const ACTIVITY_COLUMNS = [
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
];

export default function AnalyticsPage() {
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [days, setDays] = useState(7);
  const [viewMode, setViewMode] = useState('pages');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pages, setPages] = useState([]);
  const [activity, setActivity] = useState([]);
  const [selectedPath, setSelectedPath] = useState(null);
  const [pageDetail, setPageDetail] = useState(null);
  const [sitemapLoading, setSitemapLoading] = useState(false);
  const [sitemapRebuildBusy, setSitemapRebuildBusy] = useState(false);
  const [seoSyncBusy, setSeoSyncBusy] = useState(false);
  const [seoSyncNotice, setSeoSyncNotice] = useState(null);
  const [productUrlsDownloadBusy, setProductUrlsDownloadBusy] = useState(false);
  const [productUrlsNotice, setProductUrlsNotice] = useState(null);
  const [sitemapData, setSitemapData] = useState(null);

  const loadPagesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, pagesRes, activityRes] = await Promise.all([
        apiRequest(`/admin/analytics/summary?days=${days}`),
        apiRequest(`/admin/analytics/pages?days=${days}`),
        apiRequest(`/admin/analytics/activity?days=${days}`),
      ]);
      setSummary(summaryRes);
      const items = pagesRes?.items || [];
      setPages(items);
      setActivity(activityRes?.items || []);
      setSelectedPath((prev) => {
        if (prev && items.some((row) => row.path_template === prev)) return prev;
        return items[0]?.path_template ?? null;
      });
    } catch (e) {
      setError(e?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [days]);

  const loadPageDetail = useCallback(
    async (pathTemplate) => {
      setDetailLoading(true);
      try {
        const detail = await apiRequest(
          `/admin/analytics/page-detail?days=${days}&path_template=${encodeURIComponent(pathTemplate)}`
        );
        setPageDetail(detail);
      } catch (e) {
        setError(e?.message || 'Ошибка загрузки');
      } finally {
        setDetailLoading(false);
      }
    },
    [days]
  );

  const loadSitemaps = useCallback(async () => {
    setSitemapLoading(true);
    setError(null);
    try {
      setSitemapData(await apiRequest('/admin/seo/sitemaps'));
    } catch (e) {
      setError(e?.message || 'Ошибка загрузки');
    } finally {
      setSitemapLoading(false);
    }
  }, []);

  const rebuildProductsSitemap = async () => {
    setSitemapRebuildBusy(true);
    setError(null);
    try {
      await apiRequest('/admin/seo/sitemaps/rebuild?scope=new_parts', { method: 'POST' });
      await loadSitemaps();
    } catch (e) {
      setError(e?.message || 'Ошибка пересборки sitemap');
    } finally {
      setSitemapRebuildBusy(false);
    }
  };

  const syncSeoFromProducts = async () => {
    setSeoSyncBusy(true);
    setSeoSyncNotice(null);
    setError(null);
    try {
      const result = await apiRequest('/admin/seo/new-parts/sync-from-products?limit=100', {
        method: 'POST',
      });
      setSeoSyncNotice(formatSyncStats(result?.sync));
      await loadSitemaps();
    } catch (e) {
      setError(e?.message || 'Ошибка синхронизации SEO');
    } finally {
      setSeoSyncBusy(false);
    }
  };

  const downloadProductCardUrls = async () => {
    setProductUrlsDownloadBusy(true);
    setProductUrlsNotice(null);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/admin/seo/product-card-urls?limit=150`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Ошибка скачивания');
      }
      const blob = await response.blob();
      const match = (response.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/);
      const filename = match?.[1] || 'urls.txt';
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      setProductUrlsNotice(filename);
    } catch (e) {
      setError(e?.message || 'Ошибка скачивания');
    } finally {
      setProductUrlsDownloadBusy(false);
    }
  };

  useEffect(() => {
    if (!isReady || !user?.is_admin) return;
    if (viewMode === 'pages') loadPagesData();
    else loadSitemaps();
  }, [isReady, user?.is_admin, viewMode, loadPagesData, loadSitemaps]);

  useEffect(() => {
    if (!isReady || !user?.is_admin || viewMode !== 'pages' || !selectedPath) return;
    loadPageDetail(selectedPath);
  }, [isReady, user?.is_admin, viewMode, selectedPath, days, loadPageDetail]);

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (!user.is_admin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-4 max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Аналитика</h1>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  viewMode === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {viewMode === 'pages' && (
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700"
              aria-label="Период"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {viewMode === 'pages' && (
        <>
          {loading ? (
            <LoadingBlock />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Stat label="Просмотры" value={formatNumber(summary?.page_views)} />
                <Stat label="Посетители" value={formatNumber(summary?.unique_visitors)} />
                <Stat
                  label="Время / сессия"
                  value={formatDuration(summary?.avg_session_duration_sec)}
                />
              </div>

              <Panel title={`По дням · ${days} дн.`}>
                <Table columns={ACTIVITY_COLUMNS} rows={activity} rowKey={(r) => r.day} />
              </Panel>

              <div className="grid gap-4 lg:grid-cols-5">
                <Panel title="Страницы" className="lg:col-span-2">
                  <div className="max-h-[28rem] overflow-y-auto">
                    <Table
                      columns={[
                        {
                          key: 'name',
                          label: 'Страница',
                          render: (r) => (
                            <span
                              className={
                                selectedPath === r.path_template
                                  ? 'font-semibold text-indigo-700'
                                  : 'font-medium'
                              }
                              title={r.path_template}
                            >
                              {pageLabel(r.path_template)}
                            </span>
                          ),
                        },
                        {
                          key: 'v',
                          label: 'Просм.',
                          align: 'right',
                          render: (r) => formatNumber(r.views),
                        },
                        {
                          key: 'u',
                          label: 'Посет.',
                          align: 'right',
                          render: (r) => formatNumber(r.unique_visitors),
                        },
                      ]}
                      rows={pages}
                      onRowClick={(r) => setSelectedPath(r.path_template)}
                      rowKey={(r) => r.path_template}
                    />
                  </div>
                </Panel>

                <Panel
                  title={selectedPath ? pageLabel(selectedPath) : '—'}
                  className="lg:col-span-3"
                >
                  {!selectedPath ? (
                    <p className="py-16 text-center text-sm text-gray-400">Нет данных</p>
                  ) : detailLoading ? (
                    <LoadingBlock />
                  ) : pageDetail ? (
                    <div className="space-y-4 p-4">
                      <div className="grid grid-cols-3 gap-2">
                        <Stat label="Просмотры" value={formatNumber(pageDetail.page_views)} />
                        <Stat label="Посетители" value={formatNumber(pageDetail.unique_visitors)} />
                        <Stat label="Время" value={formatDuration(pageDetail.avg_duration_sec)} />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium text-gray-500">
                          По дням · {days} дн.
                        </p>
                        <Table
                          columns={ACTIVITY_COLUMNS}
                          rows={pageDetail.activity || []}
                          rowKey={(r) => r.day}
                        />
                      </div>
                      {pageDetail.instances?.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-medium text-gray-500">URL</p>
                          <Table
                            columns={[
                              {
                                key: 'url',
                                label: 'Путь',
                                render: (r) => (
                                  <span className="font-mono text-xs text-gray-600">
                                    {r.path_raw}
                                  </span>
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
                            rows={pageDetail.instances}
                            rowKey={(r) => r.path_raw}
                          />
                        </div>
                      )}
                    </div>
                  ) : null}
                </Panel>
              </div>
            </>
          )}
        </>
      )}

      {viewMode === 'sitemap' && (
        <Panel
          title="Sitemap"
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={syncSeoFromProducts}
                disabled={seoSyncBusy || sitemapLoading}
                className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              >
                {seoSyncBusy ? '…' : 'Синхр. SEO из каталога'}
              </button>
              <button
                type="button"
                onClick={rebuildProductsSitemap}
                disabled={sitemapRebuildBusy || sitemapLoading}
                className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {sitemapRebuildBusy ? '…' : 'Пересобрать sitemap'}
              </button>
              <button
                type="button"
                onClick={downloadProductCardUrls}
                disabled={productUrlsDownloadBusy || sitemapLoading}
                className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {productUrlsDownloadBusy ? '…' : '150 URL для SEO'}
              </button>
              <button
                type="button"
                onClick={loadSitemaps}
                disabled={sitemapLoading}
                className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Обновить
              </button>
            </div>
          }
        >
          {(seoSyncNotice || productUrlsNotice) && (
            <div className="border-b border-gray-100 bg-green-50/60 px-4 py-2 text-xs text-green-800">
              {seoSyncNotice && <p>Синхронизация: {seoSyncNotice}</p>}
              {productUrlsNotice && <p>Скачан файл: {productUrlsNotice}</p>}
            </div>
          )}
          {(sitemapData?.products_cache || sitemapData?.new_parts_cache) && (
            <div className="border-b border-gray-100 bg-indigo-50/40 px-4 py-3 text-sm text-gray-700 space-y-2">
              {sitemapData?.products_cache && (
                <p>
                  <span className="font-medium">Кэш sitemap товаров:</span>{' '}
                  {formatNumber(sitemapData.products_cache.url_count)} URL, пересборка{' '}
                  {formatDateTime(sitemapData.products_cache.generated_at)}
                  {sitemapData.products_cache.is_stale ? (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      устарел (&gt;24 ч)
                    </span>
                  ) : (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      актуален
                    </span>
                  )}
                </p>
              )}
              {sitemapData?.new_parts_cache && (
                <p>
                  <span className="font-medium">Кэш sitemap новых запчастей:</span>{' '}
                  {formatNumber(sitemapData.new_parts_cache.url_count)} URL, пересборка{' '}
                  {formatDateTime(sitemapData.new_parts_cache.generated_at)}
                  {sitemapData.new_parts_cache.is_stale ? (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      устарел (&gt;24 ч)
                    </span>
                  ) : (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      актуален
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
          {sitemapLoading ? (
            <LoadingBlock />
          ) : (
            <div className="divide-y divide-gray-100">
              {(sitemapData?.items || []).map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-600">
                        {item.type}
                      </span>
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                        {item.location}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{item.description}</p>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block break-all font-mono text-xs text-indigo-600 hover:underline"
                    >
                      {item.url}
                    </a>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-500">URL в файле</p>
                    <p className="text-lg font-semibold tabular-nums text-gray-900">
                      {formatNumber(item.url_count)}
                    </p>
                  </div>
                </div>
              ))}
              {!sitemapData?.items?.length && (
                <p className="px-4 py-10 text-center text-sm text-gray-400">Нет данных о sitemap</p>
              )}
            </div>
          )}
          {sitemapData?.site_origin && (
            <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-3 text-xs text-gray-500">
              Базовый домен:{' '}
              <span className="font-mono text-gray-700">{sitemapData.site_origin}</span>. Индекс:{' '}
              <a
                href={`${sitemapData.site_origin}/sitemap.xml`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                /sitemap.xml
              </a>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
