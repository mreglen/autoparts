import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiAxios, apiRequest } from '../../utils/apiClient';
import {
  clampFinanceDate,
  formatFinanceCurrency,
  getFinanceTodayDate,
  getMonthRangeDefaults,
} from '../Finance/financeDisplay';
import { formatServerDateTime } from '../../utils/serverDate';
import MobileCollapsibleFilters from '../../components/MobileCollapsibleFilters/MobileCollapsibleFilters';
import {
  DataTable,
  EmptyState,
  PageHeader,
  Skeleton,
  UnderlineTabs,
} from '../../components/UI';
import {
  warehouseEmptyShellClass,
  warehousePageClass,
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import RepairOrderViewModal, {
  OrderStatusBadge,
  REPAIR_ORDER_STATUS_LABELS,
  vehicleLabel,
} from '../../components/Autoservice/RepairOrderViewModal';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';

const METHOD_LABELS = {
  card: 'Карта',
  cash: 'Наличными',
  bank: 'Расчётный счёт',
};

const ECONOMICS_STATUS_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'pending', label: 'Ожидание' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'done', label: 'Выполнен' },
  { id: 'completed', label: 'Закрыт' },
  { id: 'cancelled', label: 'Отменён' },
];

const ECONOMICS_PAYMENT_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'paid', label: 'Оплачено' },
  { id: 'partial', label: 'Частично' },
  { id: 'unpaid', label: 'Долг' },
];

const PAYMENT_STATUS_LABELS = {
  paid: 'Оплачено',
  partial: 'Частично',
  unpaid: 'Долг',
};

const tabFilterButtonClass = (active) =>
  `inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition ${
    active
      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
      : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
  }`;

const EMPTY_ECONOMICS = {
  summary: {
    count: 0,
    revenue: 0,
    parts_cost: 0,
    payroll_total: 0,
    net_profit: 0,
    paid_amount: 0,
    debt_amount: 0,
    unpaid_count: 0,
  },
  items: [],
};

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthValue(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function ReportField({ label, children }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 text-right font-medium text-gray-900 break-words">{children}</span>
    </div>
  );
}

function RepairOrderLink({ orderId, orderNumber, onOpen }) {
  if (!orderId) return orderNumber || '—';
  return (
    <button
      type="button"
      className="text-indigo-600 hover:underline"
      onClick={() => onOpen(orderId)}
    >
      № {orderNumber}
    </button>
  );
}

