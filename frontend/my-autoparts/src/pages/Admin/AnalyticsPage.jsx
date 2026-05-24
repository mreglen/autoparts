import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { API_BASE, apiRequest } from '../../utils/apiClient';

const PERIOD_OPTIONS = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
];

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total} сек`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes < 60) return rest ? `${minutes} мин ${rest} сек` : `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours} ч ${mins} мин` : `${hours} ч`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('ru-RU').format(Number(value) || 0);
}

function formatDay(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}

export default function AnalyticsPage() {
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pages, setPages] = useState([]);
  const [forms, setForms] = useState([]);
  const [activity, setActivity] = useState([]);
  const [productUrlsDownloadBusy, setProductUrlsDownloadBusy] = useState(false);
  const [productUrlsNotice, setProductUrlsNotice] = useState(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activityDays = Math.max(days, 30);
      const [summaryRes, pagesRes, formsRes, activityRes] = await Promise.all([
        apiRequest(`/admin/analytics/summary?days=${days}`),
        apiRequest(`/admin/analytics/pages?days=${days}`),
        apiRequest(`/admin/analytics/forms?days=${days}`),
        apiRequest(`/admin/analytics/activity?days=${activityDays}`),
      ]);
      setSummary(summaryRes);
      setPages(pagesRes?.items || []);
      setForms(formsRes?.items || []);
      setActivity(activityRes?.items || []);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить аналитику');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (!isReady || !user?.is_admin) return;
    loadAnalytics();
  }, [isReady, user?.is_admin, loadAnalytics]);

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Не удалось сформировать файл с URL');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] || 'product-card-urls-150.txt';
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setProductUrlsNotice(
        `Файл ${filename} скачан. В списке только рабочие карточки: в наличии, с фото, брендом и артикулом.`
      );
    } catch (e) {
      setError(e?.message || 'Не удалось скачать файл с URL карточек');
    } finally {
      setProductUrlsDownloadBusy(false);
    }
  };

  if (!isReady) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (!user.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Аналитика</h1>
          <p className="mt-1 text-sm text-gray-500">
            Продвижение сайта: просмотры, активность посетителей и заполнение форм
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="analytics-period" className="text-sm text-gray-600">
            Период
          </label>
          <select
            id="analytics-period"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
          Загрузка аналитики…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Просмотры страниц"
              value={formatNumber(summary?.page_views)}
              hint={`за ${days} дней`}
            />
            <SummaryCard
              label="Уникальные посетители"
              value={formatNumber(summary?.unique_visitors)}
              hint={`за ${days} дней`}
            />
            <SummaryCard
              label="Среднее время на сайте"
              value={formatDuration(summary?.avg_session_duration_sec)}
              hint="на сессию"
            />
            <SummaryCard
              label="Активны сегодня"
              value={formatNumber(summary?.active_today)}
              hint="уникальные посетители"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Страницы</h2>
              <p className="text-sm text-gray-500">Топ страниц по просмотрам</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Страница</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Просмотры</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Посетители</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Ср. время</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pages.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                        Данных пока нет — статистика начнёт собираться после посещений сайта
                      </td>
                    </tr>
                  ) : (
                    pages.map((row) => (
                      <tr key={row.path_template}>
                        <td className="px-6 py-3 font-mono text-gray-800">{row.path_template}</td>
                        <td className="px-6 py-3 text-right text-gray-700">{formatNumber(row.views)}</td>
                        <td className="px-6 py-3 text-right text-gray-700">
                          {formatNumber(row.unique_visitors)}
                        </td>
                        <td className="px-6 py-3 text-right text-gray-700">
                          {formatDuration(row.avg_duration_sec)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Заполнение форм</h2>
              <p className="text-sm text-gray-500">Какие поля заполняли пользователи (без значений)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Форма</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Поле</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Заполнений</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Отправок</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {forms.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                        Данных по формам пока нет
                      </td>
                    </tr>
                  ) : (
                    forms.map((row) => (
                      <tr key={`${row.form_id}-${row.field_name || 'submit'}`}>
                        <td className="px-6 py-3 text-gray-800">{row.form_id}</td>
                        <td className="px-6 py-3 font-mono text-gray-600">{row.field_name || '—'}</td>
                        <td className="px-6 py-3 text-right text-gray-700">{formatNumber(row.fill_count)}</td>
                        <td className="px-6 py-3 text-right text-gray-700">{formatNumber(row.submit_count)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Активность по дням</h2>
              <p className="text-sm text-gray-500">Просмотры и уникальные посетители</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Дата</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Просмотры</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Посетители</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activity.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-gray-400">
                        Данных по активности пока нет
                      </td>
                    </tr>
                  ) : (
                    activity.map((row) => (
                      <tr key={row.day}>
                        <td className="px-6 py-3 text-gray-800">{formatDay(row.day)}</td>
                        <td className="px-6 py-3 text-right text-gray-700">{formatNumber(row.page_views)}</td>
                        <td className="px-6 py-3 text-right text-gray-700">
                          {formatNumber(row.unique_visitors)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">SEO — рабочие URL карточек товаров</h2>
        <p className="text-sm text-gray-500 mb-4">
          Скачайте текстовый файл со 150 адресами карточек, которые реально открываются на сайте:
          товар в наличии, есть фото, заполнены бренд, артикул и название.
        </p>
        <button
          type="button"
          onClick={downloadProductCardUrls}
          disabled={productUrlsDownloadBusy}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {productUrlsDownloadBusy ? 'Формируем файл…' : 'Скачать 150 URL карточек (.txt)'}
        </button>
        {productUrlsNotice && (
          <p className="mt-3 text-sm text-green-700">{productUrlsNotice}</p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Yandex Metrika</h2>
        <p className="text-sm text-gray-500 mb-4">
          Расширенная веб-аналитика (карта кликов, вебвизор, источники трафика) доступна в кабинете
          Яндекс Метрики. Данные на этой странице собираются непосредственно на сайте.
        </p>
        <a
          href="https://metrika.yandex.ru/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
        >
          Открыть Яндекс Метрику
        </a>
      </div>
    </div>
  );
}
