import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/apiClient';
import { formatFinanceCurrency } from '../Finance/financeDisplay';
import { Skeleton } from '../../components/UI';
import { vehicleLabel } from '../../components/Autoservice/RepairOrderViewModal';
import {
  warehouseEmptyShellClass,
  warehousePageClass,
  warehousePillControlClass,
} from '../../utils/warehouseListUi';

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthValue(value) {
  const [yearRaw, monthRaw] = String(value || '').split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month) return null;
  return { year, month };
}

function formatMonthLabel(value) {
  const parsed = parseMonthValue(value);
  if (!parsed) return '';
  const date = new Date(parsed.year, parsed.month - 1, 1);
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function formatSalaryTerms(data) {
  if (!data) return '—';
  if (data.salary_type === 'fixed') {
    return `Фикс · ${formatFinanceCurrency(data.salary_amount)}`;
  }
  if (data.salary_type === 'daily_rate') {
    return `Сменная ставка · ${formatFinanceCurrency(data.salary_amount)}`;
  }
  return `% от работ · ${Number(data.work_percent || 0)}%`;
}

function ordersWord(count) {
  if (count === 1) return 'заказ-наряд';
  if (count >= 2 && count <= 4) return 'заказ-наряда';
  return 'заказ-нарядов';
}

function ExpandChevron({ expanded, className = 'h-4 w-4 text-gray-500' }) {
  return (
    <svg
      className={`${className} transition-transform ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function SummaryField({ label, children }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums text-gray-900 sm:text-xl">{children}</div>
    </div>
  );
}

function WorkRow({ work }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm">
      <div className="font-medium text-gray-900">{work.title}</div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        <span>{work.accrual_type_label}</span>
        {work.percent != null ? <span>{work.percent}%</span> : null}
        {work.line_total != null ? <span>Работа: {formatFinanceCurrency(work.line_total)}</span> : null}
        <span className="font-medium text-gray-900">Начислено: {formatFinanceCurrency(work.amount)}</span>
      </div>
    </div>
  );
}

export default function AutoserviceMyPayrollPage() {
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const monthInputRef = useRef(null);

  const openMonthPicker = useCallback((event) => {
    const input = monthInputRef.current;
    if (!input || typeof input.showPicker !== 'function') return;
    event?.preventDefault();
    try {
      input.showPicker();
    } catch {
      /* native picker already open or not allowed */
    }
  }, []);

  const parsedMonth = useMemo(() => parseMonthValue(monthValue), [monthValue]);

  const load = useCallback(async () => {
    if (!parsedMonth) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        year: String(parsedMonth.year),
        month: String(parsedMonth.month),
      });
      const response = await apiRequest(`/autoservice/my/payroll?${params.toString()}`);
      setData(response || null);
      setExpandedOrderId(null);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить зарплату');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [parsedMonth]);

  useEffect(() => {
    load();
  }, [load]);

  const orders = data?.orders || [];
  const showDaily = Number(data?.from_daily || 0) > 0;
  const showFixed = Number(data?.from_fixed || 0) > 0;

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-4`}>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Зарплата</h1>
          {data ? (
            <p className="mt-1 text-sm text-gray-600">
              {data.name}
              {data.position ? ` · ${data.position}` : ''}
              {' · '}
              {formatSalaryTerms(data)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-600">Ваши начисления и история работ</p>
          )}
        </div>
        <label className="block min-w-[11rem] shrink-0">
          <span className="mb-1.5 block text-xs font-medium text-gray-500">Месяц</span>
          <span className="relative block">
            <span
              className={`${warehousePillControlClass} pointer-events-none flex items-center justify-between gap-2 pr-3 capitalize`}
              aria-hidden="true"
            >
              {formatMonthLabel(monthValue)}
              <svg className="h-4 w-4 shrink-0 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </span>
            <input
              ref={monthInputRef}
              type="month"
              value={monthValue}
              max={currentMonthValue()}
              onChange={(e) => setMonthValue(e.target.value || currentMonthValue())}
              onPointerDown={openMonthPicker}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  openMonthPicker(e);
                }
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Месяц"
            />
          </span>
        </label>
      </div>

      {error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryField label="Итого за месяц">{formatFinanceCurrency(data.total)}</SummaryField>
            <SummaryField label="От работ">{formatFinanceCurrency(data.from_works)}</SummaryField>
            {showDaily ? (
              <SummaryField label="Сменные">{formatFinanceCurrency(data.from_daily)}</SummaryField>
            ) : null}
            {showFixed ? (
              <SummaryField label="Фикс">{formatFinanceCurrency(data.from_fixed)}</SummaryField>
            ) : null}
            <SummaryField label="Заказ-наряды">{data.completed_orders ?? 0}</SummaryField>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">
                История за {formatMonthLabel(monthValue)}
              </h2>
              <p className="text-sm text-gray-500">
                {orders.length} {ordersWord(orders.length)}
              </p>
            </div>

            {!orders.length ? (
              <p className={`${warehouseEmptyShellClass} mt-4 text-sm text-gray-500`}>
                За этот месяц начислений нет
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {orders.map((order) => {
                  const isExpanded = expandedOrderId === order.order_id;
                  const works = order.works || [];
                  return (
                    <div key={order.order_id} className="rounded-2xl ring-1 ring-gray-200/80">
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 px-4 py-3 text-left"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.order_id)}
                      >
                        <ExpandChevron expanded={isExpanded} className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <Link
                              to={`/autoservice/orders/${order.order_id}/edit`}
                              className="text-sm font-semibold text-indigo-700 hover:text-indigo-800"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Заказ-наряд № {order.order_number}
                            </Link>
                            <span className="text-sm font-medium tabular-nums text-gray-900">
                              {formatFinanceCurrency(order.amount)}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">
                            {vehicleLabel(order.vehicle) || 'Автомобиль не указан'}
                            {works.length ? ` · ${works.length} работ${works.length === 1 ? 'а' : works.length >= 2 && works.length <= 4 ? 'ы' : ''}` : ''}
                          </span>
                        </span>
                      </button>
                      {isExpanded ? (
                        <div className="space-y-2 border-t border-gray-100 px-4 py-3">
                          {!works.length ? (
                            <p className="text-sm text-gray-500">Нет детализации по работам</p>
                          ) : (
                            works.map((work, index) => (
                              <WorkRow key={`${order.order_id}-${work.work_id || work.accrual_type}-${index}`} work={work} />
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
