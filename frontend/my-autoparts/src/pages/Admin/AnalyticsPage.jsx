import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { API_BASE, apiRequest } from '../../utils/apiClient';

const PERIOD_OPTIONS = [
  { value: 7, label: '7 дн.' },
  { value: 30, label: '30 дн.' },
  { value: 90, label: '90 дн.' },
];

const TABS = [
  { id: 'overview', label: 'Обзор' },
  { id: 'pages', label: 'Страницы' },
  { id: 'product-cards', label: 'Карточки' },
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

const PRODUCT_CARD_TEMPLATE = '/part/:productId';

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

function pageLabel(path) {
  return PAGE_LABELS[path] || path;
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

export default function AnalyticsPage() {
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [days, setDays] = useState(7);
  const [viewMode, setViewMode] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [productCardsLoading, setProductCardsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pages, setPages] = useState([]);
  const [forms, setForms] = useState([]);
  const [activity, setActivity] = useState([]);
  const [selectedPath, setSelectedPath] = useState(null);
  const [pageDetail, setPageDetail] = useState(null);
  const [productCards, setProductCards] = useState(null);
  const [productUrlsDownloadBusy, setProductUrlsDownloadBusy] = useState(false);
  const [productUrlsNotice, setProductUrlsNotice] = useState(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, pagesRes, formsRes, activityRes] = await Promise.all([
        apiRequest(`/admin/analytics/summary?days=${days}`),
        apiRequest(`/admin/analytics/pages?days=${days}`),
        apiRequest(`/admin/analytics/forms?days=${days}`),
        apiRequest(`/admin/analytics/activity?days=${Math.max(days, 30)}`),
      ]);
      setSummary(summaryRes);
      setPages(pagesRes?.items || []);
      setForms(formsRes?.items || []);
      setActivity(activityRes?.items || []);
    } catch (e) {
      setError(e?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [days]);

  const loadPageDetail = useCallback(
    async (pathTemplate) => {
      setDetailLoading(true);
      setError(null);
      try {
        const detail = await apiRequest(
          `/admin/analytics/page-detail?days=${days}&path_template=${encodeURIComponent(pathTemplate)}`
        );
        setPageDetail(detail);
        setSelectedPath(pathTemplate);
      } catch (e) {
        setError(e?.message || 'Ошибка загрузки');
      } finally {
        setDetailLoading(false);
      }
    },
    [days]
  );

  const loadProductCards = useCallback(async () => {
    setProductCardsLoading(true);
    setError(null);
    try {
      setProductCards(await apiRequest(`/admin/analytics/product-cards?days=${days}&limit=100`));
    } catch (e) {
      setError(e?.message || 'Ошибка загрузки');
    } finally {
      setProductCardsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (!isReady || !user?.is_admin) return;
    if (viewMode === 'overview') loadOverview();
    else if (viewMode === 'pages') {
      setLoading(true);
      apiRequest(`/admin/analytics/pages?days=${days}`)
        .then((res) => setPages(res?.items || []))
        .catch((e) => setError(e?.message || 'Ошибка загрузки'))
        .finally(() => setLoading(false));
    } else loadProductCards();
  }, [isReady, user?.is_admin, viewMode, days, loadOverview, loadProductCards]);

  useEffect(() => {
    if (!isReady || !user?.is_admin || viewMode !== 'pages' || !selectedPath) return;
    loadPageDetail(selectedPath);
  }, [isReady, user?.is_admin, viewMode, selectedPath, days, loadPageDetail]);

  const selectPage = (path) => {
    setViewMode('pages');
    setSelectedPath(path);
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

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (!user.is_admin) return <Navigate to="/dashboard" replace />;

  const pageColumns = [
    {
      key: 'name',
      label: 'Страница',
      render: (r) => (
        <span className="font-medium" title={r.path_template}>
          {pageLabel(r.path_template)}
        </span>
      ),
    },
    {
      key: 'views',
      label: 'Просм.',
      align: 'right',
      render: (r) => formatNumber(r.views),
    },
    {
      key: 'visitors',
      label: 'Посет.',
      align: 'right',
      render: (r) => formatNumber(r.unique_visitors),
    },
    {
      key: 'time',
      label: 'Время',
      align: 'right',
      render: (r) => formatDuration(r.avg_duration_sec),
    },
  ];

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
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {viewMode === 'overview' && (
        <>
          {loading ? (
            <LoadingBlock />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Просмотры" value={formatNumber(summary?.page_views)} />
                <Stat label="Посетители" value={formatNumber(summary?.unique_visitors)} />
                <Stat label="Время / сессия" value={formatDuration(summary?.avg_session_duration_sec)} />
                <Stat label="Сегодня" value={formatNumber(summary?.active_today)} />
              </div>

              <Panel
                title="Страницы"
                action={
                  <button
                    type="button"
                    onClick={() => setViewMode('pages')}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Все →
                  </button>
                }
              >
                <Table
                  columns={pageColumns}
                  rows={pages.slice(0, 10)}
                  onRowClick={(r) => selectPage(r.path_template)}
                  rowKey={(r) => r.path_template}
                />
              </Panel>

              <Panel title="Формы">
                <Table
                  columns={[
                    { key: 'form', label: 'Форма', render: (r) => r.form_id },
                    { key: 'field', label: 'Поле', render: (r) => r.field_name || '—' },
                    {
                      key: 'fill',
                      label: 'Зап.',
                      align: 'right',
                      render: (r) => formatNumber(r.fill_count),
                    },
                    {
                      key: 'sub',
                      label: 'Отпр.',
                      align: 'right',
                      render: (r) => formatNumber(r.submit_count),
                    },
                  ]}
                  rows={forms.slice(0, 15)}
                  rowKey={(r) => `${r.form_id}-${r.field_name || 'x'}`}
                />
              </Panel>

              <Panel title="По дням">
                <Table
                  columns={[
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
                  ]}
                  rows={activity}
                  rowKey={(r) => r.day}
                />
              </Panel>
            </>
          )}
        </>
      )}

      {viewMode === 'pages' && (
        <div className="grid gap-4 lg:grid-cols-5">
          <Panel title="Список" className="lg:col-span-2">
            {loading ? (
              <LoadingBlock />
            ) : (
              <div className="max-h-[28rem] overflow-y-auto">
                <Table
                  columns={[
                    {
                      key: 'name',
                      label: 'Страница',
                      render: (r) => (
                        <span
                          className={
                            selectedPath === r.path_template ? 'font-semibold text-indigo-700' : ''
                          }
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
                  ]}
                  rows={pages}
                  onRowClick={(r) => setSelectedPath(r.path_template)}
                  rowKey={(r) => r.path_template}
                />
              </div>
            )}
          </Panel>

          <Panel
            title={selectedPath ? pageLabel(selectedPath) : '—'}
            className="lg:col-span-3"
          >
            {!selectedPath ? (
              <p className="py-16 text-center text-sm text-gray-400">← выберите страницу</p>
            ) : detailLoading ? (
              <LoadingBlock />
            ) : pageDetail ? (
              <div className="space-y-4 p-4">
                {selectedPath === PRODUCT_CARD_TEMPLATE && (
                  <button
                    type="button"
                    onClick={() => setViewMode('product-cards')}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    По товарам →
                  </button>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Просмотры" value={formatNumber(pageDetail.page_views)} />
                  <Stat label="Посетители" value={formatNumber(pageDetail.unique_visitors)} />
                  <Stat label="Время" value={formatDuration(pageDetail.avg_duration_sec)} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-500">По дням</p>
                  <Table
                    columns={[
                      { key: 'd', label: 'Дата', render: (r) => formatDay(r.day) },
                      {
                        key: 'p',
                        label: 'Просм.',
                        align: 'right',
                        render: (r) => formatNumber(r.page_views),
                      },
                      {
                        key: 'u',
                        label: 'Посет.',
                        align: 'right',
                        render: (r) => formatNumber(r.unique_visitors),
                      },
                    ]}
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
                      rows={pageDetail.instances}
                      rowKey={(r) => r.path_raw}
                    />
                  </div>
                )}
              </div>
            ) : null}
          </Panel>
        </div>
      )}

      {viewMode === 'product-cards' && (
        <Panel
          title={
            productCards
              ? `Карточки · ${formatNumber(productCards.total_views)} просм. · ${formatNumber(productCards.unique_cards)} шт.`
              : 'Карточки'
          }
        >
          {productCardsLoading ? (
            <LoadingBlock />
          ) : (
            <Table
              columns={[
                {
                  key: 'product',
                  label: 'Товар',
                  render: (r) =>
                    r.product_id ? (
                      <div>
                        <p className="font-medium leading-tight">
                          {r.name || `#${r.product_id}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {[r.brand, r.article].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    ) : (
                      '—'
                    ),
                },
                {
                  key: 'url',
                  label: 'URL',
                  render: (r) => (
                    <a
                      href={r.path_raw}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-indigo-600 hover:underline"
                    >
                      {r.path_raw.replace(/^\/part\//, '…/')}
                    </a>
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
                {
                  key: 't',
                  label: 'Время',
                  align: 'right',
                  render: (r) => formatDuration(r.avg_duration_sec),
                },
              ]}
              rows={productCards?.items || []}
              rowKey={(r) => r.path_raw}
            />
          )}
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={downloadProductCardUrls}
          disabled={productUrlsDownloadBusy}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {productUrlsDownloadBusy ? '…' : '150 URL для SEO'}
        </button>
        {productUrlsNotice && (
          <span className="text-xs text-green-700">{productUrlsNotice}</span>
        )}
        <a
          href="https://metrika.yandex.ru/"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-sm text-gray-500 hover:text-indigo-600"
        >
          Метрика ↗
        </a>
      </div>
    </div>
  );
}
