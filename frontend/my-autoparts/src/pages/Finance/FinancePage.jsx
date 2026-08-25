import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiAxios } from '../../utils/apiClient';
import {
  CHANNEL_OPTIONS,
  buildFinanceQueryParams,
  clampFinanceDate,
  formatFinanceCurrency,
  formatFinanceDate,
  getFinanceTodayDate,
  getMonthRangeDefaults,
} from './financeDisplay';
import MobileCollapsibleFilters from '../../components/MobileCollapsibleFilters/MobileCollapsibleFilters';
import { Skeleton } from '../../components/UI';
import {
  warehouseEmptyShellClass,
  warehousePageClass,
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';

const TABS = [
  { id: 'summary', label: 'Сводка' },
  { id: 'sales', label: 'Продажи' },
  { id: 'writeoffs', label: 'Списания' },
  { id: 'stock_ins', label: 'Поступления' },
  { id: 'inventory', label: 'Остатки' },
];

const tabFilterButtonClass = (active) =>
  `inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium transition ${
    active
      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
      : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
  }`;

const channelFilterButtonClass = tabFilterButtonClass;

function FinanceHeaderStats({ activeTab, summary, sales, writeoffs, stockIns, inventory }) {
  const blocks = useMemo(() => {
    if (activeTab === 'summary' && summary) {
      return [
        { value: formatFinanceCurrency(summary.sales_total), label: 'Продажи', accent: false },
        { value: formatFinanceCurrency(summary.stock_in_value), label: 'Поступления', accent: true },
        { value: formatFinanceCurrency(summary.inventory_value), label: 'Остатки', accent: false },
      ];
    }
    if (activeTab === 'sales') {
      return [
        { value: formatFinanceCurrency(sales.totals?.total), label: 'Итого', accent: false },
        { value: String(sales.totals?.count ?? 0), label: 'Строк', accent: true },
      ];
    }
    if (activeTab === 'writeoffs') {
      return [
        { value: String(writeoffs.count ?? 0), label: 'Списаний', accent: false },
        { value: String(writeoffs.total_qty ?? 0), label: 'Шт.', accent: true },
      ];
    }
    if (activeTab === 'stock_ins') {
      return [
        { value: formatFinanceCurrency(stockIns.total_value), label: 'Сумма', accent: false },
        { value: String(stockIns.count ?? 0), label: 'Записей', accent: true },
      ];
    }
    if (activeTab === 'inventory') {
      return [
        { value: formatFinanceCurrency(inventory.total_value), label: 'Оценка', accent: false },
        {
          value: String(inventory.products_count ?? 0),
          label: `${inventory.total_qty ?? 0} шт.`,
          accent: true,
        },
      ];
    }
    return [];
  }, [activeTab, summary, sales, writeoffs, stockIns, inventory]);

  if (!blocks.length) return null;

  return (
    <div
      className={`grid gap-4 sm:flex sm:shrink-0 sm:gap-8 ${
        blocks.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
      }`}
    >
      {blocks.map((block) => (
        <div key={block.label} className="text-center">
          <div
            className={`text-2xl font-bold tabular-nums leading-none sm:text-[1.75rem] ${
              block.accent ? 'text-indigo-600' : 'text-gray-900'
            }`}
          >
            {block.value}
          </div>
          <div className="mt-1.5 text-xs text-gray-500 sm:text-sm">{block.label}</div>
        </div>
      ))}
    </div>
  );
}

function FinanceField({ label, children }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 text-right font-medium text-gray-900 break-words">{children}</span>
    </div>
  );
}

function FinanceMobileCard({ children }) {
  return (
    <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-gray-200/80">{children}</div>
  );
}

function FinanceTableShell({ children }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl bg-white ring-1 ring-gray-200/80 md:block">
      {children}
    </div>
  );
}

function FinanceEmptyState({ children }) {
  return <p className={`${warehouseEmptyShellClass} text-sm text-gray-500`}>{children}</p>;
}

