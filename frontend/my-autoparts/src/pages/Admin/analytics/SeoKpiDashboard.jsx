import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE, apiRequest } from '../../../utils/apiClient';
import { formatNumber } from './analyticsFormatters';
import { LoadingState, Section } from './AnalyticsUi';

const CLUSTER_LABELS = {
  A: 'Карточки (A)',
  B: 'Бренды (B)',
  C: 'Категории (C)',
  D: 'Гео (D)',
  unknown: 'Прочее',
};

function SourceBlock({ title, source, onConnect, connectLabel }) {
  const totals = source?.totals;
  const clusters = source?.clusters || {};
  const topQueries = source?.top_queries || [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {!source?.connected ? (
          <button
            type="button"
            onClick={onConnect}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            {connectLabel}
          </button>
        ) : (
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            Подключено
          </span>
        )}
      </div>

      {source?.error ? (
        <p className="text-sm text-red-600">{source.error}</p>
      ) : null}

      {totals ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Показы</div>
            <div className="text-lg font-semibold">{formatNumber(totals.impressions)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Клики</div>
            <div className="text-lg font-semibold">{formatNumber(totals.clicks)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">CTR</div>
            <div className="text-lg font-semibold">{totals.ctr}%</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Позиция</div>
            <div className="text-lg font-semibold">{totals.position}</div>
          </div>
        </div>
      ) : null}

      {Object.keys(clusters).length ? (
        <div className="mb-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4">Кластер</th>
                <th className="py-2 pr-4">Показы</th>
                <th className="py-2 pr-4">Клики</th>
                <th className="py-2 pr-4">CTR</th>
                <th className="py-2">Позиция</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(clusters).map(([cluster, row]) => (
                <tr key={cluster} className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-medium">{CLUSTER_LABELS[cluster] || cluster}</td>
                  <td className="py-2 pr-4">{formatNumber(row.impressions)}</td>
                  <td className="py-2 pr-4">{formatNumber(row.clicks)}</td>
                  <td className="py-2 pr-4">{row.ctr}%</td>
                  <td className="py-2">{row.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {topQueries.length ? (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-700">Топ запросов</h4>
          <ul className="space-y-1 text-sm text-gray-700">
            {topQueries.slice(0, 10).map((row) => (
              <li key={row.query} className="flex flex-wrap justify-between gap-2 border-b border-gray-50 py-1">
                <span>{row.query}</span>
                <span className="text-gray-500">
                  {formatNumber(row.impressions)} показов · {row.ctr}% CTR
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function SeoKpiDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleSaving, setGoogleSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest('/admin/seo/kpi/dashboard?days=14');
      setData(payload);
    } catch (e) {
      setError(e?.message || 'Ошибка загрузки KPI');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === '1') {
      setNotice('Google Search Console подключен');
      loadDashboard();
    }
    const googleError = params.get('google_error');
    if (googleError) {
      setError(decodeURIComponent(googleError));
    }
  }, [loadDashboard]);

  const startGoogleOAuth = () => {
    const redirectTo = `${window.location.pathname}${window.location.search.includes('tab=seo') ? window.location.search : '?tab=seo'}`;
    window.location.href = `${API_BASE}/admin/google/oauth/start?redirect_to=${encodeURIComponent(redirectTo)}`;
  };

  const saveGoogleCredentials = async () => {
    setGoogleSaving(true);
    setNotice(null);
    try {
      const payload = { client_id: googleClientId.trim() };
      if (googleClientSecret.trim()) payload.client_secret = googleClientSecret.trim();
      await apiRequest('/admin/google/credentials', { method: 'POST', body: JSON.stringify(payload) });
      setGoogleClientSecret('');
      setNotice('Google OAuth credentials сохранены');
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения Google credentials');
    } finally {
      setGoogleSaving(false);
    }
  };

  if (loading && !data) {
    return <LoadingState label="Загрузка SEO KPI…" />;
  }

  return (
    <Section
      title="SEO KPI (GSC + Яндекс Вебмастер)"
      subtitle="Показы, клики, CTR и позиции по кластерам A–D за последние 2 недели."
    >
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {notice ? <p className="mb-3 text-sm text-green-700">{notice}</p> : null}

      <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-800">Google Search Console OAuth</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input
            type="text"
            value={googleClientId}
            onChange={(e) => setGoogleClientId(e.target.value)}
            placeholder="Google client_id"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={googleClientSecret}
            onChange={(e) => setGoogleClientSecret(e.target.value)}
            placeholder="Google client_secret"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={googleSaving || !googleClientId.trim()}
            onClick={saveGoogleCredentials}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Google OAuth подключается здесь. Яндекс Вебмастер — через API{' '}
          <code className="rounded bg-gray-100 px-1">/admin/yandex/*</code> (см. docs/seo/webmaster-setup.md).
        </p>
      </div>

      {data?.sitemap ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 sm:col-span-2 lg:col-span-1">
            <div className="text-xs text-indigo-700">Всего страниц на сайте</div>
            <div className="text-2xl font-semibold text-indigo-950">
              {formatNumber(data.sitemap.total_pages ?? 0)}
            </div>
            <div className="mt-1 text-xs text-indigo-600/80">URL в sitemap (без index)</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs text-gray-500">URL в sitemap (б/у)</div>
            <div className="text-lg font-semibold">{formatNumber(data.sitemap.products_urls)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs text-gray-500">URL в sitemap (new)</div>
            <div className="text-lg font-semibold">{formatNumber(data.sitemap.new_parts_urls)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs text-gray-500">Brand landings</div>
            <div className="text-lg font-semibold">{formatNumber(data.sitemap.brand_landings)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs text-gray-500">Период KPI</div>
            <div className="text-sm font-semibold">
              {data.period?.start} — {data.period?.end}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SourceBlock
          title="Google Search Console"
          source={data?.google}
          onConnect={startGoogleOAuth}
          connectLabel="Подключить GSC"
        />
        <SourceBlock
          title="Яндекс Вебмастер"
          source={data?.yandex}
          onConnect={() => {
            setNotice(
              'OAuth Яндекса: сохраните credentials через API /admin/yandex/credentials и подключите OAuth (/admin/yandex/oauth/start). Host — /admin/yandex/host/ensure.'
            );
          }}
          connectLabel="Как подключить"
        />
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={loadDashboard}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Обновить KPI
        </button>
      </div>
    </Section>
  );
}
