import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE, apiRequest } from '../../../utils/apiClient';
import { formatDateTime, formatNumber, formatSyncStats } from './analyticsFormatters';
import { LoadingState, Section } from './AnalyticsUi';

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
  const newPartsUrl = origin ? `${origin}/api/feeds/sitemap-new-parts.xml` : '#';
  const indexUrl = origin ? `${origin}/sitemap.xml` : '#';

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
              Sitemap новых запчастей
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-gray-900">
              {formatNumber(newParts?.url_count ?? 0)}
            </p>
            <p className="mt-1 text-sm text-gray-500">URL в индексе</p>
          </div>
          {newParts && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                newParts.is_stale
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {newParts.is_stale ? 'Устарел (>24 ч)' : 'Актуален'}
            </span>
          )}
        </div>

        {newParts?.generated_at && (
          <p className="mt-3 text-sm text-gray-600">
            Обновлено: <span className="font-medium">{formatDateTime(newParts.generated_at)}</span>
          </p>
        )}

        {products?.url_count != null && (
          <p className="mt-2 text-xs text-gray-400">
            Товарный sitemap: {formatNumber(products.url_count)} URL
          </p>
        )}

        <p className="mt-3 text-xs text-gray-400">
          Авто: до 100 новых URL/сутки из каталога, cron 03:00 UTC
        </p>
      </div>

      <Section title="Ссылки">
        <div className="flex flex-col gap-2 px-4 py-3 text-sm">
          <a
            href={indexUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-indigo-600 hover:underline"
          >
            {indexUrl}
          </a>
          <a
            href={newPartsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-indigo-600 hover:underline"
          >
            {newPartsUrl}
          </a>
        </div>
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
            {downloadBusy ? 'Скачивание…' : 'Скачать 150 URL для SEO'}
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
