import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiRequest } from '../../utils/apiClient';
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
} from '../../utils/warehouseListUi';

const METHOD_LABELS = {
  card: 'Карта',
  cash: 'Наличными',
  bank: 'Расчётный счёт',
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

export default function AutoserviceReportsPage() {
  const user = useSelector((state) => state.auth.user);
  const canSeePayroll = Boolean(user?.is_director);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') === 'payroll' ? 'payroll' : 'payments';
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

  const tabs = useMemo(() => {
    const items = [{ id: 'payments', label: 'Платежи' }];
    if (canSeePayroll) items.push({ id: 'payroll', label: 'Зарплаты' });
    return items;
  }, [canSeePayroll]);

  const setTab = (next) => {
    if (next === 'payroll' && canSeePayroll) {
      setSearchParams({ tab: 'payroll' });
      return;
    }
    setSearchParams({});
  };

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

  useEffect(() => {
    if (tab === 'payments') loadPayments();
  }, [tab, loadPayments]);

  useEffect(() => {
    if (tab === 'payroll') loadPayroll();
  }, [tab, loadPayroll]);

  useEffect(() => {
    if (requestedTab === 'payroll' && !canSeePayroll) {
      setSearchParams({}, { replace: true });
    }
  }, [requestedTab, canSeePayroll, setSearchParams]);

  const paymentItems = payments.items || [];
  const payrollRows = payroll.employees || [];

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-6`}>
      <PageHeader
        className="mb-0"
        title="Отчёты"
        subtitle="Платежи по заказ-нарядам и зарплаты сотрудников"
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
          ) : (
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
                        <Link className="text-indigo-600 hover:underline" to={`/autoservice/orders/${row.repair_order_id}/edit`}>
                          № {row.repair_order_number}
                        </Link>
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
                        row.repair_order_id ? (
                          <Link className="text-indigo-600 hover:underline" to={`/autoservice/orders/${row.repair_order_id}/edit`}>
                            № {row.repair_order_number}
                          </Link>
                        ) : (row.repair_order_number || '')
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
      ) : (
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
                    {payrollRows.map((row) => (
                      <div key={row.employee_id} className="space-y-2 py-3">
                        <p className="text-sm font-semibold text-gray-900">{row.name}</p>
                        <ReportField label="Заказ-наряды">{row.completed_orders}</ReportField>
                        <ReportField label="С работ">{formatFinanceCurrency(row.from_works)}</ReportField>
                        {Number(row.from_daily) > 0 ? (
                          <ReportField label="Суточные">{formatFinanceCurrency(row.from_daily)}</ReportField>
                        ) : null}
                        <ReportField label="Итого">{formatFinanceCurrency(row.total)}</ReportField>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 pt-3">
                      <ReportField label="Итого">{formatFinanceCurrency(payroll.total)}</ReportField>
                    </div>
                  </>
                )}
              </div>
              <div className="hidden md:block">
                <DataTable
                  columns={[
                    { key: 'name', label: 'Сотрудник' },
                    { key: 'completed_orders', label: 'Наряды' },
                    { key: 'from_works', label: 'С работ', render: (row) => formatFinanceCurrency(row.from_works) },
                    { key: 'from_daily', label: 'Суточные', render: (row) => formatFinanceCurrency(row.from_daily) },
                    { key: 'total', label: 'Итого', render: (row) => formatFinanceCurrency(row.total) },
                  ]}
                  rows={payrollRows.map((row) => ({ ...row, id: row.employee_id }))}
                  footer={{
                    name: 'Итого',
                    completed_orders: payrollRows.reduce((sum, row) => sum + Number(row.completed_orders || 0), 0),
                    from_works: payrollRows.reduce((sum, row) => sum + Number(row.from_works || 0), 0),
                    from_daily: payrollRows.reduce((sum, row) => sum + Number(row.from_daily || 0), 0),
                    total: payroll.total,
                  }}
                  empty={<EmptyState illustration="empty" title="Нет данных" description="За этот месяц начислений по заказ-нарядам нет." />}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
