import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE, apiRequest } from '../../../utils/apiClient';
import { formatDateTime, formatNumber, formatSyncStats } from './analyticsFormatters';
import { DataTable, LoadingState, Section } from './AnalyticsUi';

const SITEMAP_TYPE_LABELS = {
  index: 'Индекс',
  static: 'Статический',
  dynamic: 'Динамический',
};

function cacheForItem(item, productsCache, newPartsCache) {
  if (item?.id === 'products') return productsCache;
  if (item?.id === 'new-parts') return newPartsCache;
  return null;
}

export default function SeoTab() {
  const [loading, setLoading] = useState(true);
  const [rebuildBusy, setRebuildBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [error, setError] = useState(null);
  const [syncChips, setSyncChips] = useState(null);
  const [downloadNotice, setDownloadNotice] = useState(null);
  const [sitemapData, setSitemapData] = useState(null);

  const loadSitemaps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSitemapData(await apiRequest('/admin/seo/sitemaps'));
    } catch (e) {
      setError(e?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSitemaps();
  }, [loadSitemaps]);

  const rebuildSitemap = async () => {
    setRebuildBusy(true);
    setError(null);
    try {
      await apiRequest('/admin/seo/sitemaps/rebuild?scope=new_parts', { method: 'POST' });
      await loadSitemaps();
    } catch (e) {
      setError(e?.message || 'Ошибка пересборки sitemap');
    } finally {
      setRebuildBusy(false);
    }
  };

  const syncFromCatalog = async () => {
    setSyncBusy(true);
    setSyncChips(null);
    setError(null);
    try {
      const result = await apiRequest('/admin/seo/new-parts/sync-from-products?limit=100', {
        method: 'POST',
      });
      setSyncChips(formatSyncStats(result?.sync));
      await loadSitemaps();
    } catch (e) {
      setError(e?.message || 'Ошибка синхронизации');
    } finally {
      setSyncBusy(false);
    }
  };

  const downloadUrls = async () => {
    setDownloadBusy(true);
    setDownloadNotice(null);
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
      setDownloadNotice(filename);
    } catch (e) {
      setError(e?.message || 'Ошибка скачивания');
    } finally {
      setDownloadBusy(false);
    }
  };

  const origin = sitemapData?.site_origin || '';
  const newParts = sitemapData?.new_parts_cache;
  const products = sitemapData?.products_cache;

  const sitemapItems = useMemo(() => {
    const items = Array.isArray(sitemapData?.items) ? sitemapData.items : [];
    return items.filter((item) => item?.type !== 'admin');
  }, [sitemapData?.items]);

  const sitemapRows = useMemo(
    () =>
      sitemapItems.map((item) => ({
        ...item,
        cache: cacheForItem(item, products, newParts),
      })),
    [sitemapItems, products, newParts],
  );

  const totalUrls = useMemo(
    () => sitemapRows.reduce((sum, row) => sum + Number(row.url_count || 0), 0),
    [sitemapRows],
  );

  if (loading && !sitemapData) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Sitemap сайта
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-gray-900">
              {formatNumber(sitemapRows.length)}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              файлов · {formatNumber(totalUrls)} URL суммарно
            </p>
          </div>
          {newParts && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                newParts.is_stale
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {newParts.is_stale ? 'Rossko: устарел (>24 ч)' : 'Rossko: актуален'}
            </span>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-400">
          Авто: до 100 новых URL/сутки из каталога, cron 03:00 UTC
          {origin ? ` · ${origin}` : ''}
        </p>
      </div>

      <Section
        title="Все sitemap"
        subtitle="Индекс, статические страницы и динамические фиды каталога"
      >
        <DataTable
          columns={[
            {
              key: 'title',
              label: 'Файл',
              render: (row) => (
                <div>
                  <p className="font-medium text-gray-900">{row.title}</p>
                  {row.description ? (
                    <p className="mt-0.5 text-xs text-gray-500">{row.description}</p>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'url',
              label: 'URL',
              render: (row) => (
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-xs text-indigo-600 hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {row.url}
                </a>
              ),
            },
            {
              key: 'type',
              label: 'Тип',
              render: (row) => (
                <span className="text-xs text-gray-600">
                  {SITEMAP_TYPE_LABELS[row.type] || row.type || '—'}
                </span>
              ),
            },
            {
              key: 'url_count',
              label: 'URL',
              align: 'right',
              render: (row) => formatNumber(row.url_count ?? 0),
            },
            {
              key: 'generated_at',
              label: 'Обновлён',
              render: (row) =>
                row.cache?.generated_at ? (
                  <span className="text-xs text-gray-600">
                    {formatDateTime(row.cache.generated_at)}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                ),
            },
            {
              key: 'status',
              label: 'Кэш',
              render: (row) => {
                if (!row.cache) {
                  return <span className="text-xs text-gray-400">—</span>;
                }
                return (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.cache.is_stale
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {row.cache.is_stale ? 'Устарел' : 'Актуален'}
                  </span>
                );
              },
            },
          ]}
          rows={sitemapRows}
          rowKey={(row) => row.id || row.url}
          empty="Sitemap не найдены"
        />
      </Section>

      <Section title="Действия">
        <div className="space-y-3 px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={syncFromCatalog}
              disabled={syncBusy || loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {syncBusy ? 'Синхронизация…' : 'Синхронизировать из каталога'}
            </button>
            <button
              type="button"
              onClick={rebuildSitemap}
              disabled={rebuildBusy || loading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {rebuildBusy ? 'Пересборка…' : 'Пересобрать sitemap'}
            </button>
          </div>

          <button
            type="button"
            onClick={downloadUrls}
            disabled={downloadBusy}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            {downloadBusy ? 'Скачивание…' : 'Скачать 150 URL (75 б/у + 75 Rossko)'}
          </button>

          {(syncChips?.length > 0 || downloadNotice) && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {syncChips?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {syncChips.map((chip) => (
                    <span
                      key={chip.key}
                      className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-green-800"
                    >
                      {chip.label}: {chip.value}
                    </span>
                  ))}
                </div>
              )}
              {downloadNotice && (
                <p className={syncChips?.length ? 'mt-2 text-xs' : ''}>Файл: {downloadNotice}</p>
              )}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
