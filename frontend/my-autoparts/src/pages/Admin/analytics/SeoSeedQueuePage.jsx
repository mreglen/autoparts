import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuthReady } from '../../../hooks/useAuthReady';
import AuthLoadingScreen from '../../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../../utils/apiClient';
import { formatNumber } from './analyticsFormatters';
import { ErrorBanner, LoadingState } from './AnalyticsUi';
import { STATUS_LABELS, STATUS_ORDER, sourceLabel, statusLabel } from './seoSourceLabels';

const ANALYTICS_SEO_URL = '/admin/analytics?tab=seo';

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function QueueTotals({ totals }) {
  if (!totals) return null;
  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {STATUS_ORDER.map((status) => (
        <div key={status}>
          <dt className="text-sm text-gray-500">{STATUS_LABELS[status]}</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatNumber(totals[status] ?? 0)}</dd>
        </div>
      ))}
      <div>
        <dt className="text-sm text-gray-500">Всего</dt>
        <dd className="text-xl font-semibold tabular-nums">{formatNumber(totals.total ?? 0)}</dd>
      </div>
    </dl>
  );
}

function SourceOverview({ overview, loading }) {
  const sources = overview?.sources ?? [];
  if (loading && !sources.length) {
    return <LoadingState label="Загрузка очереди…" />;
  }
  if (!sources.length) {
    return <p className="mt-4 text-sm text-gray-500">Очередь пуста — пополнение идёт автоматически по расписанию.</p>;
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sources.map((row) => (
        <Link
          key={row.source}
          to={`/admin/analytics/seo/queue/${encodeURIComponent(row.source)}`}
          className="rounded-lg border border-gray-200 bg-white p-4 transition hover:border-gray-400 hover:shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900">{sourceLabel(row.source)}</h3>
            <span className="text-sm tabular-nums text-gray-500">{formatNumber(row.total ?? 0)}</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-gray-600">
            <div className="flex justify-between gap-2">
              <dt>Ожидают</dt>
              <dd className="tabular-nums text-amber-800">{formatNumber(row.pending ?? 0)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Готовы</dt>
              <dd className="tabular-nums text-green-800">{formatNumber(row.ready ?? 0)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Нет в Rossko</dt>
              <dd className="tabular-nums">{formatNumber(row.not_found ?? 0)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Созданы</dt>
              <dd className="tabular-nums">{formatNumber(row.created ?? 0)}</dd>
            </div>
          </dl>
        </Link>
      ))}
    </div>
  );
}

function SourceItemsTable({ items, loading }) {
  if (loading && !items?.length) {
    return <LoadingState label="Загрузка позиций…" />;
  }
  if (!items?.length) {
    return <p className="mt-4 text-sm text-gray-500">Нет позиций с выбранным фильтром.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto rounded border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-3 py-2 font-medium">Бренд</th>
            <th className="px-3 py-2 font-medium">Артикул</th>
            <th className="px-3 py-2 font-medium">Статус</th>
            <th className="px-3 py-2 font-medium">Приоритет</th>
            <th className="px-3 py-2 font-medium">Проверка Rossko</th>
            <th className="px-3 py-2 font-medium">Добавлено</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.lookup_key} className="border-t border-gray-100">
              <td className="px-3 py-2 font-medium text-gray-900">{row.brand}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-800">{row.article}</td>
              <td className="px-3 py-2">{statusLabel(row.status)}</td>
              <td className="px-3 py-2 tabular-nums">{row.priority ?? 0}</td>
              <td className="px-3 py-2 text-gray-600">
                {row.rossko_checked_at ? formatDateTime(row.rossko_checked_at) : '—'}
                {row.has_rossko_payload ? (
                  <span className="ml-1 text-xs text-green-700">кэш</span>
                ) : null}
              </td>
              <td className="px-3 py-2 text-gray-600">{formatDateTime(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceDetail({ source }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        source,
        page: String(page),
        page_size: '50',
      });
      if (status) params.set('status', status);
      const result = await apiRequest(`/admin/seo/seed-queue/items?${params.toString()}`);
      setData(result);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить позиции');
    } finally {
      setLoading(false);
    }
  }, [source, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const statusCounts = data?.status_counts ?? {};
  const totalPages = data?.page_size ? Math.max(1, Math.ceil((data.total ?? 0) / data.page_size)) : 1;

  const setStatus = (nextStatus) => {
    const next = new URLSearchParams(searchParams);
    if (nextStatus) next.set('status', nextStatus);
    else next.delete('status');
    next.delete('page');
    setSearchParams(next);
  };

  const setPage = (nextPage) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  };

  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{sourceLabel(source)}</h2>
          <p className="mt-1 text-sm text-gray-500">
            Позиции очереди перед созданием SEO-карточек
          </p>
        </div>
        <p className="text-sm tabular-nums text-gray-600">
          Показано: {formatNumber(data?.items?.length ?? 0)} из {formatNumber(data?.total ?? 0)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatus('')}
          className={`rounded-full px-3 py-1 text-sm ${
            !status
              ? 'bg-gray-900 text-white'
              : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Все ({formatNumber(Object.values(statusCounts).reduce((a, b) => a + Number(b || 0), 0))})
        </button>
        {STATUS_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            className={`rounded-full px-3 py-1 text-sm ${
              status === key
                ? 'bg-gray-900 text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {STATUS_LABELS[key]} ({formatNumber(statusCounts[key] ?? 0)})
          </button>
        ))}
      </div>

      <SourceItemsTable items={data?.items} loading={loading} />

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage(page - 1)}
            className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-40"
          >
            Назад
          </button>
          <span className="tabular-nums text-gray-600">
            Страница {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage(page + 1)}
            className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-40"
          >
            Вперёд
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function SeoSeedQueuePage() {
  const { source } = useParams();
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest('/admin/seo/seed-queue');
      setOverview(result);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить очередь');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !user?.is_admin || source) return;
    loadOverview();
  }, [isReady, user?.is_admin, source, loadOverview]);

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (!user.is_admin) return <Navigate to="/dashboard" replace />;

  const decodedSource = source ? decodeURIComponent(source) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-wrap items-center gap-3 border-b border-gray-100 pb-4">
        <Link to={ANALYTICS_SEO_URL} className="text-sm text-gray-500 hover:text-gray-800">
          ← SEO
        </Link>
        <span className="text-gray-300">/</span>
        {decodedSource ? (
          <>
            <Link to="/admin/analytics/seo/queue" className="text-sm text-gray-500 hover:text-gray-800">
              Очередь Rossko
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-bold text-gray-900">{sourceLabel(decodedSource)}</h1>
          </>
        ) : (
          <h1 className="text-xl font-bold text-gray-900">Очередь Rossko</h1>
        )}
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {decodedSource ? (
        <SourceDetail source={decodedSource} />
      ) : (
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            Выберите источник, чтобы посмотреть бренд, артикул и статус каждой позиции.
          </p>
          <QueueTotals totals={overview?.totals} />
          <SourceOverview overview={overview} loading={loading} />
        </div>
      )}
    </div>
  );
}
