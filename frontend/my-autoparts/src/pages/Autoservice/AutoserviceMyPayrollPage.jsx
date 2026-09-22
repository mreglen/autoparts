import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import { formatFinanceCurrency } from '../Finance/financeDisplay';
import { Skeleton } from '../../components/UI';
import Modal from '../../components/UI/Modal';
import RepairOrderViewModal, { vehicleLabel } from '../../components/Autoservice/RepairOrderViewModal';
import {
  autoserviceListErrorClass,
  autoserviceListHeaderSubtitleClass,
  autoserviceListHeaderTitleClass,
  autoserviceListPrimaryButtonClass,
  warehouseEmptyShellClass,
  warehousePageClass,
  warehousePillControlClass,
  warehouseSecondaryButtonClass,
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

function SummaryField({ label, children }) {
  return (
    <div className="rounded-sg border border-line bg-surface p-4">
      <div className="text-xs font-medium text-ink-muted">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums text-ink sm:text-xl">{children}</div>
    </div>
  );
}

function WorkRow({ work }) {
  return (
    <div className="rounded-sg bg-surface-muted px-3 py-2 text-sm">
      <div className="font-medium text-ink">{work.title}</div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span>{work.accrual_type_label}</span>
        {work.percent != null ? <span>{work.percent}%</span> : null}
        {work.line_total != null ? <span>Работа: {formatFinanceCurrency(work.line_total)}</span> : null}
        <span className="font-medium text-ink">Начислено: {formatFinanceCurrency(work.amount)}</span>
      </div>
    </div>
  );
}

function PayrollOrderRow({ order, onOpen }) {
  const works = order.works || [];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full border-b border-line-soft py-2 text-left last:border-b-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-ink">Заказ-наряд № {order.order_number}</span>
        <span className="font-medium tabular-nums text-ink">
          {formatFinanceCurrency(order.amount)}
        </span>
      </div>
      <p className="mt-0.5 truncate text-xs text-ink-muted">
        {vehicleLabel(order.vehicle) || 'Автомобиль не указан'}
        {works.length ? ` · ${works.length} работ${works.length === 1 ? 'а' : works.length >= 2 && works.length <= 4 ? 'ы' : ''}` : ''}
      </p>
    </button>
  );
}

export default function AutoserviceMyPayrollPage() {
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);
  const [fullOrder, setFullOrder] = useState(null);
  const [fullOrderLoading, setFullOrderLoading] = useState(false);
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
      setViewOrder(null);
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

  const openRepairOrder = useCallback(async (orderId) => {
    if (!orderId) return;
    setFullOrderLoading(true);
    try {
      const order = await apiRequest(`/autoservice/repair-orders/${orderId}`);
      setViewOrder(null);
      setFullOrder(order);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить заказ-наряд');
    } finally {
      setFullOrderLoading(false);
    }
  }, []);

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-4`}>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={autoserviceListHeaderTitleClass}>Зарплата</h1>
          {data ? (
            <p className={autoserviceListHeaderSubtitleClass}>
              {data.name}
              {data.position ? ` · ${data.position}` : ''}
              {' · '}
              {formatSalaryTerms(data)}
            </p>
          ) : (
            <p className={autoserviceListHeaderSubtitleClass}>Ваши начисления и история работ</p>
          )}
        </div>
        <label className="block min-w-[11rem] shrink-0">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Месяц</span>
          <span className="relative block">
            <span
              className={`${warehousePillControlClass} pointer-events-none flex items-center justify-between gap-2 pr-3 capitalize`}
              aria-hidden="true"
            >
              {formatMonthLabel(monthValue)}
              <svg className="h-4 w-4 shrink-0 text-ink-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <div className={autoserviceListErrorClass} role="alert">
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

          <div className="rounded-sg border border-line bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                История за {formatMonthLabel(monthValue)}
              </h2>
              <p className="text-sm text-ink-muted">
                {orders.length} {ordersWord(orders.length)}
              </p>
            </div>

            {!orders.length ? (
              <p className={`${warehouseEmptyShellClass} mt-4 text-sm text-ink-muted`}>
                За этот месяц начислений нет
              </p>
            ) : (
              <div className="mt-2">
                {orders.map((order) => (
                  <PayrollOrderRow
                    key={order.order_id}
                    order={order}
                    onOpen={() => setViewOrder(order)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      <Modal
        open={Boolean(viewOrder)}
        onClose={() => setViewOrder(null)}
        title={viewOrder ? `Заказ-наряд № ${viewOrder.order_number}` : 'Заказ-наряд'}
        size="md"
        draggable
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setViewOrder(null)} className={warehouseSecondaryButtonClass}>
              Закрыть
            </button>
            {viewOrder?.order_id ? (
              <button
                type="button"
                onClick={() => openRepairOrder(viewOrder.order_id)}
                disabled={fullOrderLoading}
                className={autoserviceListPrimaryButtonClass}
              >
                {fullOrderLoading ? 'Открытие…' : 'Открыть заказ-наряд'}
              </button>
            ) : null}
          </div>
        }
      >
        {viewOrder ? (
          <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Автомобиль</dt>
                <dd className="mt-1 text-sm font-medium text-ink">
                  {vehicleLabel(viewOrder.vehicle) || '—'}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Начислено</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-ink">
                  {formatFinanceCurrency(viewOrder.amount)}
                </dd>
              </div>
            </dl>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Работы</h3>
              {!(viewOrder.works || []).length ? (
                <p className="mt-2 text-sm text-ink-muted">Нет детализации по работам</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {(viewOrder.works || []).map((work, index) => (
                    <WorkRow
                      key={`${viewOrder.order_id}-${work.work_id || work.accrual_type}-${index}`}
                      work={work}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <RepairOrderViewModal
        order={fullOrder}
        loading={fullOrderLoading && !fullOrder}
        onClose={() => setFullOrder(null)}
        onOrderChange={setFullOrder}
      />
    </div>
  );
}