export default function AutoserviceReportsPage() {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const canSeePayroll = Boolean(user?.is_director);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const requestedTab = tabParam === 'payroll' || tabParam === 'economics' ? tabParam : 'payments';
  const tab = requestedTab === 'payroll' && !canSeePayroll ? 'payments' : requestedTab;

  const defaults = useMemo(() => getMonthRangeDefaults(), []);
  const todayDate = useMemo(() => getFinanceTodayDate(), []);
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [monthValue, setMonthValue] = useState(currentMonthValue);

  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState('');
  const [payments, setPayments] = useState({ total_amount: 0, count: 0, items: [] });

  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollError, setPayrollError] = useState('');
  const [payroll, setPayroll] = useState({ total: 0, employees: [] });
  const [expandedEmployeeId, setExpandedEmployeeId] = useState(null);

  const [economicsLoading, setEconomicsLoading] = useState(false);
  const [economicsError, setEconomicsError] = useState('');
  const [economics, setEconomics] = useState(EMPTY_ECONOMICS);
  const [economicsStatus, setEconomicsStatus] = useState('all');
  const [economicsPayment, setEconomicsPayment] = useState('all');
  const [economicsSearchInput, setEconomicsSearchInput] = useState('');
  const [economicsSearch, setEconomicsSearch] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [economicsExporting, setEconomicsExporting] = useState(false);

  const [viewOrder, setViewOrder] = useState(null);
  const [viewOrderLoading, setViewOrderLoading] = useState(false);
  const [viewOrderError, setViewOrderError] = useState('');

  const tabs = useMemo(() => {
    const items = [
      { id: 'payments', label: 'Платежи' },
      { id: 'economics', label: 'Экономика заказ-нарядов' },
    ];
    if (canSeePayroll) items.splice(1, 0, { id: 'payroll', label: 'Зарплаты' });
    return items;
  }, [canSeePayroll]);

  const setTab = (next) => {
    if (next === 'payroll' && canSeePayroll) {
      setSearchParams({ tab: 'payroll' });
      return;
    }
    if (next === 'economics') {
      setSearchParams({ tab: 'economics' });
      return;
    }
    setSearchParams({});
  };

  const debouncedSetEconomicsSearch = useDebouncedCallback((value) => {
    setEconomicsSearch(value.trim());
  }, 300);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    setPaymentsError('');
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      const response = await apiRequest(`/autoservice/finance/receipts?${params.toString()}`);
      setPayments(response || { total_amount: 0, count: 0, items: [] });
    } catch (e) {
      setPaymentsError(e?.message || 'Не удалось загрузить платежи');
      setPayments({ total_amount: 0, count: 0, items: [] });
    } finally {
      setPaymentsLoading(false);
    }
  }, [dateFrom, dateTo]);

  const loadPayroll = useCallback(async () => {
    if (!canSeePayroll) return;
    const parsed = parseMonthValue(monthValue);
    if (!parsed) return;
    setPayrollLoading(true);
    setPayrollError('');
    try {
      const params = new URLSearchParams({ year: String(parsed.year), month: String(parsed.month) });
      const response = await apiRequest(`/autoservice/reports/payroll?${params.toString()}`);
      setPayroll(response || { total: 0, employees: [] });
    } catch (e) {
      setPayrollError(e?.message || 'Не удалось загрузить зарплаты');
      setPayroll({ total: 0, employees: [] });
    } finally {
      setPayrollLoading(false);
    }
  }, [canSeePayroll, monthValue]);

  const loadEconomics = useCallback(async () => {
    setEconomicsLoading(true);
    setEconomicsError('');
    try {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        status: economicsStatus,
        payment: economicsPayment,
      });
      if (economicsSearch) params.set('q', economicsSearch);
      const response = await apiRequest(`/autoservice/reports/order-economics?${params.toString()}`);
      setEconomics(response || EMPTY_ECONOMICS);
    } catch (e) {
      setEconomicsError(e?.message || 'Не удалось загрузить отчёт');
      setEconomics(EMPTY_ECONOMICS);
    } finally {
      setEconomicsLoading(false);
    }
  }, [dateFrom, dateTo, economicsStatus, economicsPayment, economicsSearch]);

  const exportEconomics = useCallback(async () => {
    setEconomicsExporting(true);
    try {
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
        status: economicsStatus,
        payment: economicsPayment,
      };
      if (economicsSearch) params.q = economicsSearch;
      const response = await apiAxios.get('/autoservice/reports/order-economics.xlsx', {
        params,
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `order_economics_${dateFrom}_${dateTo}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setEconomicsError(e?.message || 'Не удалось выгрузить Excel');
    } finally {
      setEconomicsExporting(false);
    }
  }, [dateFrom, dateTo, economicsStatus, economicsPayment, economicsSearch]);

  const openOrderView = useCallback(async (orderId) => {
    setViewOrderLoading(true);
    setViewOrder(null);
    setViewOrderError('');
    try {
      const data = await apiRequest(`/autoservice/repair-orders/${orderId}`);
      setViewOrder(data);
    } catch (e) {
      setViewOrderError(e?.message || 'Не удалось загрузить заказ-наряд');
    } finally {
      setViewOrderLoading(false);
    }
  }, []);

  const handleOrderUpdated = useCallback((updated) => {
    setViewOrder(updated);
    if (tab === 'payments') {
      loadPayments();
    } else if (tab === 'economics') {
      loadEconomics();
    }
  }, [tab, loadPayments, loadEconomics]);

  useEffect(() => {
    if (tab === 'payments') loadPayments();
  }, [tab, loadPayments]);

  useEffect(() => {
    if (tab === 'payroll') {
      setExpandedEmployeeId(null);
      loadPayroll();
    }
  }, [tab, loadPayroll]);

  useEffect(() => {
    if (tab === 'economics') {
      setExpandedOrderId(null);
      loadEconomics();
    }
  }, [tab, loadEconomics]);

  useEffect(() => {
    debouncedSetEconomicsSearch(economicsSearchInput);
  }, [economicsSearchInput, debouncedSetEconomicsSearch]);

  useEffect(() => {
    if (requestedTab === 'payroll' && !canSeePayroll) {
      setSearchParams({}, { replace: true });
    }
  }, [requestedTab, canSeePayroll, setSearchParams]);

  const paymentItems = payments.items || [];
  const payrollRows = payroll.employees || [];
  const economicsItems = economics.items || [];
  const economicsSummary = economics.summary || EMPTY_ECONOMICS.summary;

  const toggleEmployeeExpand = (employeeId) => {
    setExpandedEmployeeId((prev) => (prev === employeeId ? null : employeeId));
  };

  const toggleOrderExpand = (orderId) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const payrollOrderCount = payrollRows.reduce((sum, row) => sum + Number(row.completed_orders || 0), 0);

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-6`}>
      <PageHeader
        className="mb-0"
        title="Отчёты"
        subtitle="Платежи, зарплаты и экономика заказ-нарядов"
        action={
          tab === 'payments' ? (
            <div className="text-right">
              {paymentsLoading ? (
                <Skeleton className="ml-auto h-8 w-24" />
              ) : (
                <>
                  <p className="text-2xl font-bold tabular-nums leading-none text-gray-900">
                    {formatFinanceCurrency(payments.total_amount)}
                  </p>
                  <p className="mt-1.5 text-xs text-gray-500 sm:text-sm">{payments.count ?? 0} платежей</p>
                </>
              )}
            </div>
          ) : tab === 'payroll' ? (
            <div className="text-right">
              {payrollLoading ? (
                <Skeleton className="ml-auto h-8 w-24" />
              ) : (
                <>
                  <p className="text-2xl font-bold tabular-nums leading-none text-gray-900">
                    {formatFinanceCurrency(payroll.total)}
                  </p>
                  <p className="mt-1.5 text-xs text-gray-500 sm:text-sm">к выплате за месяц</p>
                </>
              )}
            </div>
          ) : (
            <div className="text-right">
              {economicsLoading ? (
                <Skeleton className="ml-auto h-8 w-24" />
              ) : (
                <>
                  <p className="text-2xl font-bold tabular-nums leading-none text-gray-900">
                    {formatFinanceCurrency(economicsSummary.net_profit)}
                  </p>
                  <p className="mt-1.5 text-xs text-gray-500 sm:text-sm">чистая прибыль за период</p>
                </>
              )}
            </div>
          )
        }
      />

      <UnderlineTabs ariaLabel="Вкладки отчётов" tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'payments' ? (
        <>
          <MobileCollapsibleFilters title="Период">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </div>
          </MobileCollapsibleFilters>

          {paymentsError ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{paymentsError}</div>
          ) : null}

          {viewOrderError ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{viewOrderError}</div>
          ) : null}

          {paymentsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {!paymentItems.length ? (
                  <p className={`${warehouseEmptyShellClass} text-sm text-gray-500`}>
                    Нет платежей за период
                  </p>
                ) : (
                  paymentItems.map((row) => (
                    <div
                      key={`${row.sequential_number}-${row.created_at}`}
                      className="space-y-2 py-3"
                    >
                      <ReportField label="№">{row.sequential_number}</ReportField>
                      <ReportField label="Заказ-наряд">
                        <RepairOrderLink
                          orderId={row.repair_order_id}
                          orderNumber={row.repair_order_number}
                          onOpen={openOrderView}
                        />
                      </ReportField>
                      <ReportField label="Клиент">{row.client_name || '—'}</ReportField>
                      <ReportField label="Способ">{METHOD_LABELS[row.method] || row.method}</ReportField>
                      <ReportField label="Сумма">{formatFinanceCurrency(row.amount)}</ReportField>
                      <ReportField label="Дата">{formatServerDateTime(row.created_at)}</ReportField>
                    </div>
                  ))
                )}
              </div>
              <div className="hidden md:block">
                <DataTable
                  columns={[
                    { key: 'sequential_number', label: '№' },
                    {
                      key: 'repair_order_number',
                      label: 'Заказ-наряд',
                      render: (row) => (
                        <RepairOrderLink
                          orderId={row.repair_order_id}
                          orderNumber={row.repair_order_number}
                          onOpen={openOrderView}
                        />
                      ),
                    },
                    { key: 'client_name', label: 'Клиент', render: (row) => row.client_name || '—' },
                    { key: 'method', label: 'Способ', render: (row) => METHOD_LABELS[row.method] || row.method || '' },
                    { key: 'amount', label: 'Сумма', render: (row) => formatFinanceCurrency(row.amount) },
                    { key: 'created_at', label: 'Дата', render: (row) => row.created_at ? formatServerDateTime(row.created_at) : '' },
                  ]}
                  rows={paymentItems}
                  footer={{
                    sequential_number: 'Итого',
                    repair_order_number: `${payments.count ?? 0} платежей`,
                    client_name: '',
                    method: '',
                    amount: payments.total_amount,
                    created_at: '',
                  }}
                  empty={<EmptyState illustration="empty" title="Нет платежей" description="За выбранный период оплат по заказ-нарядам нет." />}
                />
              </div>
            </>
          )}
        </>
      ) : tab === 'payroll' ? (
        <>
          <label className="block max-w-xs">
            <span className="mb-1.5 block text-xs font-medium text-gray-500">Месяц</span>
            <input
              type="month"
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value || currentMonthValue())}
              className={warehousePillControlClass}
            />
          </label>

          {payrollError ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{payrollError}</div>
          ) : null}

          {viewOrderError ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{viewOrderError}</div>
          ) : null}

          {payrollLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {!payrollRows.length ? (
                  <p className={`${warehouseEmptyShellClass} text-sm text-gray-500`}>
                    Нет сотрудников для отчёта
                  </p>
                ) : (
                  <>
                    {payrollRows.map((row) => {
                      const isExpanded = expandedEmployeeId === row.employee_id;
                      const orders = row.orders || [];
                      return (
                        <div key={row.employee_id} className="border-b border-gray-200 pb-3">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 text-left"
                            aria-expanded={isExpanded}
                            onClick={() => toggleEmployeeExpand(row.employee_id)}
                          >
                            <span className="text-sm font-semibold text-gray-900">{row.name}</span>
                            <span className="shrink-0 text-sm font-medium tabular-nums text-gray-900">
                              {formatFinanceCurrency(row.total)}
                            </span>
                          </button>
                          <p className="mt-1 text-xs text-gray-500">
                            {row.completed_orders} заказ-наряд{row.completed_orders === 1 ? '' : row.completed_orders >= 2 && row.completed_orders <= 4 ? 'а' : 'ов'}
                          </p>
                          {isExpanded ? (
                            <div className="mt-3 space-y-3 pl-2">
                              {!orders.length ? (
                                <p className="text-sm text-gray-500">Нет начислений по заказ-нарядам</p>
                              ) : (
                                orders.map((order) => (
                                  <div key={order.order_id} className="space-y-1 rounded-lg bg-gray-50 px-3 py-2">
                                    <ReportField label="Заказ-наряд">
                                      <RepairOrderLink
                                        orderId={order.order_id}
                                        orderNumber={order.order_number}
                                        onOpen={openOrderView}
                                      />
                                    </ReportField>
                                    <ReportField label="Автомобиль">{vehicleLabel(order.vehicle)}</ReportField>
                                    <ReportField label="Сумма">{formatFinanceCurrency(order.amount)}</ReportField>
                                  </div>
                                ))
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    <div className="border-t border-gray-200 pt-3">
                      <ReportField label="Итого">{formatFinanceCurrency(payroll.total)}</ReportField>
                    </div>
                  </>
                )}
              </div>
              <div className="hidden md:block">
                {!payrollRows.length ? (
                  <EmptyState illustration="empty" title="Нет данных" description="За этот месяц начислений по заказ-нарядам нет." />
                ) : (
                  <div className="overflow-x-auto rounded-sg-lg border border-line bg-surface">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
                        <tr>
                          <th className="w-10 px-4 py-3 font-semibold" aria-hidden="true" />
                          <th className="px-4 py-3 font-semibold">Сотрудник</th>
                          <th className="px-4 py-3 font-semibold">Заказ-наряды</th>
                          <th className="px-4 py-3 font-semibold">Итого</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {payrollRows.map((row) => {
                          const isExpanded = expandedEmployeeId === row.employee_id;
                          const orders = row.orders || [];
                          return (
                            <Fragment key={row.employee_id}>
                              <tr className="hover:bg-surface-muted/60">
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                    aria-expanded={isExpanded}
                                    aria-label={isExpanded ? 'Свернуть детализацию' : 'Развернуть детализацию'}
                                    onClick={() => toggleEmployeeExpand(row.employee_id)}
                                  >
                                    <svg
                                      className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      aria-hidden="true"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </button>
                                </td>
                                <td className="px-4 py-3 font-medium text-ink-soft">{row.name}</td>
                                <td className="px-4 py-3 text-ink-soft">{row.completed_orders}</td>
                                <td className="px-4 py-3 tabular-nums text-ink-soft">{formatFinanceCurrency(row.total)}</td>
                              </tr>
                              {isExpanded ? (
                                <tr>
                                  <td colSpan={4} className="bg-surface-muted/40 px-4 py-3">
                                    {!orders.length ? (
                                      <p className="text-sm text-gray-500">Нет начислений по заказ-нарядам</p>
                                    ) : (
                                      <table className="min-w-full text-left text-sm">
                                        <thead>
                                          <tr className="text-xs uppercase tracking-wide text-ink-muted">
                                            <th className="pb-2 pr-4 font-semibold">Номер заказ-наряда</th>
                                            <th className="pb-2 pr-4 font-semibold">Автомобиль</th>
                                            <th className="pb-2 font-semibold">Сумма</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line/60">
                                          {orders.map((order) => (
                                            <tr key={order.order_id} className="hover:bg-surface-muted/60">
                                              <td className="py-2 pr-4">
                                                <RepairOrderLink
                                                  orderId={order.order_id}
                                                  orderNumber={order.order_number}
                                                  onOpen={openOrderView}
                                                />
                                              </td>
                                              <td className="py-2 pr-4 text-ink-soft">{vehicleLabel(order.vehicle)}</td>
                                              <td className="py-2 tabular-nums text-ink-soft">
                                                {formatFinanceCurrency(order.amount)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t border-line bg-surface-muted/60">
                        <tr>
                          <td className="px-4 py-3" />
                          <td className="px-4 py-3 font-semibold text-ink">Итого</td>
                          <td className="px-4 py-3 font-semibold text-ink">{payrollOrderCount}</td>
                          <td className="px-4 py-3 font-semibold tabular-nums text-ink">
                            {formatFinanceCurrency(payroll.total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <MobileCollapsibleFilters title="Фильтры">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              </div>
              <AutoserviceLiveSearchField
                value={economicsSearchInput}
                onChange={setEconomicsSearchInput}
                placeholder="Номер, клиент, авто, VIN, госномер"
                ariaLabel="Поиск заказ-нарядов"
              />
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">Статус</p>
                <div className={`${warehouseToolbarClass} flex-wrap`}>
                  {ECONOMICS_STATUS_FILTERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={tabFilterButtonClass(economicsStatus === item.id)}
                      onClick={() => setEconomicsStatus(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">Оплата</p>
                <div className={`${warehouseToolbarClass} flex-wrap`}>
                  {ECONOMICS_PAYMENT_FILTERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={tabFilterButtonClass(economicsPayment === item.id)}
                      onClick={() => setEconomicsPayment(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </MobileCollapsibleFilters>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              {economicsSummary.count ?? 0} заказ-наряд{economicsSummary.count === 1 ? '' : economicsSummary.count >= 2 && economicsSummary.count <= 4 ? 'а' : 'ов'} за период
            </p>
            <button
              type="button"
              onClick={exportEconomics}
              disabled={economicsExporting || economicsLoading}
              className={`${warehousePrimaryButtonClass} w-full shrink-0 sm:w-auto`}
            >
              {economicsExporting ? 'Формируем файл…' : 'Экспорт в Excel'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Выручка', value: economicsSummary.revenue },
              { label: 'Себестоимость', value: economicsSummary.parts_cost },
              { label: 'Зарплата', value: economicsSummary.payroll_total },
              { label: 'Чистая прибыль', value: economicsSummary.net_profit },
              { label: 'Долг', value: economicsSummary.debt_amount },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80"
              >
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
                  {economicsLoading ? '…' : formatFinanceCurrency(item.value)}
                </p>
              </div>
            ))}
          </div>

          {economicsError ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{economicsError}</div>
          ) : null}

          {viewOrderError ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{viewOrderError}</div>
          ) : null}

          {economicsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !economicsItems.length ? (
            <EmptyState
              illustration="empty"
              title="Нет заказ-нарядов"
              description="За выбранный период и фильтры заказ-нарядов не найдено."
            />
          ) : (
            <div className="space-y-3">
              {economicsItems.map((row) => {
                const isExpanded = expandedOrderId === row.order_id;
                return (
                  <div
                    key={row.order_id}
                    className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <RepairOrderLink
                            orderId={row.order_id}
                            orderNumber={row.order_number}
                            onOpen={openOrderView}
                          />
                          <OrderStatusBadge status={row.status} />
                          {row.is_preliminary ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                              Предварительный расчёт
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-gray-900">{row.client_name || '—'}</p>
                        <p className="text-sm text-gray-500">{vehicleLabel(row.vehicle)}</p>
                        <p className="text-xs text-gray-400">
                          {row.scheduled_at ? formatServerDateTime(row.scheduled_at) : '—'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-semibold tabular-nums text-gray-900">
                          {formatFinanceCurrency(row.grand_total)}
                        </p>
                        <p className={`mt-1 text-xs font-medium ${row.payment_status === 'unpaid' ? 'text-red-600' : 'text-gray-500'}`}>
                          {PAYMENT_STATUS_LABELS[row.payment_status] || row.payment_status}
                          {Number(row.remaining_amount) > 0 ? ` · ${formatFinanceCurrency(row.remaining_amount)}` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mt-3 flex w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"
                      aria-expanded={isExpanded}
                      onClick={() => toggleOrderExpand(row.order_id)}
                    >
                      <span>Финансовая раскладка</span>
                      <svg
                        className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    {isExpanded ? (
                      <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                        <ReportField label="Сумма заказа">{formatFinanceCurrency(row.grand_total)}</ReportField>
                        <ReportField label="Себестоимость запчастей">{formatFinanceCurrency(row.parts_cost)}</ReportField>
                        <ReportField label="Зарплата мастеру">{formatFinanceCurrency(row.payroll_total)}</ReportField>
                        <ReportField label="Чистая прибыль">{formatFinanceCurrency(row.net_profit)}</ReportField>
                        <ReportField label="Оплачено">{formatFinanceCurrency(row.paid_amount)}</ReportField>
                        <ReportField label="Долг">{formatFinanceCurrency(row.remaining_amount)}</ReportField>
                        <ReportField label="Статус">
                          {REPAIR_ORDER_STATUS_LABELS[row.status] || row.status}
                        </ReportField>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      <RepairOrderViewModal
        order={viewOrder}
        loading={viewOrderLoading}
        enablePayment
        onOrderChange={handleOrderUpdated}
        onClose={() => {
          setViewOrder(null);
          setViewOrderLoading(false);
        }}
        onEdit={(order) => {
          setViewOrder(null);
          navigate(`/autoservice/orders/${order.id}/edit`);
        }}
      />
    </div>
  );
}
