import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import PaymentPayerSelect from '../../components/Autoservice/PaymentPayerSelect';
import RepairOrderViewModal, {
  OrderStatusBadge,
  REPAIR_ORDER_STATUS_LABELS,
  vehicleLabel,
} from '../../components/Autoservice/RepairOrderViewModal';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';
import {
  formatAutoserviceWarehouseMoney,
} from '../../utils/autoserviceWarehouseUi';
import { formatShopPartUnit } from '../../utils/repairOrderShopPartUtils';

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

const EMPTY_WAREHOUSE_STOCK = {
  summary: {
    positions: 0,
    closing_value: 0,
    opening_value: 0,
    received_qty: 0,
    expensed_qty: 0,
  },
  items: [],
  is_current_month: true,
  as_of: '',
};

function warehouseStockNameParts(row) {
  const brand = String(row?.brand || '').trim();
  const article = String(row?.article || '').trim();
  const name = String(row?.name || '').trim();
  const codeLine = [brand, article].filter(Boolean).join(' ');
  if (codeLine && name && name.toLowerCase() !== codeLine.toLowerCase() && !name.toLowerCase().startsWith(`${codeLine.toLowerCase()} `)) {
    return { primary: codeLine, secondary: name };
  }
  return { primary: name || codeLine || '—', secondary: '' };
}

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
      onClick={(e) => {
        e.stopPropagation();
        onOpen(orderId);
      }}
    >
      № {orderNumber}
    </button>
  );
}

