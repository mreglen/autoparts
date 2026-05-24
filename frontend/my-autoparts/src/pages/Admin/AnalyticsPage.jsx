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

const PAGE_LABELS = {
  '/': 'Главная',
  '/catalog': 'Каталог',
  '/autoparts/new': 'Новые запчасти',
  '/autoparts/new/filters': 'Фильтры (новые)',
  '/autoparts/used': 'Б/у запчасти',
  '/autoparts/used/filters': 'Фильтры (б/у)',
  '/about': 'О компании',
  '/delivery': 'Доставка',
  '/payment': 'Оплата',
  '/cart': 'Корзина',
  '/order-reg': 'Оформление заказа',
  '/auth': 'Авторизация',
  '/part/:productId': 'Карточки товаров (все)',
};

const PRODUCT_CARD_TEMPLATE = '/part/:productId';

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

function pageLabel(pathTemplate) {
  return PAGE_LABELS[pathTemplate] || pathTemplate;
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

function ActivityTable({ rows, emptyText }) {
  return (
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
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-6 py-8 text-center text-gray-400">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
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
  );
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

  const loadPageDetail = useCallback(
    async (pathTemplate) => {
      setDetailLoading(true);
      setError(null);
      try {
        const encoded = encodeURIComponent(pathTemplate);
        const detail = await apiRequest(
          `/admin/analytics/page-detail?days=${days}&path_template=${encoded}`
        );
        setPageDetail(detail);
        setSelectedPath(pathTemplate);
      } catch (e) {
        setError(e?.message || 'Не удалось загрузить статистику страницы');
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
      const data = await apiRequest(`/admin/analytics/product-cards?days=${days}&limit=100`);
      setProductCards(data);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить статистику карточек товаров');
    } finally {
      setProductCardsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (!isReady || !user?.is_admin) return;
    if (viewMode === 'overview') {
      loadOverview();
    } else if (viewMode === 'pages') {
      setLoading(true);
      apiRequest(`/admin/analytics/pages?days=${days}`)
        .then((res) => setPages(res?.items || []))
        .catch((e) => setError(e?.message || 'Не удалось загрузить список страниц'))
        .finally(() => setLoading(false));
    } else if (viewMode === 'product-cards') {
      loadProductCards();
    }
  }, [isReady, user?.is_admin, viewMode, days, loadOverview, loadProductCards]);

  useEffect(() => {
    if (!isReady || !user?.is_admin || viewMode !== 'pages' || !selectedPath) return;
    loadPageDetail(selectedPath);
  }, [isReady, user?.is_admin, viewMode, selectedPath, days, loadPageDetail]);

  const handleSelectPage = (pathTemplate) => {
    setViewMode('pages');
    setSelectedPath(pathTemplate);
  };

  const openProductCardsTab = () => {
    setViewMode('product-cards');
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

  const tabClass = (mode) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${
      viewMode === mode
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Аналитика</h1>
          <p className="mt-1 text-sm text-gray-500">
            Продвижение сайта: просмотры, активность посетителей и карточки товаров
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      <div className="flex flex-wrap gap-2">
        <button type="button" className={tabClass('overview')} onClick={() => setViewMode('overview')}>
          Обзор
        </button>
        <button type="button" className={tabClass('pages')} onClick={() => setViewMode('pages')}>
          По страницам
        </button>
        <button
          type="button"
          className={tabClass('product-cards')}
          onClick={openProductCardsTab}
        >
          Карточки товаров
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {viewMode === 'overview' && (
        <>
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
                <div className="border-b border-gray-100 px-6 py-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Страницы</h2>
                    <p className="text-sm text-gray-500">Нажмите на строку для детальной статистики</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewMode('pages')}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Все страницы →
                  </button>
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
                            Данных пока нет
                          </td>
                        </tr>
                      ) : (
                        pages.slice(0, 15).map((row) => (
                          <tr
                            key={row.path_template}
                            className="cursor-pointer hover:bg-indigo-50/50"
                            onClick={() => handleSelectPage(row.path_template)}
                          >
                            <td className="px-6 py-3">
                              <p className="font-medium text-gray-900">{pageLabel(row.path_template)}</p>
                              <p className="font-mono text-xs text-gray-500">{row.path_template}</p>
                            </td>
                            <td className="px-6 py-3 text-right text-gray-700">
                              {formatNumber(row.views)}
                            </td>
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
                            <td className="px-6 py-3 text-right text-gray-700">
                              {formatNumber(row.fill_count)}
                            </td>
                            <td className="px-6 py-3 text-right text-gray-700">
                              {formatNumber(row.submit_count)}
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
                  <h2 className="text-lg font-semibold text-gray-900">Активность по дням</h2>
                </div>
                <ActivityTable rows={activity} emptyText="Данных по активности пока нет" />
              </div>
            </>
          )}
        </>
      )}

      {viewMode === 'pages' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Все страницы</h2>
              <p className="text-sm text-gray-500">Выберите страницу для детализации</p>
            </div>
            {loading ? (
              <p className="px-6 py-8 text-center text-sm text-gray-500">Загрузка…</p>
            ) : (
              <div className="max-h-[32rem] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Страница</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Просм.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pages.map((row) => {
                      const isSelected = selectedPath === row.path_template;
                      const isProductCards = row.path_template === PRODUCT_CARD_TEMPLATE;
                      return (
                        <tr
                          key={row.path_template}
                          className={`cursor-pointer ${
                            isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => handleSelectPage(row.path_template)}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{pageLabel(row.path_template)}</p>
                            <p className="font-mono text-xs text-gray-500 truncate max-w-xs">
                              {row.path_template}
                            </p>
                            {isProductCards && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openProductCardsTab();
                                }}
                                className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                              >
                                Открыть по товарам →
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                            {formatNumber(row.views)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedPath ? pageLabel(selectedPath) : 'Детали страницы'}
              </h2>
              {selectedPath && (
                <p className="font-mono text-xs text-gray-500 mt-1">{selectedPath}</p>
              )}
            </div>
            {!selectedPath ? (
              <p className="px-6 py-12 text-center text-sm text-gray-400">
                Выберите страницу слева
              </p>
            ) : detailLoading ? (
              <p className="px-6 py-12 text-center text-sm text-gray-500">Загрузка…</p>
            ) : pageDetail ? (
              <div className="space-y-4 p-6">
                <div className="grid grid-cols-2 gap-3">
                  <SummaryCard label="Просмотры" value={formatNumber(pageDetail.page_views)} />
                  <SummaryCard label="Посетители" value={formatNumber(pageDetail.unique_visitors)} />
                  <SummaryCard
                    label="Ср. время на странице"
                    value={formatDuration(pageDetail.avg_duration_sec)}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Активность по дням</h3>
                  <ActivityTable
                    rows={pageDetail.activity || []}
                    emptyText="Нет данных за выбранный период"
                  />
                </div>

                {pageDetail.instances?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      {selectedPath === PRODUCT_CARD_TEMPLATE
                        ? 'Отдельные карточки (URL)'
                        : 'Варианты URL'}
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-gray-500">URL</th>
                            <th className="px-3 py-2 text-right text-gray-500">Просм.</th>
                            <th className="px-3 py-2 text-right text-gray-500">Время</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {pageDetail.instances.map((row) => (
                            <tr key={row.path_raw}>
                              <td className="px-3 py-2 font-mono text-gray-700 break-all">
                                {row.path_raw}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-700">
                                {formatNumber(row.views)}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                                {formatDuration(row.avg_duration_sec)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {selectedPath === PRODUCT_CARD_TEMPLATE && (
                      <button
                        type="button"
                        onClick={openProductCardsTab}
                        className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        Полный отчёт по карточкам товаров →
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {viewMode === 'product-cards' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Карточки товаров</h2>
            <p className="text-sm text-gray-500">
              Просмотры отдельных страниц `/part/…` с брендом, артикулом и названием
            </p>
            {productCards && (
              <p className="mt-2 text-sm text-gray-600">
                Всего просмотров карточек:{' '}
                <span className="font-semibold">{formatNumber(productCards.total_views)}</span>
                {' · '}
                Уникальных карточек:{' '}
                <span className="font-semibold">{formatNumber(productCards.unique_cards)}</span>
              </p>
            )}
          </div>
          {productCardsLoading ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500">Загрузка…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">Товар</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500">URL</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Просмотры</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Посетители</th>
                    <th className="px-6 py-3 text-right font-medium text-gray-500">Ср. время</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!productCards?.items?.length ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                        Просмотров карточек товаров пока нет
                      </td>
                    </tr>
                  ) : (
                    productCards.items.map((row) => (
                      <tr key={row.path_raw} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          {row.product_id ? (
                            <>
                              <p className="font-medium text-gray-900">
                                {row.name || `Товар №${row.product_id}`}
                              </p>
                              <p className="text-xs text-gray-500">
                                {[row.brand, row.article].filter(Boolean).join(' · ') || '—'}
                              </p>
                              <p className="text-xs text-gray-400">ID {row.product_id}</p>
                            </>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <a
                            href={row.path_raw}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-indigo-600 hover:text-indigo-800 break-all"
                          >
                            {row.path_raw}
                          </a>
                        </td>
                        <td className="px-6 py-3 text-right text-gray-700">
                          {formatNumber(row.views)}
                        </td>
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
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">SEO — рабочие URL карточек товаров</h2>
        <p className="text-sm text-gray-500 mb-4">
          Скачайте текстовый файл со 150 адресами карточек для индексации в поисковиках.
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
          Расширенная веб-аналитика доступна в кабинете Яндекс Метрики.
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
