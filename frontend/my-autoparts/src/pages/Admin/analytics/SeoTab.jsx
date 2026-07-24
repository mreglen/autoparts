import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, apiRequest } from '../../../utils/apiClient';
import { formatNumber } from './analyticsFormatters';
import { LoadingState } from './AnalyticsUi';
import CardsCreatedTrend from './CardsCreatedTrend';
import LandingPagesSection from './LandingPagesSection';
import { SOURCE_LABELS, sourceLabel } from './seoSourceLabels';

function aggregateSeedQueue(quota) {
  const bySource = quota?.seed_conversion_by_source ?? {};
  const totals = { pending: 0, ready: 0, not_found: 0, created: 0 };
  for (const counts of Object.values(bySource)) {
    totals.pending += Number(counts.pending ?? 0);
    totals.ready += Number(counts.ready ?? 0);
    totals.not_found += Number(counts.not_found ?? 0);
    totals.created += Number(counts.created ?? 0);
  }
  if (!Object.keys(bySource).length && quota) {
    totals.pending = Number(quota.seed_pending ?? 0);
    totals.ready = Number(quota.seed_ready ?? 0);
  }
  totals.total = totals.pending + totals.ready + totals.not_found + totals.created;
  return { totals, bySource };
}

function SeedQueuePanel({ quota }) {
  const { totals, bySource } = aggregateSeedQueue(quota);
  const rows = Object.entries(bySource).sort(([, a], [, b]) => {
    const score = (c) => Number(c.pending ?? 0) + Number(c.ready ?? 0);
    return score(b) - score(a);
  });

  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Очередь проверки Rossko</h2>
          <p className="mt-1 text-sm text-gray-600">
            Кандидаты перед созданием карточек. Пополнение и проверка идут по расписанию.
          </p>
        </div>
        <Link
          to="/admin/analytics/seo/queue"
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
        >
          Смотреть очередь
        </Link>
      </div>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <dt className="text-sm text-gray-500">Ожидают проверки</dt>
          <dd className="text-xl font-semibold tabular-nums text-amber-800">{formatNumber(totals.pending)}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">В наличии (готовы)</dt>
          <dd className="text-xl font-semibold tabular-nums text-green-800">{formatNumber(totals.ready)}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Не найдено</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatNumber(totals.not_found)}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Уже созданы</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatNumber(totals.created)}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Всего в очереди</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatNumber(totals.total)}</dd>
        </div>
      </dl>

      {quota?.precheck_limit ? (
        <p className="mt-2 text-sm text-gray-500">
          Проверок Rossko сегодня: {formatNumber(quota.precheck_used ?? 0)} / {formatNumber(quota.precheck_limit)}
        </p>
      ) : null}

      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Источник</th>
                <th className="py-2 pr-4 font-medium">Ожидают</th>
                <th className="py-2 pr-4 font-medium">Готовы</th>
                <th className="py-2 pr-4 font-medium">Нет в Rossko</th>
                <th className="py-2 font-medium">Созданы</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([source, counts]) => (
                <tr key={source} className="border-b border-gray-100">
                  <td className="py-2 pr-4">
                    <Link
                      to={`/admin/analytics/seo/queue/${encodeURIComponent(source)}`}
                      className="text-gray-900 hover:underline"
                    >
                      {sourceLabel(source)}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{formatNumber(counts.pending ?? 0)}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatNumber(counts.ready ?? 0)}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatNumber(counts.not_found ?? 0)}</td>
                  <td className="py-2 tabular-nums">{formatNumber(counts.created ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-500">Очередь пуста.</p>
      )}
    </div>
  );
}

function ActionButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

const SETTINGS_FIELDS = [
  {
    key: 'daily_limit',
    label: 'Дневной лимит карточек',
    hint: 'Сколько новых карточек создавать за сутки',
    step: 1,
  },
  {
    key: 'batch_interval_minutes',
    label: 'Интервал создания (мин)',
    hint: 'Как часто запускать батч',
    step: 1,
  },
  {
    key: 'batch_size',
    label: 'Размер батча',
    hint: '0 = авто (лимит ÷ число тиков в сутки)',
    step: 1,
  },
  {
    key: 'rossko_delay_sec',
    label: 'Задержка Rossko (сек)',
    hint: 'Пауза между запросами к поставщику',
    step: 0.1,
  },
  {
    key: 'seed_precheck_daily',
    label: 'Лимит precheck / сутки',
    hint: 'Проверок наличия в очереди за день',
    step: 1,
  },
  {
    key: 'seed_precheck_interval_minutes',
    label: 'Интервал precheck (мин)',
    hint: 'Как часто проверять очередь',
    step: 1,
  },
];