function ExpandChevron({ expanded, className = 'h-4 w-4' }) {
  return (
    <svg
      className={`${className} shrink-0 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
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
  );
}

function MonthPickerField({ label = 'Месяц', value, onChange, className }) {
  const inputRef = useRef(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        /* fallback below */
      }
    }
    input.focus();
    input.click();
  };

  return (
    <div className="block max-w-xs">
      {label ? (
        <span className="mb-1.5 block text-xs font-medium text-gray-500">{label}</span>
      ) : null}
      <input
        ref={inputRef}
        type="month"
        value={value}
        onChange={onChange}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        className={`${className} w-full cursor-pointer`}
        aria-label={label || 'Месяц'}
      />
    </div>
  );
}

export default function AutoserviceReportsPage() {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const canSeePayroll = Boolean(user?.is_director);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const requestedTab = tabParam === 'payroll' || tabParam === 'payments' || tabParam === 'warehouse-stock'
    ? tabParam
    : 'economics';
  const tab = requestedTab === 'payroll' && !canSeePayroll ? 'economics' : requestedTab;

  const defaults = useMemo(() => getMonthRangeDefaults(), []);
  const todayDate = useMemo(() => getFinanceTodayDate(), []);
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [monthValue, setMonthValue] = useState(currentMonthValue);

  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState('');
  const [payments, setPayments] = useState({ total_amount: 0, count: 0, items: [] });
  const [paymentPayers, setPaymentPayers] = useState([]);
  const [savingPayerPaymentId, setSavingPayerPaymentId] = useState(null);
  const [paymentsExporting, setPaymentsExporting] = useState(false);

  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollError, setPayrollError] = useState('');
  const [payroll, setPayroll] = useState({ total: 0, employees: [] });
  const [payrollExporting, setPayrollExporting] = useState(false);
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

  const [warehouseStockLoading, setWarehouseStockLoading] = useState(false);
  const [warehouseStockError, setWarehouseStockError] = useState('');
  const [warehouseStock, setWarehouseStock] = useState(EMPTY_WAREHOUSE_STOCK);
  const [warehouseStockSearchInput, setWarehouseStockSearchInput] = useState('');
  const [warehouseStockSearch, setWarehouseStockSearch] = useState('');
  const [warehouseStockHideZero, setWarehouseStockHideZero] = useState(true);
  const [warehouseStockExporting, setWarehouseStockExporting] = useState(false);

  const [viewOrder, setViewOrder] = useState(null);
  const [viewOrderLoading, setViewOrderLoading] = useState(false);
  const [viewOrderError, setViewOrderError] = useState('');

  const tabs = useMemo(() => {
    const items = [
      { id: 'economics', label: 'Сводная таблица' },
      { id: 'payments', label: 'Платежи' },
      { id: 'warehouse-stock', label: 'Остатки на складе' },
    ];
    if (canSeePayroll) items.splice(2, 0, { id: 'payroll', label: 'Зарплаты' });
    return items;
  }, [canSeePayroll]);

  const setTab = (next) => {
    if (next === 'payroll' && canSeePayroll) {
      setSearchParams({ tab: 'payroll' });
      return;
    }
    if (next === 'payments') {
      setSearchParams({ tab: 'payments' });
      return;
    }
    if (next === 'warehouse-stock') {
      setSearchParams({ tab: 'warehouse-stock' });
      return;
    }
    setSearchParams({});
  };

  const debouncedSetEconomicsSearch = useDebouncedCallback((value) => {
    setEconomicsSearch(value.trim());
  }, 300);

  const debouncedSetWarehouseStockSearch = useDebouncedCallback((value) => {
    setWarehouseStockSearch(value.trim());
  }, 300);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    setPaymentsError('');
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      const payerRows = await apiRequest('/autoservice/payers');
      const response = await apiRequest(`/autoservice/finance/receipts?${params.toString()}`);
      setPaymentPayers(Array.isArray(payerRows) ? payerRows : []);
      setPayments(response || { total_amount: 0, count: 0, items: [] });
    } catch (e) {
      setPaymentsError(e?.message || 'Не удалось загрузить платежи');
      setPayments({ total_amount: 0, count: 0, items: [] });
    } finally {
      setPaymentsLoading(false);
    }
  }, [dateFrom, dateTo]);

  const savePaymentPayer = useCallback(async (paymentId, payerId) => {
    setSavingPayerPaymentId(paymentId);
    setPaymentsError('');
    try {
      const updated = await apiRequest(`/autoservice/finance/receipts/${paymentId}/payer`, {
        method: 'PATCH',
        body: JSON.stringify({ payer_id: payerId }),
      });
      setPayments((prev) => ({
        ...prev,
        items: (prev.items || []).map((row) => (row.id === paymentId ? updated : row)),
      }));
    } catch (e) {
      setPaymentsError(e?.message || 'Не удалось изменить плательщика');
    } finally {
      setSavingPayerPaymentId(null);
    }
  }, []);

  const exportPayments = useCallback(async () => {
    setPaymentsExporting(true);
    try {
      const response = await apiAxios.get('/autoservice/finance/receipts.xlsx', {
        params: { date_from: dateFrom, date_to: dateTo },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `autoservice_payments_${dateFrom}_${dateTo}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setPaymentsError(e?.message || 'Не удалось выгрузить Excel');
    } finally {
      setPaymentsExporting(false);
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

  const exportPayroll = useCallback(async () => {
    const parsed = parseMonthValue(monthValue);
    if (!parsed) return;
    setPayrollExporting(true);
    try {
      const response = await apiAxios.get('/autoservice/reports/payroll.xlsx', {
        params: { year: parsed.year, month: parsed.month },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payroll_${parsed.year}_${String(parsed.month).padStart(2, '0')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setPayrollError(e?.message || 'Не удалось выгрузить Excel');
    } finally {
      setPayrollExporting(false);
    }
  }, [monthValue]);

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

  const loadWarehouseStock = useCallback(async () => {
    const parsed = parseMonthValue(monthValue);
    if (!parsed) return;
    setWarehouseStockLoading(true);
    setWarehouseStockError('');
    try {
      const params = new URLSearchParams({
        year: String(parsed.year),
        month: String(parsed.month),
        hide_zero: warehouseStockHideZero ? 'true' : 'false',
      });
      if (warehouseStockSearch) params.set('q', warehouseStockSearch);
      const response = await apiRequest(`/autoservice/reports/warehouse-stock?${params.toString()}`);
      setWarehouseStock(response || EMPTY_WAREHOUSE_STOCK);
    } catch (e) {
      setWarehouseStockError(e?.message || 'Не удалось загрузить остатки');
      setWarehouseStock(EMPTY_WAREHOUSE_STOCK);
    } finally {
      setWarehouseStockLoading(false);
    }
  }, [monthValue, warehouseStockHideZero, warehouseStockSearch]);

  const exportWarehouseStock = useCallback(async () => {
    const parsed = parseMonthValue(monthValue);
    if (!parsed) return;
    setWarehouseStockExporting(true);
    try {
      const params = {
        year: parsed.year,
        month: parsed.month,
        hide_zero: warehouseStockHideZero,
      };
      if (warehouseStockSearch) params.q = warehouseStockSearch;
      const response = await apiAxios.get('/autoservice/reports/warehouse-stock.xlsx', {
        params,
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `warehouse_stock_${parsed.year}_${String(parsed.month).padStart(2, '0')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setWarehouseStockError(e?.message || 'Не удалось выгрузить Excel');
    } finally {
      setWarehouseStockExporting(false);
    }
  }, [monthValue, warehouseStockHideZero, warehouseStockSearch]);

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
    if (tab === 'warehouse-stock') {
      loadWarehouseStock();
    }
  }, [tab, loadWarehouseStock]);

  useEffect(() => {
    debouncedSetEconomicsSearch(economicsSearchInput);
  }, [economicsSearchInput, debouncedSetEconomicsSearch]);

  useEffect(() => {
    debouncedSetWarehouseStockSearch(warehouseStockSearchInput);
  }, [warehouseStockSearchInput, debouncedSetWarehouseStockSearch]);

  useEffect(() => {
    if (requestedTab === 'payroll' && !canSeePayroll) {
      setSearchParams({}, { replace: true });
    }
  }, [requestedTab, canSeePayroll, setSearchParams]);

  const paymentItems = payments.items || [];
  const payrollRows = payroll.employees || [];
  const economicsItems = economics.items || [];
  const economicsSummary = economics.summary || EMPTY_ECONOMICS.summary;
  const warehouseStockItems = warehouseStock.items || [];
  const warehouseStockSummary = warehouseStock.summary || EMPTY_WAREHOUSE_STOCK.summary;

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
        subtitle="Сводная таблица, платежи, зарплаты и остатки склада"
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
          ) : tab === 'economics' ? (
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
          ) : tab === 'warehouse-stock' ? (
            <div className="text-right">
              {warehouseStockLoading ? (
                <Skeleton className="ml-auto h-8 w-24" />
              ) : (
                <>
                  <p className="text-2xl font-bold tabular-nums leading-none text-gray-900">
                    {formatAutoserviceWarehouseMoney(warehouseStockSummary.closing_value)}
                  </p>
                  <p className="mt-1.5 text-xs text-gray-500 sm:text-sm">
                    {warehouseStockSummary.positions ?? 0} позиций на конец месяца
                  </p>
                </>
              )}
            </div>
          ) : null
        }
      />

      <UnderlineTabs ariaLabel="Вкладки отчётов" tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'payments' ? (
        <>
          <MobileCollapsibleFilters title="Период">
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              {payments.count ?? 0} платеж{(payments.count ?? 0) === 1 ? '' : (payments.count ?? 0) >= 2 && (payments.count ?? 0) <= 4 ? 'а' : 'ей'} за период
            </p>
            <button
              type="button"
              onClick={exportPayments}
              disabled={paymentsExporting || paymentsLoading}
              className={`${warehousePrimaryButtonClass} w-full shrink-0 sm:w-auto`}
            >
              {paymentsExporting ? 'Формируем файл…' : 'Экспорт в Excel'}
            </button>
          </div>

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
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="shrink-0 text-gray-500">Плательщик</span>
                        <PaymentPayerSelect
                          row={row}
                          payers={paymentPayers}
                          saving={savingPayerPaymentId === row.id}
                          onSave={savePaymentPayer}
                          className="min-w-0"
                        />
                      </div>
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
                    {
                      key: 'payer_name',
                      label: 'Плательщик',
                      render: (row) => (
                        <PaymentPayerSelect
                          row={row}
                          payers={paymentPayers}
                          saving={savingPayerPaymentId === row.id}
                          onSave={savePaymentPayer}
                        />
                      ),
                    },
                    { key: 'method', label: 'Способ', render: (row) => METHOD_LABELS[row.method] || row.method || '' },
                    { key: 'amount', label: 'Сумма', render: (row) => formatFinanceCurrency(row.amount) },
                    { key: 'created_at', label: 'Дата', render: (row) => row.created_at ? formatServerDateTime(row.created_at) : '' },
                  ]}
                  rows={paymentItems}
                  footer={{
                    sequential_number: 'Итого',
                    repair_order_number: `${payments.count ?? 0} платежей`,
                    payer_name: '',
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <MonthPickerField
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value || currentMonthValue())}
              className={warehousePillControlClass}
            />
            <button
              type="button"
              onClick={exportPayroll}
              disabled={payrollExporting || payrollLoading}
              className={`${warehousePrimaryButtonClass} w-full shrink-0 sm:w-auto`}
            >
              {payrollExporting ? 'Формируем файл…' : 'Экспорт в Excel'}
            </button>
          </div>

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
                            className="flex w-full items-start gap-2 text-left"
                            aria-expanded={isExpanded}
                            onClick={() => toggleEmployeeExpand(row.employee_id)}
                          >
                            <ExpandChevron expanded={isExpanded} className="mt-0.5 h-4 w-4" />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-gray-900">{row.name}</span>
                                <span className="shrink-0 text-sm font-medium tabular-nums text-gray-900">
                                  {formatFinanceCurrency(row.total)}
                                </span>
                              </span>
                              <span className="mt-1 block text-xs text-gray-500">
                                {row.completed_orders} заказ-наряд{row.completed_orders === 1 ? '' : row.completed_orders >= 2 && row.completed_orders <= 4 ? 'а' : 'ов'}
                              </span>
                            </span>
                          </button>
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
                              <tr
                                className="cursor-pointer hover:bg-surface-muted/60"
                                onClick={() => toggleEmployeeExpand(row.employee_id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleEmployeeExpand(row.employee_id);
                                  }
                                }}
                                tabIndex={0}
                                role="button"
                                aria-expanded={isExpanded}
                                aria-label={`${row.name}, ${formatFinanceCurrency(row.total)}`}
                              >
                                <td className="px-4 py-3">
                                  <ExpandChevron expanded={isExpanded} />
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
      ) : tab === 'economics' ? (
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
                    className="cursor-pointer rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 transition hover:bg-gray-50/80"
                    onClick={() => toggleOrderExpand(row.order_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleOrderExpand(row.order_id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <ExpandChevron expanded={isExpanded} className="h-4 w-4" />
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
      ) : (
        <>
          <MobileCollapsibleFilters title="Фильтры">
            <div className="space-y-4">
              <MonthPickerField
                value={monthValue}
                onChange={(e) => setMonthValue(e.target.value || currentMonthValue())}
                className={warehousePillControlClass}
              />
              <AutoserviceLiveSearchField
                value={warehouseStockSearchInput}
                onChange={setWarehouseStockSearchInput}
                placeholder="Бренд, артикул, наименование"
                loading={warehouseStockLoading}
              />
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={warehouseStockHideZero}
                  onChange={(e) => setWarehouseStockHideZero(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Скрыть нулевые остатки
              </label>
            </div>
          </MobileCollapsibleFilters>

          <div className={`${warehouseToolbarClass} flex-wrap`}>
            <p className="text-sm text-gray-600">
              {warehouseStockItems.length} позиц{warehouseStockItems.length === 1 ? 'ия' : warehouseStockItems.length >= 2 && warehouseStockItems.length <= 4 ? 'ии' : 'ий'}
              {warehouseStock.as_of ? ` · на ${warehouseStock.as_of}` : ''}
            </p>
            <button
              type="button"
              className={warehousePrimaryButtonClass}
              disabled={warehouseStockExporting || warehouseStockLoading}
              onClick={exportWarehouseStock}
            >
              {warehouseStockExporting ? 'Формируем файл…' : 'Экспорт в Excel'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Позиций с остатком', value: warehouseStockSummary.positions },
              { label: 'Приход за месяц', value: warehouseStockSummary.received_qty },
              { label: 'Расход за месяц', value: warehouseStockSummary.expensed_qty },
              { label: 'Сумма на начало', value: formatAutoserviceWarehouseMoney(warehouseStockSummary.opening_value) },
            ].map((item) => (
              <div key={item.label} className="rounded-sg-lg border border-line bg-surface px-4 py-3">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
                  {warehouseStockLoading ? '…' : item.value}
                </p>
              </div>
            ))}
          </div>

          {warehouseStockError ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{warehouseStockError}</div>
          ) : null}

          {warehouseStockLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !warehouseStockItems.length ? (
            <EmptyState
              illustration="empty"
              title="Нет данных"
              description="За выбранный месяц позиций с остатком не найдено."
            />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {warehouseStockItems.map((row) => {
                  const { primary, secondary } = warehouseStockNameParts(row);
                  return (
                    <div key={row.id} className="rounded-sg-lg border border-line bg-surface px-3 py-3">
                      <p className="text-sm font-semibold text-gray-900">{primary}</p>
                      {secondary ? <p className="mt-0.5 text-xs text-gray-500">{secondary}</p> : null}
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <ReportField label="Остаток">{row.closing_qty} {formatShopPartUnit(row.unit)}</ReportField>
                        <ReportField label="Сумма">{formatAutoserviceWarehouseMoney(row.stock_amount)}</ReportField>
                        {warehouseStock.is_current_month ? (
                          <>
                            <ReportField label="Резерв">{row.reserved_qty ?? '—'}</ReportField>
                            <ReportField label="Доступно">{row.available_qty ?? '—'}</ReportField>
                          </>
                        ) : null}
                        <ReportField label="Приход">{row.received_qty}</ReportField>
                        <ReportField label="Расход">{row.expensed_qty}</ReportField>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto rounded-sg-lg border border-line bg-surface">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Наименование</th>
                      <th className="px-4 py-3 font-semibold">Ед.</th>
                      <th className="px-4 py-3 font-semibold">Остаток на конец</th>
                      {warehouseStock.is_current_month ? (
                        <>
                          <th className="px-4 py-3 font-semibold">Резерв</th>
                          <th className="px-4 py-3 font-semibold">Доступно</th>
                        </>
                      ) : null}
                      <th className="px-4 py-3 font-semibold">Цена</th>
                      <th className="px-4 py-3 font-semibold">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {warehouseStockItems.map((row) => {
                      const { primary, secondary } = warehouseStockNameParts(row);
                      return (
                        <tr key={row.id} className="align-top hover:bg-surface-muted/60">
                          <td className="px-4 py-3">
                            <p className="font-medium text-ink">{primary}</p>
                            {secondary ? <p className="mt-0.5 text-xs text-ink-muted">{secondary}</p> : null}
                          </td>
                          <td className="px-4 py-3 tabular-nums">{formatShopPartUnit(row.unit)}</td>
                          <td className="px-4 py-3 tabular-nums">{row.closing_qty}</td>
                          {warehouseStock.is_current_month ? (
                            <>
                              <td className="px-4 py-3 tabular-nums">{row.reserved_qty ?? '—'}</td>
                              <td className="px-4 py-3 tabular-nums">{row.available_qty ?? '—'}</td>
                            </>
                          ) : null}
                          <td className="px-4 py-3 tabular-nums">{formatAutoserviceWarehouseMoney(row.unit_price)}</td>
                          <td className="px-4 py-3 tabular-nums font-medium">{formatAutoserviceWarehouseMoney(row.stock_amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!warehouseStock.is_current_month ? (
            <p className="text-xs text-gray-500">
              Для прошлых месяцев резерв и доступно не рассчитываются — показан фактический остаток на последний день месяца.
            </p>
          ) : null}
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