export default function FinancePage() {
  const navigate = useNavigate();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const defaults = useMemo(() => getMonthRangeDefaults(), []);
  const todayDate = useMemo(() => getFinanceTodayDate(), []);

  const hasPermission =
    user?.is_admin ||
    user?.is_seller ||
    (user?.is_employee && permissionCodes?.includes('finance.reports'));

  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [asOfDate, setAsOfDate] = useState(defaults.asOfDate);
  const [channel, setChannel] = useState('all');
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [sales, setSales] = useState({ rows: [], totals: {} });
  const [writeoffs, setWriteoffs] = useState({ rows: [], count: 0, total_qty: 0 });
  const [stockIns, setStockIns] = useState({ rows: [], count: 0, total_qty: 0, total_value: 0 });
  const [inventory, setInventory] = useState({
    rows: [],
    products_count: 0,
    total_qty: 0,
    total_value: 0,
  });

  const queryParams = useMemo(
    () => buildFinanceQueryParams({ dateFrom, dateTo, asOfDate, channel }),
    [dateFrom, dateTo, asOfDate, channel]
  );

  const loadData = useCallback(async () => {
    if (!user?.organization_id) return;
    setLoading(true);
    setError(null);
    try {
      const base = buildFinanceQueryParams({ dateFrom, dateTo, asOfDate, channel });
      const invParams = { as_of_date: asOfDate };
      const [summaryRes, salesRes, writeoffsRes, stockInsRes, inventoryRes] = await Promise.all([
        apiAxios.get('/finance/summary', { params: base }),
        apiAxios.get('/finance/sales', { params: base }),
        apiAxios.get('/finance/writeoffs', {
          params: { date_from: dateFrom, date_to: dateTo },
        }),
        apiAxios.get('/finance/stock-ins', {
          params: { date_from: dateFrom, date_to: dateTo },
        }),
        apiAxios.get('/finance/inventory', { params: invParams }),
      ]);
      setSummary(summaryRes.data);
      setSales(salesRes.data);
      setWriteoffs(writeoffsRes.data);
      setStockIns(stockInsRes.data);
      setInventory(inventoryRes.data);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Не удалось загрузить отчёты');
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id, dateFrom, dateTo, asOfDate, channel]);

  useEffect(() => {
    if (!hasPermission) {
      navigate('/', { replace: true });
      return;
    }
    if (user?.organization_id) {
      loadData();
    }
  }, [hasPermission, user?.organization_id, loadData, navigate]);

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/finance' && user?.organization_id) {
        loadData();
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [loadData, user?.organization_id]);

  const handleExport = async () => {
    if (!user?.organization_id) return;
    setExporting(true);
    try {
      const response = await apiAxios.get('/finance/export.xlsx', {
        params: queryParams,
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `finance_${dateFrom}_${dateTo}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Не удалось выполнить экспорт');
    } finally {
      setExporting(false);
    }
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasPermission) return <Navigate to="/" replace />;

  if (!user.organization_id) {
    return (
      <div className={`${warehousePageClass} rounded-2xl bg-amber-50 p-6 text-amber-900 ring-1 ring-amber-200/80`}>
        Финансовые отчёты доступны только для учётной записи, привязанной к организации продавца.
      </div>
    );
  }

  const showHeaderStats = !loading || summary;

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-4`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:flex-1">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Финансы</h1>
          {showHeaderStats ? (
            <FinanceHeaderStats
              activeTab={activeTab}
              summary={summary}
              sales={sales}
              writeoffs={writeoffs}
              stockIns={stockIns}
              inventory={inventory}
            />
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || loading}
          className={`${warehousePrimaryButtonClass} w-full shrink-0 lg:w-auto`}
        >
          {exporting ? 'Формируем файл…' : 'Экспорт в таблицу'}
        </button>
      </div>

      <MobileCollapsibleFilters title="Период и параметры">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-gray-500">Период с</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo < todayDate ? dateTo : todayDate}
              onChange={(e) => {
                const next = clampFinanceDate(e.target.value, todayDate);
                setDateFrom(next);
                if (next > dateTo) setDateTo(next);
              }}
              className={warehousePillControlClass}
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-gray-500">Период по</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={todayDate}
              onChange={(e) => {
                const next = clampFinanceDate(e.target.value, todayDate);
                setDateTo(next);
                if (next < dateFrom) setDateFrom(next);
              }}
              className={warehousePillControlClass}
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-gray-500">Остатки на дату</span>
            <input
              type="date"
              value={asOfDate}
              max={todayDate}
              onChange={(e) => setAsOfDate(clampFinanceDate(e.target.value, todayDate))}
              className={warehousePillControlClass}
            />
          </label>
        </div>
      </MobileCollapsibleFilters>

      {error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80">
          {error}
        </div>
      ) : null}

      <div className={warehouseToolbarClass}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={tabFilterButtonClass(activeTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sales' ? (
        <>
          <div className={`${warehouseToolbarClass} hidden sm:flex`}>
            {CHANNEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setChannel(opt.value)}
                className={channelFilterButtonClass(channel === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="block sm:hidden">
            <span className="mb-1.5 block text-xs font-medium text-gray-500">Канал продаж</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className={warehousePillControlClass}
            >
              {CHANNEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      {loading && !summary ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-3 h-6 w-24" />
                <Skeleton className="mt-2 h-3 w-20" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 sm:p-5">
            <Skeleton className="h-4 w-40" />
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl bg-gray-50 px-3 py-2.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'summary' && summary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80">
                  <p className="text-xs font-medium text-gray-500">Продажи</p>
                  <p className="mt-2 text-lg font-bold tabular-nums text-gray-900 sm:text-xl">
                    {formatFinanceCurrency(summary.sales_total)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{summary.sales_count} строк</p>
                </div>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80">
                  <p className="text-xs font-medium text-gray-500">Поступления</p>
                  <p className="mt-2 text-lg font-bold tabular-nums text-gray-900 sm:text-xl">
                    {formatFinanceCurrency(summary.stock_in_value)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{summary.stock_in_qty} шт.</p>
                </div>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80">
                  <p className="text-xs font-medium text-gray-500">Остатки</p>
                  <p className="mt-2 text-lg font-bold tabular-nums text-gray-900 sm:text-xl">
                    {formatFinanceCurrency(summary.inventory_value)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {summary.inventory_products} поз., {summary.inventory_qty} шт.
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80">
                  <p className="text-xs font-medium text-gray-500">Списания</p>
                  <p className="mt-2 text-lg font-bold tabular-nums text-gray-900 sm:text-xl">
                    {summary.writeoffs_count}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{summary.writeoffs_qty} шт.</p>
                </div>
              </div>

              {summary.sales_by_channel ? (
                <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 sm:p-5">
                  <h3 className="text-sm font-semibold text-gray-900">Продажи по каналам</h3>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {Object.entries(summary.sales_by_channel).map(([key, ch]) => (
                      <div
                        key={key}
                        className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm ring-1 ring-gray-100"
                      >
                        <div className="font-medium text-gray-800">{ch.label || key}</div>
                        <div className="mt-1 tabular-nums text-gray-600">
                          {formatFinanceCurrency(ch.total)} · {ch.count} строк
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'sales' ? (
            <div className="space-y-3">
              <div className="md:hidden space-y-3">
                {!sales.rows?.length ? (
                  <FinanceEmptyState>Нет продаж за период</FinanceEmptyState>
                ) : (
                  sales.rows.map((row) => (
                    <FinanceMobileCard key={row.id}>
                      <FinanceField label="Дата">{formatFinanceDate(row.movement_date)}</FinanceField>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{row.name || '—'}</p>
                        <p className="text-xs text-gray-500 break-words">
                          {[row.article, row.internal_code].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <FinanceField label="Канал">{row.channel_label}</FinanceField>
                      <FinanceField label="Оплата">{row.payment_method || '—'}</FinanceField>
                      <FinanceField label="Кол-во">{row.quantity}</FinanceField>
                      <FinanceField label="Сумма">{formatFinanceCurrency(row.line_total)}</FinanceField>
                    </FinanceMobileCard>
                  ))
                )}
              </div>
              <FinanceTableShell>
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Дата</th>
                      <th className="px-4 py-3 font-medium">Товар</th>
                      <th className="px-4 py-3 font-medium">Канал</th>
                      <th className="px-4 py-3 font-medium">Оплата</th>
                      <th className="px-4 py-3 text-right font-medium">Кол-во</th>
                      <th className="px-4 py-3 text-right font-medium">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sales.rows?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          Нет продаж за период
                        </td>
                      </tr>
                    ) : (
                      sales.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/80">
                          <td className="whitespace-nowrap px-4 py-3">
                            {formatFinanceDate(row.movement_date)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{row.name || '—'}</div>
                            <div className="text-xs text-gray-500">
                              {[row.article, row.internal_code].filter(Boolean).join(' · ')}
                            </div>
                          </td>
                          <td className="px-4 py-3">{row.channel_label}</td>
                          <td className="px-4 py-3">{row.payment_method || '—'}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.quantity}</td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">
                            {formatFinanceCurrency(row.line_total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </FinanceTableShell>
            </div>
          ) : null}

          {activeTab === 'writeoffs' ? (
            <>
              <div className="mb-3 space-y-3 md:hidden">
                {!writeoffs.rows?.length ? (
                  <FinanceEmptyState>Нет списаний за период</FinanceEmptyState>
                ) : (
                  writeoffs.rows.map((row) => (
                    <FinanceMobileCard key={row.id}>
                      <FinanceField label="Дата">{formatFinanceDate(row.movement_date)}</FinanceField>
                      <FinanceField label="Товар">{row.name || row.article || '—'}</FinanceField>
                      <FinanceField label="Кол-во">{row.quantity}</FinanceField>
                      <FinanceField label="Причина">{row.reason || '—'}</FinanceField>
                    </FinanceMobileCard>
                  ))
                )}
              </div>
              <FinanceTableShell>
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Дата</th>
                      <th className="px-4 py-3 font-medium">Товар</th>
                      <th className="px-4 py-3 text-right font-medium">Кол-во</th>
                      <th className="px-4 py-3 font-medium">Причина</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {!writeoffs.rows?.length ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          Нет списаний за период
                        </td>
                      </tr>
                    ) : (
                      writeoffs.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/80">
                          <td className="px-4 py-3">{formatFinanceDate(row.movement_date)}</td>
                          <td className="px-4 py-3">{row.name || row.article || '—'}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.quantity}</td>
                          <td className="px-4 py-3 text-gray-600">{row.reason || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </FinanceTableShell>
            </>
          ) : null}

          {activeTab === 'stock_ins' ? (
            <>
              <div className="mb-3 space-y-3 md:hidden">
                {!stockIns.rows?.length ? (
                  <FinanceEmptyState>Нет поступлений за период</FinanceEmptyState>
                ) : (
                  stockIns.rows.map((row) => (
                    <FinanceMobileCard key={row.id}>
                      <FinanceField label="Дата">{formatFinanceDate(row.created_at)}</FinanceField>
                      <FinanceField label="Товар">{row.name || row.article || '—'}</FinanceField>
                      <FinanceField label="Кол-во">{row.quantity}</FinanceField>
                      <FinanceField label="Сумма">{formatFinanceCurrency(row.line_total)}</FinanceField>
                    </FinanceMobileCard>
                  ))
                )}
              </div>
              <FinanceTableShell>
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Дата</th>
                      <th className="px-4 py-3 font-medium">Товар</th>
                      <th className="px-4 py-3 text-right font-medium">Кол-во</th>
                      <th className="px-4 py-3 text-right font-medium">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {!stockIns.rows?.length ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          Нет поступлений за период
                        </td>
                      </tr>
                    ) : (
                      stockIns.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/80">
                          <td className="px-4 py-3">{formatFinanceDate(row.created_at)}</td>
                          <td className="px-4 py-3">{row.name || row.article || '—'}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.quantity}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatFinanceCurrency(row.line_total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </FinanceTableShell>
            </>
          ) : null}

          {activeTab === 'inventory' ? (
            <div className="space-y-3">
              <div className="space-y-3 md:hidden">
                {!inventory.rows?.length ? (
                  <FinanceEmptyState>Нет остатков на выбранную дату</FinanceEmptyState>
                ) : (
                  inventory.rows.map((row, idx) => (
                    <FinanceMobileCard key={`${row.product_id}-${idx}`}>
                      <FinanceField label="Товар">{row.name || row.article || '—'}</FinanceField>
                      <FinanceField label="Остаток">{row.quantity}</FinanceField>
                      <FinanceField label="Цена">{formatFinanceCurrency(row.unit_price)}</FinanceField>
                      <FinanceField label="Оценка">{formatFinanceCurrency(row.line_total)}</FinanceField>
                    </FinanceMobileCard>
                  ))
                )}
              </div>
              <FinanceTableShell>
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Товар</th>
                      <th className="px-4 py-3 text-right font-medium">Остаток</th>
                      <th className="px-4 py-3 text-right font-medium">Цена</th>
                      <th className="px-4 py-3 text-right font-medium">Оценка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {!inventory.rows?.length ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          Нет остатков на выбранную дату
                        </td>
                      </tr>
                    ) : (
                      inventory.rows.map((row, idx) => (
                        <tr key={`${row.product_id}-${idx}`} className="hover:bg-gray-50/80">
                          <td className="px-4 py-3">{row.name || row.article || '—'}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.quantity}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatFinanceCurrency(row.unit_price)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatFinanceCurrency(row.line_total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </FinanceTableShell>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
