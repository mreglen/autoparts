import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../UI/Modal';
import { ActionsDropdownItem } from '../ActionsDropdown/ActionsDropdown';
import { formatServerDateTime, formatServerDate } from '../../utils/serverDate';
import { apiRequest } from '../../utils/apiClient';
import { NumericInput, Skeleton } from '../UI';
import { buildActionsDropdownMenuClassName } from '../../utils/actionsDropdownPlacement';
import {
  formatShopPartQty,
  formatShopPartUnit,
  priceWithMarkup,
  shopLineSum,
  shopPartDisplayName,
  shopPartPricingOptions,
} from '../../utils/repairOrderShopPartUtils';
import { splitVatInclusive } from '../../utils/updDocument';
import { repairOrderNumberLabel } from '../../utils/autoserviceOrderDisplay';
import { AUTOSERVICE_PAYMENT_METHOD_LABELS } from '../../utils/autoservicePaymentReceipt';

export const REPAIR_ORDER_STATUS_LABELS = {
  pending: 'Ожидание',
  in_progress: 'В работе',
  done: 'Выполнен',
  completed: 'Закрыт',
  cancelled: 'Отменён',
  review: 'На проверке',
  accepted: 'Ожидание',
  ready: 'Закрыт',
  issued: 'Закрыт',
  open: 'Ожидание',
};

export function normalizeRepairOrderStatus(status) {
  if (status === 'accepted' || status === 'open') return 'pending';
  if (status === 'ready' || status === 'issued') return 'completed';
  return status;
}

const STATUS_STYLES = {
  pending: 'bg-warning-50 text-warning-700 ring-warning-100',
  in_progress: 'bg-brand-50 text-brand-700 ring-brand-100',
  done: 'bg-success-50 text-success-700 ring-success-100',
  completed: 'bg-success-100 text-success-700 ring-success-100',
  cancelled: 'bg-surface-subtle text-ink-muted ring-line',
  review: 'bg-accent-50 text-accent-700 ring-accent-100',
  accepted: 'bg-warning-50 text-warning-700 ring-warning-100',
  ready: 'bg-success-100 text-success-700 ring-success-100',
  issued: 'bg-success-100 text-success-700 ring-success-100',
  open: 'bg-warning-50 text-warning-700 ring-warning-100',
};

function formatDateTime(value) {
  return formatServerDateTime(value);
}

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function vatIncluded(amount) {
  return splitVatInclusive(amount).vat;
}

const PAYMENT_METHODS = [
  { value: 'card', label: 'Картой' },
  { value: 'cash', label: 'Наличными' },
  { value: 'bank', label: 'Расчётный счёт' },
];

function paymentSummary(order, grandTotal) {
  const paid = Number(order?.paid_amount ?? 0);
  const remaining =
    order?.remaining_amount != null
      ? Number(order.remaining_amount)
      : Math.max(0, grandTotal - paid);
  const isPaid = order?.is_paid === true || remaining <= 0.005;
  return { paid, remaining, isPaid };
}

function todayDateInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function PaymentWizard({
  remaining,
  method,
  amount,
  payDate,
  saving,
  error,
  success = false,
  paidAmount = 0,
  onMethodChange,
  onAmountChange,
  onPayDateChange,
  onSubmit,
  onPayMore,
  onBackToDetails,
  onPrintReceipt,
}) {
  if (success) {
    const fullyPaid = remaining <= 0.005;
    return (
      <div className="flex min-h-[22rem] flex-col justify-center">
        <div className="mx-auto w-full max-w-md space-y-5 text-center">
          <div className="rounded-sg border border-success-100 bg-success-50 px-4 py-5">
            <p className="text-base font-semibold text-success-700">Оплата прошла успешно</p>
            <p className="mt-2 text-sm text-success-700">
              Принято: <span className="font-semibold tabular-nums">{formatMoney(paidAmount)} ₽</span>
            </p>
            {fullyPaid ? (
              <p className="mt-1 text-sm text-success-700">Заказ-наряд оплачен полностью</p>
            ) : (
              <p className="mt-1 text-sm text-success-700">
                Осталось к оплате:{' '}
                <span className="font-semibold tabular-nums">{formatMoney(remaining)} ₽</span>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            {onPrintReceipt ? (
              <button
                type="button"
                onClick={onPrintReceipt}
                className="inline-flex h-11 items-center justify-center rounded-sg-sm border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition hover:bg-surface-muted"
              >
                История
              </button>
            ) : null}
            {fullyPaid ? (
              <button
                type="button"
                onClick={onBackToDetails}
                className="inline-flex h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                К заказ-наряду
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onPayMore}
                  className="inline-flex h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  Оплатить ещё
                </button>
                <button
                  type="button"
                  onClick={onBackToDetails}
                  className="inline-flex h-11 items-center justify-center rounded-sg-sm border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition hover:bg-surface-muted"
                >
                  К заказ-наряду
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const payAmount = Number(amount) || 0;
  const afterPay = Math.max(0, Math.round((remaining - payAmount) * 100) / 100);
  const canSubmit = Boolean(method) && Boolean(payDate) && payAmount > 0 && payAmount <= remaining + 0.005;

  return (
    <div className="flex min-h-[22rem] flex-col justify-center">
      <div className="mx-auto w-full max-w-md space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-ink">Оплата заказ-наряда</h3>
          <p className="mt-1 text-sm text-ink-muted">
            К оплате: <span className="font-semibold tabular-nums text-ink">{formatMoney(remaining)} ₽</span>
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {PAYMENT_METHODS.map((option) => {
            const active = method === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={saving}
                onClick={() => onMethodChange(option.value)}
                className={`inline-flex h-11 items-center justify-center rounded-sg-sm border px-3 text-sm font-medium transition disabled:opacity-50 ${
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-200'
                    : 'border-line bg-surface text-ink hover:border-brand-300 hover:bg-brand-50'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <label className="block text-xs font-medium text-ink-soft">
          Дата оплаты
          <input
            type="date"
            value={payDate}
            onChange={(e) => onPayDateChange(e.target.value)}
            disabled={saving}
            className="sg-pill-input sg-native-date-input mt-1 w-full"
          />
        </label>

        <label className="block text-xs font-medium text-ink-soft">
          Сумма, ₽
          <NumericInput
            mode="decimal"
            min="0.01"
            max={remaining}
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            disabled={saving}
            className="sg-pill-input mt-1 w-full"
          />
        </label>
        <p className="text-sm text-ink-muted">
          Останется после оплаты:{' '}
          <span className="font-semibold tabular-nums text-ink">{formatMoney(afterPay)} ₽</span>
        </p>
        {error ? <p className="text-sm text-danger-600">{error}</p> : null}
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving || !canSubmit}
          className="inline-flex h-11 w-full items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Оплата…' : 'Оплатить'}
        </button>
      </div>
    </div>
  );
}

function lineSum(qty, unitPrice) {
  const q = Number(qty) || 0;
  const p = Number(unitPrice) || 0;
  return Math.round(q * p * 100) / 100;
}

export function vehicleLabel(v) {
  if (!v) return '—';
  const parts = [v.make, v.model, v.year].filter(Boolean);
  const base = parts.join(' ') || 'Авто';
  if (v.plate) return `${base} (${v.plate})`;
  return base;
}

export function OrderStatusBadge({ status, className = '' }) {
  const normalized = normalizeRepairOrderStatus(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_STYLES[normalized] || STATUS_STYLES[status] || STATUS_STYLES.open
      } ${className}`}
    >
      {REPAIR_ORDER_STATUS_LABELS[normalized] || REPAIR_ORDER_STATUS_LABELS[status] || status}
    </span>
  );
}

export function buildRepairOrderStatusOptions({
  status,
  payment = null,
  enablePayment = false,
} = {}) {
  const normalized = normalizeRepairOrderStatus(status);
  const unpaid = enablePayment && payment
    ? !payment.isPaid && payment.remaining > 0.005
    : false;

  if (status === 'review') {
    return [{ value: 'cancelled', label: 'Отклонить' }];
  }

  if (normalized === 'completed' || normalized === 'cancelled') {
    return [
      { value: 'pending', label: 'Ожидание' },
      { value: 'in_progress', label: 'В работу' },
      { value: 'done', label: 'Выполнен' },
    ];
  }

  const options = [
    { value: 'pending', label: 'Ожидание' },
    { value: 'in_progress', label: 'В работу' },
    { value: 'done', label: 'Выполнен' },
    { value: 'completed', label: 'Закрыт' },
    { value: 'cancelled', label: 'Отменить' },
  ];

  if (enablePayment && unpaid) {
    return options.map((option) => (
      option.value === 'completed'
        ? {
            ...option,
            disabled: true,
            disabledTitle: 'Сначала оплатите заказ-наряд полностью',
          }
        : option
    ));
  }

  return options;
}

export function RepairOrderStatusPicker({
  status,
  options,
  disabled = false,
  saving = false,
  onChange,
  isOpen,
  onOpenChange,
  menuClassName = '',
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;
  const setOpen = useCallback((next) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }, [isControlled, onOpenChange]);
  const rootRef = useRef(null);
  const normalized = normalizeRepairOrderStatus(status);
  const available = (options || []).filter((option) => option.value !== normalized);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, setOpen]);

  if (available.length === 0) {
    return <OrderStatusBadge status={status} />;
  }

  return (
    <div ref={rootRef} className="status-picker relative inline-flex max-w-full align-middle">
      <button
        type="button"
        disabled={disabled || saving}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="inline-flex max-w-full items-center rounded-full transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:cursor-wait disabled:opacity-60"
        title="Сменить статус"
        aria-label="Сменить статус"
      >
        <OrderStatusBadge status={status} className={saving ? 'opacity-70' : ''} />
      </button>
      {open ? (
        <div className={buildActionsDropdownMenuClassName(false, `w-44 z-[120] ${menuClassName}`.trim())}>
          {available.map((option) => (
            <ActionsDropdownItem
              key={option.value}
              className="max-lg:min-h-11"
              disabled={option.disabled}
              title={option.disabled ? option.disabledTitle : undefined}
              onClick={() => {
                if (option.disabled) return;
                setOpen(false);
                onChange(option.value);
              }}
            >
              {option.label}
            </ActionsDropdownItem>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MetaItem({ label, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function Section({ title, children, total }) {
  return (
    <section className="border-t border-line-soft pt-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h3>
        {total != null ? (
          <p className="text-xs tabular-nums text-ink-muted">{total}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyLine({ children }) {
  return <p className="py-1 text-sm text-ink-faint">{children}</p>;
}

function LinesTable({ columns, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="text-ink-faint">
            {columns.map((col) => (
              <th key={col} className="pb-1.5 pr-3 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft text-ink-soft">{children}</tbody>
      </table>
    </div>
  );
}

export function OrderLinesExpand({ row, showExecutors = false }) {
  const works = row.works || [];
  const parts = row.client_parts || [];
  const shop = row.shop_parts || [];
  const worksTotal = row.works_total ?? works.reduce((s, w) => s + lineSum(w.qty, w.unit_price), 0);
  const shopTotal =
    row.shop_parts_total ??
    shop.reduce(
      (s, p) => s + (
        Number(p.line_sum) || shopLineSum(p.qty, p.unit_price, p.markup_percent, shopPartPricingOptions(p))
      ),
      0,
    );

  return (
    <div className="space-y-1">
      <Section title="Работы" total={works.length ? `${formatMoney(worksTotal)} ₽` : null}>
        {works.length === 0 ? (
          <EmptyLine>Нет работ</EmptyLine>
        ) : (
          <LinesTable
            columns={
              showExecutors
                ? ['№', 'Наименование', 'Кол-во', 'Цена', 'Сумма', 'Исполнитель']
                : ['№', 'Наименование', 'Кол-во', 'Цена', 'Сумма']
            }
          >
            {works.map((w) => (
              <tr key={w.id || `${w.position}-${w.title}`}>
                <td className="py-1.5 pr-3 tabular-nums text-ink-muted">{w.position}</td>
                <td className="py-1.5 pr-3 font-medium text-ink">{w.title}</td>
                <td className="py-1.5 pr-3 tabular-nums">{w.qty}</td>
                <td className="py-1.5 pr-3 tabular-nums">{formatMoney(w.unit_price)}</td>
                <td className="py-1.5 pr-3 tabular-nums">
                  {formatMoney(w.line_sum ?? lineSum(w.qty, w.unit_price))}
                </td>
                {showExecutors ? (
                  <td className="py-1.5 pr-5">
                    {(w.executors || []).length
                      ? (w.executors || []).map((ex) => (
                          <span key={ex.employee_id} className="mr-2 inline-block">
                            {ex.employee?.name || '—'}
                          </span>
                        ))
                      : w.executor?.name || '—'}
                  </td>
                ) : null}
              </tr>
            ))}
          </LinesTable>
        )}
      </Section>

      <Section title="Запчасти клиента">
        {parts.length === 0 ? (
          <EmptyLine>Нет запчастей клиента</EmptyLine>
        ) : (
          <LinesTable columns={['№', 'Наименование', 'Кол-во', 'Ед.']}>
            {parts.map((p) => (
              <tr key={p.id || `${p.position}-${p.title}`}>
                <td className="py-1.5 pr-3 tabular-nums text-ink-muted">{p.position}</td>
                <td className="py-1.5 pr-3 font-medium text-ink">{p.title}</td>
                <td className="py-1.5 pr-3 tabular-nums">{p.qty}</td>
                <td className="py-1.5 tabular-nums">{formatShopPartUnit(p.unit || 'pcs')}</td>
              </tr>
            ))}
          </LinesTable>
        )}
      </Section>

      <Section title="Запчасти исполнителя" total={shop.length ? `${formatMoney(shopTotal)} ₽` : null}>
        {shop.length === 0 ? (
          <EmptyLine>Нет запчастей исполнителя</EmptyLine>
        ) : (
          <LinesTable columns={['№', 'Наименование', 'Кол-во', 'Ед.', 'Цена', 'Сумма']}>
            {shop.map((p) => {
              const unitLabel = formatShopPartUnit(p.unit || 'pcs');
              const qtyLabel = formatShopPartQty(p.qty, p.unit || 'pcs');
              const name = p.display_name || shopPartDisplayName(p);
              const clientPrice = p.price_with_markup
                ?? priceWithMarkup(p.unit_price, p.markup_percent, shopPartPricingOptions(p));
              const sum = p.line_sum
                ?? shopLineSum(p.qty, p.unit_price, p.markup_percent, shopPartPricingOptions(p));
              return (
                <tr key={p.id || `${p.position}-${p.title}`}>
                  <td className="py-1.5 pr-3 tabular-nums text-ink-muted">{p.position}</td>
                  <td className="py-1.5 pr-3 font-medium text-ink">
                    <span>{name}</span>
                    {p.is_in_cart ? (
                      <span className="ml-2 inline-flex rounded-full bg-warning-100 px-2 py-0.5 text-[10px] font-medium text-warning-700">
                        В корзине
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{qtyLabel}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{unitLabel}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{formatMoney(clientPrice)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{formatMoney(sum)}</td>
                </tr>
              );
            })}
          </LinesTable>
        )}
      </Section>
    </div>
  );
}

function orderTotals(order) {
  const works = order.works || [];
  const shop = order.shop_parts || [];
  const worksTotal = order.works_total ?? works.reduce((s, w) => s + lineSum(w.qty, w.unit_price), 0);
  const shopTotal =
    order.shop_parts_total ??
    shop.reduce(
      (s, p) => s + (
        Number(p.line_sum) || shopLineSum(p.qty, p.unit_price, p.markup_percent, shopPartPricingOptions(p))
      ),
      0,
    );
  const grand = order.grand_total ?? worksTotal + shopTotal;
  return { worksTotal, shopTotal, grand };
}

export default function RepairOrderViewModal({
  order,
  loading = false,
  onClose,
  onEdit,
  onOrderChange,
  showExecutors = true,
  enablePayment = false,
}) {
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayDateInputValue);
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState(false);
  const [lastPaidAmount, setLastPaidAmount] = useState(0);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [completeSaving, setCompleteSaving] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const [printPickerOpen, setPrintPickerOpen] = useState(false);
  const [receiptPickerOpen, setReceiptPickerOpen] = useState(false);
  const [orderPayments, setOrderPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelSaving, setCancelSaving] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);

  useEffect(() => {
    setPayOpen(false);
    setPayMethod(null);
    setPayAmount('');
    setPayDate(todayDateInputValue());
    setPayError('');
    setPaySuccess(false);
    setLastPaidAmount(0);
    setStatusError('');
    setCompleteError('');
    setPrintPickerOpen(false);
    setReceiptPickerOpen(false);
    setOrderPayments([]);
    setPaymentsError('');
    setSelectedPaymentId(null);
    setCancelConfirmOpen(false);
    setCancelSaving(false);
    setStatusPickerOpen(false);
  }, [order?.id]);

  const totals = order ? orderTotals(order) : null;
  const payment = order && totals ? paymentSummary(order, totals.grand) : null;
  const showPayButton = enablePayment && payment;
  const hasPayments = enablePayment && payment && payment.paid > 0.005;

  const resetPaymentWizard = useCallback(() => {
    setPayOpen(false);
    setPayMethod(null);
    setPayAmount('');
    setPayDate(todayDateInputValue());
    setPayError('');
    setPaySuccess(false);
    setLastPaidAmount(0);
  }, []);

  const loadOrderPayments = useCallback(async () => {
    if (!order?.id) return [];
    setPaymentsLoading(true);
    setPaymentsError('');
    try {
      const data = await apiRequest(`/autoservice/repair-orders/${order.id}/payments`);
      const items = data?.items || [];
      setOrderPayments(items);
      return items;
    } catch (e) {
      setPaymentsError(e?.message || 'Не удалось загрузить операции оплаты');
      setOrderPayments([]);
      return [];
    } finally {
      setPaymentsLoading(false);
    }
  }, [order?.id]);

  const openPaymentHistory = useCallback(async () => {
    setReceiptPickerOpen(true);
    setSelectedPaymentId(null);
    await loadOrderPayments();
  }, [loadOrderPayments]);

  const reloadOrder = useCallback(async () => {
    if (!order?.id) return null;
    try {
      const updated = await apiRequest(`/autoservice/repair-orders/${order.id}`);
      onOrderChange?.(updated);
      return updated;
    } catch (e) {
      return null;
    }
  }, [order?.id, onOrderChange]);

  const handleCancelPayment = useCallback(async () => {
    if (!selectedPaymentId) return;
    setCancelSaving(true);
    setPaymentsError('');
    try {
      await apiRequest(`/autoservice/finance/receipts/${selectedPaymentId}`, { method: 'DELETE' });
      setCancelConfirmOpen(false);
      setReceiptPickerOpen(false);
      setSelectedPaymentId(null);
      await loadOrderPayments();
      await reloadOrder();
    } catch (e) {
      setPaymentsError(e?.message || 'Не удалось отменить операцию');
    } finally {
      setCancelSaving(false);
    }
  }, [selectedPaymentId, loadOrderPayments, reloadOrder]);

  const paymentsByDate = useMemo(() => {
    const groups = new Map();
    orderPayments.forEach((payment) => {
      const dateKey = formatServerDate(payment.created_at) || '—';
      const bucket = groups.get(dateKey) || [];
      bucket.push(payment);
      groups.set(dateKey, bucket);
    });
    return [...groups.entries()];
  }, [orderPayments]);

  const statusOptions = useMemo(
    () => buildRepairOrderStatusOptions({
      status: order?.status,
      payment,
      enablePayment,
    }),
    [order?.status, payment, enablePayment],
  );

  const handleStartPayment = useCallback(() => {
    setCompleteError('');
    setStatusError('');
    setPaySuccess(false);
    setLastPaidAmount(0);
    setPayOpen(true);
    setPayMethod(null);
    setPayAmount(payment?.remaining ? String(payment.remaining) : '');
    setPayDate(todayDateInputValue());
    setPayError('');
  }, [payment?.remaining]);

  const handleAdvanceStatus = useCallback(async (nextStatus) => {
    if (!order?.id) return;
    setStatusSaving(true);
    setStatusError('');
    setCompleteError('');
    try {
      const updated = await apiRequest(`/autoservice/repair-orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      onOrderChange?.(updated);
    } catch (e) {
      setStatusError(e?.message || 'Не удалось сменить статус');
    } finally {
      setStatusSaving(false);
    }
  }, [order?.id, onOrderChange]);

  const handleCompleteOrder = useCallback(async () => {
    if (!order?.id) return;
    setCompleteSaving(true);
    setStatusSaving(true);
    setCompleteError('');
    setStatusError('');
    try {
      const updated = await apiRequest(`/autoservice/repair-orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });
      onOrderChange?.(updated);
    } catch (e) {
      const message = e?.message || 'Не удалось закрыть заказ-наряд';
      setCompleteError(message);
      setStatusError(message);
    } finally {
      setCompleteSaving(false);
      setStatusSaving(false);
    }
  }, [order?.id, onOrderChange]);

  const handleStatusChange = useCallback(async (nextStatus) => {
    if (nextStatus === 'completed') {
      await handleCompleteOrder();
      return;
    }
    await handleAdvanceStatus(nextStatus);
  }, [handleAdvanceStatus, handleCompleteOrder]);

  const handleSubmitPayment = useCallback(async () => {
    if (!order?.id || !payMethod) return;
    setPaySaving(true);
    setPayError('');
    try {
      const payload = {
        method: payMethod,
        amount: Number(payAmount),
        paid_at: payDate || todayDateInputValue(),
      };
      const updated = await apiRequest(`/autoservice/repair-orders/${order.id}/payments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onOrderChange?.(updated);
      setLastPaidAmount(Number(payAmount) || 0);
      setPaySuccess(true);
      setPayMethod(null);
      setPayAmount('');
      setPayError('');
    } catch (e) {
      setPayError(e?.message || 'Не удалось провести оплату');
    } finally {
      setPaySaving(false);
    }
  }, [order?.id, payMethod, payAmount, payDate, onOrderChange]);

  const handlePayMore = useCallback(() => {
    setPaySuccess(false);
    setLastPaidAmount(0);
    setPayMethod(null);
    setPayAmount(payment?.remaining ? String(payment.remaining) : '');
    setPayDate(todayDateInputValue());
    setPayError('');
  }, [payment?.remaining]);

  if (!order && !loading) return null;

  const clientLine = [order?.client?.name, order?.client?.phone].filter(Boolean).join(' · ') || '—';
  const hasClientComment = Boolean(order?.client_comment?.trim());
  const hasStaffComment = Boolean(order?.staff_comment?.trim());
  const secondaryBtnClass =
    'inline-flex h-11 items-center justify-center rounded-sg-sm border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition hover:bg-surface-muted disabled:opacity-60 md:h-10';
  const primaryBtnClass =
    'inline-flex h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 md:h-10';

  return (
    <>
    <Modal
      open={!!order || loading}
      onClose={() => {
        setPrintPickerOpen(false);
        onClose?.();
      }}
      closeVariant="back"
      size="lg"
      className="max-lg:!rounded-none"
      title={
        order ? (
          <div className="space-y-1 pr-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-semibold text-ink">
                {order.status === 'review' ? repairOrderNumberLabel(order) : `Заказ-наряд ${repairOrderNumberLabel(order)}`}
              </h2>
              {showExecutors ? (
                <RepairOrderStatusPicker
                  status={order.status}
                  options={statusOptions}
                  saving={statusSaving || completeSaving}
                  disabled={statusSaving || completeSaving || paySaving}
                  isOpen={statusPickerOpen}
                  onOpenChange={setStatusPickerOpen}
                  onChange={handleStatusChange}
                />
              ) : (
                <OrderStatusBadge status={order.status} />
              )}
            </div>
            {statusError ? (
              <p className="text-xs text-danger-600" role="alert">{statusError}</p>
            ) : null}
          </div>
        ) : (
          'Заказ-наряд'
        )
      }
      footer={
        loading && !order ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-28" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24 rounded-sg-sm" />
              <Skeleton className="h-10 w-20 rounded-sg-sm" />
            </div>
          </div>
        ) : order ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5 text-sm text-ink">
                <p>
                  Итого заказ:{' '}
                  <span className="tabular-nums">{formatMoney(totals.grand)} ₽</span>
                </p>
                <p>
                  В том числе НДС:{' '}
                  <span className="tabular-nums">{formatMoney(vatIncluded(totals.grand))} ₽</span>
                </p>
              </div>
              {enablePayment && payment ? (
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Оплачено</p>
                    <p className="mt-0.5 font-semibold tabular-nums text-success-700">
                      {formatMoney(payment.paid)} ₽
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Осталось</p>
                    <p className="mt-0.5 font-semibold tabular-nums text-ink">
                      {formatMoney(payment.remaining)} ₽
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
            {completeError ? <p className="text-xs text-danger-600">{completeError}</p> : null}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {showPayButton && !payOpen ? (
                  <button
                    type="button"
                    onClick={handleStartPayment}
                    disabled={paySaving || statusSaving || completeSaving}
                    className={primaryBtnClass}
                  >
                    Оплатить
                  </button>
                ) : null}
                {hasPayments && !payOpen ? (
                  <button
                    type="button"
                    onClick={openPaymentHistory}
                    disabled={paymentsLoading}
                    className={secondaryBtnClass}
                  >
                    История
                  </button>
                ) : null}
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:w-auto md:flex md:flex-wrap md:justify-end">
              {order?.id && showExecutors && !payOpen ? (
                <button
                  type="button"
                  onClick={() => setPrintPickerOpen(true)}
                  className={secondaryBtnClass}
                >
                  Печать
                </button>
              ) : null}
              {onEdit && !payOpen ? (
                <button type="button" onClick={() => onEdit(order)} className={secondaryBtnClass}>
                  Изменить
                </button>
              ) : null}
              {showPayButton && payOpen && !paySuccess ? (
                <button
                  type="button"
                  onClick={resetPaymentWizard}
                  disabled={paySaving}
                  className={secondaryBtnClass}
                >
                  Подробности
                </button>
              ) : null}
              </div>
            </div>
          </div>
        ) : null
      }
    >
      {loading ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))}
          </div>
          <div className="space-y-2 rounded-sg bg-surface-muted px-3.5 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="space-y-3 pt-2">
            <Skeleton className="h-3 w-20" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : payOpen && enablePayment ? (
        <PaymentWizard
          remaining={payment.remaining}
          method={payMethod}
          amount={payAmount}
          payDate={payDate}
          saving={paySaving}
          error={payError}
          success={paySuccess}
          paidAmount={lastPaidAmount}
          onMethodChange={(value) => {
            setPayMethod(value);
            if (value && !payAmount) {
              setPayAmount(String(payment.remaining));
            }
          }}
          onAmountChange={setPayAmount}
          onPayDateChange={setPayDate}
          onSubmit={handleSubmitPayment}
          onPayMore={handlePayMore}
          onBackToDetails={resetPaymentWizard}
          onPrintReceipt={openPaymentHistory}
        />
      ) : (
        <div className="space-y-5">
          <dl className="grid gap-4 sm:grid-cols-[minmax(0,1.45fr)_minmax(0,0.9fr)]">
            <MetaItem label="Клиент">
              <span className="inline-block whitespace-nowrap">{clientLine}</span>
            </MetaItem>
            <MetaItem label="Авто">{vehicleLabel(order.vehicle)}</MetaItem>
            <MetaItem label="Дата">{formatDateTime(order.scheduled_at) || '—'}</MetaItem>
            <MetaItem label="Пробег">
              {order.mileage_km != null && order.mileage_km !== ''
                ? `${Number(order.mileage_km).toLocaleString('ru-RU')} км`
                : '—'}
            </MetaItem>
            <MetaItem label="Рабочая зона">{order.work_zone?.name || '—'}</MetaItem>
            {showExecutors ? (
              <MetaItem label="Принял">{order.accepted_by?.name || '—'}</MetaItem>
            ) : null}
          </dl>

          {(hasClientComment || hasStaffComment || showExecutors) && (
            <div className="space-y-2 rounded-sg bg-surface-muted px-3.5 py-3 text-sm">
              <p>
                <span className="font-medium text-ink">Комментарий клиента</span>
                <span className="mt-0.5 block whitespace-pre-wrap text-ink-soft">
                  {order.client_comment?.trim() || '—'}
                </span>
              </p>
              {showExecutors ? (
                <p className="border-t border-line-soft pt-2">
                  <span className="font-medium text-ink">Комментарий сотрудника</span>
                  <span className="mt-0.5 block whitespace-pre-wrap text-ink-soft">
                    {order.staff_comment?.trim() || '—'}
                  </span>
                </p>
              ) : null}
            </div>
          )}

          <OrderLinesExpand row={order} showExecutors={showExecutors} />
        </div>
      )}
    </Modal>
    <Modal
      open={printPickerOpen && Boolean(order?.id)}
      onClose={() => setPrintPickerOpen(false)}
      title="Какой документ распечатать?"
      size="sm"
      wrapperClassName="z-[120]"
    >
      <div className="flex flex-col gap-2">
        <a
          href={order?.id ? `/autoservice/orders/${order.id}/print` : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={`${secondaryBtnClass} w-full`}
          onClick={() => setPrintPickerOpen(false)}
        >
          Заказ-наряд
        </a>
        <a
          href={order?.id ? `/autoservice/orders/${order.id}/print/upd` : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={`${secondaryBtnClass} w-full`}
          onClick={() => setPrintPickerOpen(false)}
        >
          УПД
        </a>
        <button type="button" disabled className={`${secondaryBtnClass} w-full cursor-not-allowed opacity-50`}>
          ТОРГ-12
        </button>
        <a
          href={order?.id ? `/autoservice/orders/${order.id}/print/invoice` : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={`${secondaryBtnClass} w-full`}
          onClick={() => setPrintPickerOpen(false)}
        >
          Счёт на оплату
        </a>
      </div>
    </Modal>
    <Modal
      open={receiptPickerOpen && Boolean(order?.id)}
      onClose={() => setReceiptPickerOpen(false)}
      title="История"
      size="sm"
      wrapperClassName="z-[120]"
    >
      <div className="space-y-4">
        {paymentsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-sg-sm" />
            <Skeleton className="h-10 w-full rounded-sg-sm" />
          </div>
        ) : paymentsError ? (
          <p className="text-sm text-danger-600">{paymentsError}</p>
        ) : orderPayments.length === 0 ? (
          <p className="text-sm text-ink-muted">Оплат по этому заказ-наряду пока нет.</p>
        ) : (
          <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            {paymentsByDate.map(([dateLabel, rows]) => (
              <section key={dateLabel} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {dateLabel}
                </h3>
                <div className="space-y-2">
                  {rows.map((payment) => {
                    const selected = selectedPaymentId === payment.id;
                    return (
                      <button
                        key={payment.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedPaymentId(selected ? null : payment.id)}
                        className={`flex w-full items-start gap-3 rounded-sg-sm border px-3 py-2.5 text-left transition hover:bg-surface-muted ${
                          selected
                            ? 'border-brand-500 ring-1 ring-brand-500'
                            : 'border-line'
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink">
                            {AUTOSERVICE_PAYMENT_METHOD_LABELS[payment.method] || payment.method}
                            {' · '}
                            <span className="tabular-nums">{formatMoney(payment.amount)} ₽</span>
                          </span>
                          <span className="mt-0.5 block text-xs text-ink-muted">
                            Чек № {payment.sequential_number}
                            {formatServerDateTime(payment.created_at) !== '—'
                              ? ` · ${formatServerDateTime(payment.created_at)}`
                              : ''}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => (selectedPaymentId ? setCancelConfirmOpen(true) : setReceiptPickerOpen(false))}
            disabled={paymentsLoading || cancelSaving}
            className={secondaryBtnClass}
          >
            {selectedPaymentId ? 'Отменить операцию' : 'Закрыть'}
          </button>
          <button
            type="button"
            onClick={() => setReceiptPickerOpen(false)}
            disabled={paymentsLoading || cancelSaving}
            className={primaryBtnClass}
          >
            Закрыть
          </button>
        </div>
      </div>
    </Modal>
    <Modal
      open={cancelConfirmOpen}
      onClose={() => setCancelConfirmOpen(false)}
      title="Подтверждение"
      size="sm"
      wrapperClassName="z-[130]"
    >
      <div className="space-y-4">
        <p className="text-sm text-ink">Точно хотите отменить?</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setCancelConfirmOpen(false)}
            disabled={cancelSaving}
            className={secondaryBtnClass}
          >
            Нет, оставить
          </button>
          <button
            type="button"
            onClick={handleCancelPayment}
            disabled={cancelSaving}
            className={primaryBtnClass}
          >
            {cancelSaving ? 'Отмена…' : 'Да, отменить'}
          </button>
        </div>
      </div>
    </Modal>
    </>
  );
}
