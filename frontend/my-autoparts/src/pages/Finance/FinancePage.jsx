import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiAxios } from '../../utils/apiClient';
import {
  CHANNEL_OPTIONS,
  buildFinanceQueryParams,
  formatFinanceCurrency,
  formatFinanceDate,
  getMonthRangeDefaults,
} from './financeDisplay';
import MobileCollapsibleFilters from '../../components/MobileCollapsibleFilters/MobileCollapsibleFilters';

const TABS = [
  { id: 'summary', label: 'Сводка' },
  { id: 'sales', label: 'Продажи' },
  { id: 'writeoffs', label: 'Списания' },
  { id: 'stock_ins', label: 'Поступления' },
  { id: 'inventory', label: 'Остатки' },
];

function KpiCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
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
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
      {children}
    </div>
  );
}

export default function FinancePage() {
  const navigate = useNavigate();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const defaults = useMemo(() => getMonthRangeDefaults(), []);

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
  const [inventory, setInventory] = useState({ rows: [], products_count: 0, total_qty: 0, total_value: 0 });

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
      setError(typeof detail === 'string' ? detail : 'Не удалось скачать XLSX');
    } finally {
      setExporting(false);
    }
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasPermission) return <Navigate to="/" replace />;

  if (!user.organization_id) {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Финансовые отчёты доступны только для учётной записи, привязанной к организации продавца.
      </div>
    );
  }

  return (
    <div className="mt-4 sm:mt-5 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="max-md:hidden text-2xl sm:text-3xl font-bold text-gray-900">Финансы</h1>
          <p className="mt-2 text-gray-600 text-sm sm:text-base max-w-2xl">
            Отчёты по данным платформы.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || loading}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 shrink-0"
        >
          {exporting ? 'Формируем файл...' : 'Скачать XLSX'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <MobileCollapsibleFilters title="Период и параметры">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="block text-sm">
            <span className="text-gray-600">Период с</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Период по</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Остатки на дату</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          {activeTab === 'sales' && (
            <label className="block text-sm">
              <span className="text-gray-600">Канал продаж</span>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {CHANNEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="mt-4 flex flex-col max-md:gap-2 sm:flex-row sm:flex-wrap gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="max-md:w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Загрузка...' : 'Обновить'}
          </button>
        </div>
        </MobileCollapsibleFilters>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && !summary ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {activeTab === 'summary' && summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <KpiCard
                  label="Продажи за период"
                  value={formatFinanceCurrency(summary.sales_total)}
                  sub={`${summary.sales_count} строк`}
                />
                <KpiCard
                  label="Поступления"
                  value={formatFinanceCurrency(summary.stock_in_value)}
                  sub={`${summary.stock_in_qty} шт.`}
                />
                <KpiCard
                  label="Остатки на дату"
                  value={formatFinanceCurrency(summary.inventory_value)}
                  sub={`${summary.inventory_products} позиций, ${summary.inventory_qty} шт.`}
                />
                <KpiCard
                  label="Списания"
                  value={String(summary.writeoffs_count)}
                  sub={`${summary.writeoffs_qty} шт.`}
                />
              </div>
              {summary.sales_by_channel && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Продажи по каналам</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Object.entries(summary.sales_by_channel).map(([key, ch]) => (
                      <div key={key} className="rounded-lg bg-gray-50 p-3 text-sm">
                        <div className="font-medium text-gray-800">{ch.label || key}</div>
                        <div className="mt-1 text-gray-600">
                          {formatFinanceCurrency(ch.total)} · {ch.count} строк
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                Итого: {formatFinanceCurrency(sales.totals?.total)} · {sales.totals?.count ?? 0} строк
              </div>
              <div className="md:hidden space-y-3">
                {!sales.rows?.length ? (
                  <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                    Нет продаж за период
                  </p>
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
                      <FinanceField label="Кол-во">{row.quantity}</FinanceField>
                      <FinanceField label="Сумма">{formatFinanceCurrency(row.line_total)}</FinanceField>
                    </FinanceMobileCard>
                  ))
                )}
              </div>
              <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Дата</th>
                      <th className="px-3 py-2">Товар</th>
                      <th className="px-3 py-2">Канал</th>
                      <th className="px-3 py-2 text-right">Кол-во</th>
                      <th className="px-3 py-2 text-right">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.rows?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                          Нет продаж за период
                        </td>
                      </tr>
                    ) : (
                      sales.rows.map((row) => (
                        <tr key={row.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatFinanceDate(row.movement_date)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">{row.name || '—'}</div>
                            <div className="text-xs text-gray-500">
                              {[row.article, row.internal_code].filter(Boolean).join(' · ')}
                            </div>
                          </td>
                          <td className="px-3 py-2">{row.channel_label}</td>
                          <td className="px-3 py-2 text-right">{row.quantity}</td>
                          <td className="px-3 py-2 text-right font-medium">
                            {formatFinanceCurrency(row.line_total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'writeoffs' && (
            <>
            <div className="md:hidden space-y-3 mb-3">
              {!writeoffs.rows?.length ? (
                <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                  Нет списаний за период
                </p>
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
            <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Дата</th>
                    <th className="px-3 py-2">Товар</th>
                    <th className="px-3 py-2 text-right">Кол-во</th>
                    <th className="px-3 py-2">Причина</th>
                  </tr>
                </thead>
                <tbody>
                  {writeoffs.rows?.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{formatFinanceDate(row.movement_date)}</td>
                      <td className="px-3 py-2">{row.name || row.article || '—'}</td>
                      <td className="px-3 py-2 text-right">{row.quantity}</td>
                      <td className="px-3 py-2 text-gray-600">{row.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          {activeTab === 'stock_ins' && (
            <>
            <div className="md:hidden space-y-3 mb-3">
              {!stockIns.rows?.length ? (
                <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                  Нет поступлений за период
                </p>
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
            <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Дата</th>
                    <th className="px-3 py-2">Товар</th>
                    <th className="px-3 py-2 text-right">Кол-во</th>
                    <th className="px-3 py-2 text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {stockIns.rows?.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{formatFinanceDate(row.created_at)}</td>
                      <td className="px-3 py-2">{row.name || row.article || '—'}</td>
                      <td className="px-3 py-2 text-right">{row.quantity}</td>
                      <td className="px-3 py-2 text-right">
                        {formatFinanceCurrency(row.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-3">
              <div className="md:hidden space-y-3">
                {!inventory.rows?.length ? (
                  <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                    Нет остатков на выбранную дату
                  </p>
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
              <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Товар</th>
                      <th className="px-3 py-2 text-right">Остаток</th>
                      <th className="px-3 py-2 text-right">Цена</th>
                      <th className="px-3 py-2 text-right">Оценка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.rows?.map((row, idx) => (
                      <tr key={`${row.product_id}-${idx}`} className="border-t border-gray-100">
                        <td className="px-3 py-2">{row.name || row.article || '—'}</td>
                        <td className="px-3 py-2 text-right">{row.quantity}</td>
                        <td className="px-3 py-2 text-right">
                          {formatFinanceCurrency(row.unit_price)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatFinanceCurrency(row.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