function SeoSyncRatePanel({ onSaved }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(SETTINGS_FIELDS.map((f) => [f.key, ''])),
  );
  const [sources, setSources] = useState({});
  const [defaults, setDefaults] = useState({});
  const [resolvedBatch, setResolvedBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/admin/seo/new-parts/settings');
      const effective = data?.effective || {};
      setForm(
        Object.fromEntries(
          SETTINGS_FIELDS.map((f) => [f.key, effective[f.key] ?? '']),
        ),
      );
      setSources(data?.sources || {});
      setDefaults(data?.defaults || {});
      setResolvedBatch(effective.resolved_batch_size ?? null);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMessage('');
  };

  const buildPayload = () => {
    const payload = {};
    for (const field of SETTINGS_FIELDS) {
      const raw = String(form[field.key] ?? '').trim();
      if (raw === '') continue;
      payload[field.key] = field.key === 'rossko_delay_sec' ? Number(raw) : parseInt(raw, 10);
    }
    return payload;
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = buildPayload();
      if (!Object.keys(payload).length) {
        throw new Error('Заполните хотя бы одно поле');
      }
      const data = await apiRequest('/admin/seo/new-parts/settings', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const effective = data?.effective || {};
      setForm(
        Object.fromEntries(
          SETTINGS_FIELDS.map((f) => [f.key, effective[f.key] ?? '']),
        ),
      );
      setSources(data?.sources || {});
      setDefaults(data?.defaults || {});
      setResolvedBatch(effective.resolved_batch_size ?? null);
      setMessage('Сохранено. Изменения применяются сразу.');
      await onSaved?.();
    } catch (e) {
      setError(e?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const data = await apiRequest('/admin/seo/new-parts/settings/reset', {
        method: 'POST',
      });
      const effective = data?.effective || {};
      setForm(
        Object.fromEntries(
          SETTINGS_FIELDS.map((f) => [f.key, effective[f.key] ?? '']),
        ),
      );
      setSources(data?.sources || {});
      setDefaults(data?.defaults || {});
      setResolvedBatch(effective.resolved_batch_size ?? null);
      setMessage('Сброшено к значениям из .env');
      await onSaved?.();
    } catch (e) {
      setError(e?.message || 'Не удалось сбросить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Скорость создания карточек</h2>
          <p className="mt-1 text-sm text-gray-600">
            Лимит, частота и задержка Rossko. Можно менять в любой момент без перезапуска.
          </p>
        </div>
        {resolvedBatch != null ? (
          <p className="text-sm text-gray-500">
            Эффективный батч: <span className="font-medium tabular-nums text-gray-800">{resolvedBatch}</span>
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Загрузка настроек…</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SETTINGS_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="flex items-center justify-between gap-2 text-sm text-gray-700">
                  <span>{field.label}</span>
                  <span className="text-xs text-gray-400">
                    {sources[field.key] === 'db' ? 'вручную' : '.env'}
                  </span>
                </span>
                <input
                  type="number"
                  step={field.step}
                  value={form[field.key]}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm tabular-nums focus:border-gray-500 focus:outline-none"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  {field.hint}
                  {defaults[field.key] != null ? ` · .env: ${defaults[field.key]}` : ''}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
            >
              {saving ? '…' : 'Сохранить'}
            </button>
            <ActionButton onClick={reset} disabled={saving}>
              Сбросить к .env
            </ActionButton>
            <ActionButton onClick={loadSettings} disabled={saving}>
              Обновить
            </ActionButton>
          </div>
        </>
      )}

      {message ? <p className="mt-3 text-sm text-green-800">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export default function SeoTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seoStats, setSeoStats] = useState(null);
  const [sitemapData, setSitemapData] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadedFilename, setDownloadedFilename] = useState(null);
  const [downloadingQueries, setDownloadingQueries] = useState(false);
  const [downloadedQueriesFilename, setDownloadedQueriesFilename] = useState(null);

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
      return { sitemaps, stats };
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить данные');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const downloadTxtAttachment = async (path, fallbackName) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Ошибка скачивания');
    }
    const blob = await response.blob();
    const match = (response.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/);
    const filename = match?.[1] || fallbackName;
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
    return filename;
  };

  const downloadUrls = async () => {
    setDownloading(true);
    setError(null);
    setDownloadedFilename(null);
    try {
      const filename = await downloadTxtAttachment('/admin/seo/product-card-urls', 'urls.txt');
      setDownloadedFilename(filename);
    } catch (e) {
      setError(e?.message || 'Ошибка скачивания');
    } finally {
      setDownloading(false);
    }
  };

  const downloadQueries = async () => {
    setDownloadingQueries(true);
    setError(null);
    setDownloadedQueriesFilename(null);
    try {
      const filename = await downloadTxtAttachment(
        '/admin/seo/popular-queries-export?limit=200',
        'seo-queries.txt',
      );
      setDownloadedQueriesFilename(filename);
    } catch (e) {
      setError(e?.message || 'Ошибка скачивания запросов');
    } finally {
      setDownloadingQueries(false);
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
            Мало готовых позиций в очереди ({formatNumber(seedReady)}).
          </p>
        ) : null}
        {sitemapStale ? (
          <p className="mt-2 text-sm text-amber-800">Кэш sitemap устарел — дождитесь ночной пересборки.</p>
        ) : null}
      </div>

      <SeoSyncRatePanel onSaved={load} />

      <SeedQueuePanel quota={seoStats?.quota} />

      <div className="rounded border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">Выгрузка URL</h2>
        <p className="mt-1 text-sm text-gray-600">
          150 последних рабочих карточек б/у из каталога — по одному URL на строку.
        </p>
        <div className="mt-4">
          <ActionButton disabled={downloading} onClick={downloadUrls}>
            {downloading ? '…' : 'Скачать 150 URL'}
          </ActionButton>
        </div>
        {downloadedFilename ? (
          <p className="mt-3 text-sm text-gray-600">Скачан файл {downloadedFilename}</p>
        ) : null}
      </div>

      <div className="rounded border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">Выгрузка SEO-запросов</h2>
        <p className="mt-1 text-sm text-gray-600">
          ~200 запросов без спецсимволов: популярные поиски + вариации из топ-карточек
          (города РФ, чаще Екатеринбург) — по одному запросу на строку.
        </p>
        <div className="mt-4">
          <ActionButton disabled={downloadingQueries} onClick={downloadQueries}>
            {downloadingQueries ? '…' : 'Скачать 200 запросов'}
          </ActionButton>
        </div>
        {downloadedQueriesFilename ? (
          <p className="mt-3 text-sm text-gray-600">Скачан файл {downloadedQueriesFilename}</p>
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
