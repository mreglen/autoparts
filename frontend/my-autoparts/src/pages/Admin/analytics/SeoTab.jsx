import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE, apiRequest } from '../../../utils/apiClient';
import { formatNumber, formatSyncStats } from './analyticsFormatters';
import { LoadingState } from './AnalyticsUi';
import CardsCreatedTrend from './CardsCreatedTrend';
import LandingPagesSection from './LandingPagesSection';

const SOURCE_LABELS = {
  tecdoc: 'TecDoc',
  product: 'Каталог б/у',
  order: 'Заказы',
  semantic: 'Семантика',
  landing: 'Посадочные',
  card_cross: 'Кроссы',
  cross: 'Кроссы Rossko',
  sibling: 'Аналоги',
};

function ActionButton({ children, onClick, disabled, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? 'rounded border border-gray-900 bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-40'
          : 'rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-40'
      }
    >
      {children}
    </button>
  );
}

export default function SeoTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seoStats, setSeoStats] = useState(null);
  const [sitemapData, setSitemapData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sitemaps, stats] = await Promise.all([
        apiRequest('/admin/seo/sitemaps'),
        apiRequest('/admin/seo/new-parts/stats'),
      ]);
      setSitemapData(sitemaps);
      setSeoStats(stats);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key, fn) => {
    setBusy(key);
    setError(null);
    setLastResult(null);
    try {
      const result = await fn();
      setLastResult({ key, result });
      await load();
    } catch (e) {
      setError(e?.message || 'Ошибка операции');
    } finally {
      setBusy(null);
    }
  };

  const dailyLimit = seoStats?.settings?.daily_limit || 1000;
  const createdToday = seoStats?.cards_created_today ?? 0;
  const remaining = Math.max(0, dailyLimit - createdToday);
  const quota = seoStats?.quota;
  const seedReady = quota?.seed_ready ?? 0;
  const seedLow = seedReady < (quota?.deficit ?? remaining);
  const createdBySource = quota?.cards_created_today_by_source ?? {};
  const sourceLine = useMemo(
    () =>
      Object.entries(createdBySource)
        .filter(([, n]) => Number(n) > 0)
        .map(([k, n]) => `${SOURCE_LABELS[k] || k}: ${n}`)
        .join(', '),
    [createdBySource],
  );

  const totalUrls = sitemapData?.total_pages ?? 0;
  const sitemapStale = sitemapData?.new_parts_cache?.is_stale;

  if (loading && !seoStats) {
    return <LoadingState label="Загрузка SEO…" />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Сводка */}
      <div className="rounded border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">Новые запчасти (Rossko)</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-gray-500">Карточек всего</dt>
            <dd className="text-2xl font-semibold tabular-nums">{formatNumber(seoStats?.cards_total ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Создано сегодня</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {formatNumber(createdToday)}
              <span className="text-base font-normal text-gray-500"> / {formatNumber(dailyLimit)}</span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Страниц в sitemap</dt>
            <dd className="text-2xl font-semibold tabular-nums">{formatNumber(totalUrls)}</dd>
          </div>
        </dl>

        <div className="mt-4">
          <div className="h-2 rounded bg-gray-100">
            <div
              className="h-2 rounded bg-gray-800 transition-all"
              style={{
                width: `${dailyLimit > 0 ? Math.min(100, Math.round((createdToday / dailyLimit) * 100)) : 0}%`,
              }}
            />
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Осталось сегодня: {formatNumber(remaining)}. Автоматически ~{formatNumber(seoStats?.settings?.batch_size || 0)} карточек каждые {seoStats?.settings?.batch_interval_minutes || 30} мин.
          </p>
          {sourceLine ? (
            <p className="mt-1 text-sm text-gray-500">Источники сегодня: {sourceLine}</p>
          ) : null}
        </div>

        {seedLow ? (
          <p className="mt-3 text-sm text-amber-800">
            В очереди мало проверенных позиций ({formatNumber(seedReady)}). Сначала наполните очередь и запустите проверку Rossko.
          </p>
        ) : null}
        {sitemapStale ? (
          <p className="mt-2 text-sm text-amber-800">Кэш sitemap устарел — пересоберите вручную или дождитесь ночной пересборки.</p>
        ) : null}
      </div>

      {/* Действия */}
      <div className="rounded border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">Ручной запуск</h2>
        <p className="mt-1 text-sm text-gray-600">
          Обычно всё идёт по расписанию. Эти кнопки — если нужно ускорить.
        </p>

        <ol className="mt-4 space-y-3 text-sm text-gray-700">
          <li className="flex flex-wrap items-center gap-2">
            <span className="w-6 shrink-0 font-medium text-gray-400">1</span>
            <span className="min-w-[12rem]">Собрать кандидатов в очередь</span>
            <ActionButton
              disabled={Boolean(busy)}
              onClick={() => run('populate', () => apiRequest('/admin/seo/seed-queue/populate', { method: 'POST' }))}
            >
              {busy === 'populate' ? '…' : 'Наполнить'}
            </ActionButton>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span className="w-6 shrink-0 font-medium text-gray-400">2</span>
            <span className="min-w-[12rem]">Проверить наличие в Rossko</span>
            <ActionButton
              disabled={Boolean(busy)}
              onClick={() => run('precheck', () => apiRequest('/admin/seo/seed-queue/precheck', { method: 'POST' }))}
            >
              {busy === 'precheck' ? '…' : 'Проверить'}
            </ActionButton>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span className="w-6 shrink-0 font-medium text-gray-400">3</span>
            <span className="min-w-[12rem]">Создать карточки на сайте</span>
            <ActionButton
              primary
              disabled={Boolean(busy)}
              onClick={() =>
                run('sync', () =>
                  apiRequest(`/admin/seo/new-parts/sync-from-products?limit=${dailyLimit}`, { method: 'POST' }),
                )
              }
            >
              {busy === 'sync' ? '…' : 'Создать карточки'}
            </ActionButton>
          </li>
        </ol>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <ActionButton
            disabled={Boolean(busy)}
            onClick={() => run('refresh', () => apiRequest('/admin/seo/new-parts/refresh', { method: 'POST' }))}
          >
            {busy === 'refresh' ? '…' : 'Обновить цены'}
          </ActionButton>
          <ActionButton
            disabled={Boolean(busy)}
            onClick={() =>
              run('sitemap', () => apiRequest('/admin/seo/sitemaps/rebuild?scope=new_parts', { method: 'POST' }))
            }
          >
            {busy === 'sitemap' ? '…' : 'Пересобрать sitemap'}
          </ActionButton>
          <ActionButton
            disabled={Boolean(busy)}
            onClick={() =>
              run('download', async () => {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_BASE}/admin/seo/product-card-urls`, {
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
                return { filename };
              })
            }
          >
            {busy === 'download' ? '…' : 'Скачать URL'}
          </ActionButton>
        </div>

        {lastResult ? (
          <p className="mt-3 text-sm text-gray-600">
            {(() => {
              const { key, result } = lastResult;
              if (key === 'sync' && result?.sync) {
                return formatSyncStats(result.sync)
                  .map((c) => `${c.label}: ${c.value}`)
                  .join(', ');
              }
              if (key === 'populate' && result) {
                return `Добавлено в очередь: ${formatNumber(result.total ?? 0)}`;
              }
              if (key === 'precheck' && result) {
                return `Проверено: ${result.checked ?? 0}, в наличии: ${result.ready ?? 0}, нет: ${result.not_found ?? 0}`;
              }
              if (key === 'refresh' && result?.refresh) {
                return `Обновлено: ${result.refresh.updated ?? 0}`;
              }
              if (key === 'sitemap') return 'Sitemap пересобран';
              if (key === 'download' && result?.filename) return `Скачан файл ${result.filename}`;
              return null;
            })()}
          </p>
        ) : null}
      </div>

      {seoStats?.created_by_day?.length > 0 ? (
        <div className="rounded border border-gray-200 bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">Прирост по дням</h2>
          <div className="mt-3">
            <CardsCreatedTrend activity={seoStats.created_by_day} />
          </div>
        </div>
      ) : null}

      <LandingPagesSection />
    </div>
  );
}
