import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../UI/Modal';
import { ActionsDropdownItem } from '../ActionsDropdown/ActionsDropdown';
import { formatServerDateTime, formatServerDate } from '../../utils/serverDate';
import { apiRequest } from '../../utils/apiClient';
import { Skeleton } from '../UI';
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
import {
  AUTOSERVICE_PAYMENT_METHOD_LABELS,
  paymentReceiptPrintUrl,
} from '../../utils/autoservicePaymentReceipt';

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
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  in_progress: 'bg-sky-50 text-sky-800 ring-sky-200',
  done: 'bg-violet-50 text-violet-800 ring-violet-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-200',
  review: 'bg-orange-50 text-orange-800 ring-orange-200',
  accepted: 'bg-amber-50 text-amber-800 ring-amber-200',
  ready: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  issued: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  open: 'bg-amber-50 text-amber-800 ring-amber-200',
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
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5">
            <p className="text-base font-semibold text-emerald-900">Оплата прошла успешно</p>
            <p className="mt-2 text-sm text-emerald-800">
              Принято: <span className="font-semibold tabular-nums">{formatMoney(paidAmount)} ₽</span>
            </p>
            {fullyPaid ? (
              <p className="mt-1 text-sm text-emerald-800">Заказ-наряд оплачен полностью</p>
            ) : (
              <p className="mt-1 text-sm text-emerald-800">
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
                className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Печать чека
              </button>
            ) : null}
            {fullyPaid ? (
              <button
                type="button"
                onClick={onBackToDetails}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                К заказ-наряду
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onPayMore}
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Оплатить ещё
                </button>
                <button
                  type="button"
                  onClick={onBackToDetails}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
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
          <h3 className="text-sm font-semibold text-gray-900">Оплата заказ-наряда</h3>
          <p className="mt-1 text-sm text-gray-500">
            К оплате: <span className="font-semibold tabular-nums text-gray-800">{formatMoney(remaining)} ₽</span>
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
                className={`inline-flex h-11 items-center justify-center rounded-lg border px-3 text-sm font-medium transition disabled:opacity-50 ${
                  active
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200'
                    : 'border-gray-200 bg-white text-gray-800 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <label className="block text-xs font-medium text-gray-700">
          Дата оплаты
          <input
            type="date"
            value={payDate}
            onChange={(e) => onPayDateChange(e.target.value)}
            disabled={saving}
            className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
          />
        </label>

        <label className="block text-xs font-medium text-gray-700">
          Сумма, ₽
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={remaining}
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            disabled={saving}
            className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm tabular-nums text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>
        <p className="text-sm text-gray-500">
          Останется после оплаты:{' '}
          <span className="font-semibold tabular-nums text-gray-800">{formatMoney(afterPay)} ₽</span>
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving || !canSubmit}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
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
  const setOpen = (next) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
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
        className="inline-flex max-w-full items-center rounded-full transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-wait disabled:opacity-60"
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
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{children}</dd>
    </div>
  );
}

function Section({ title, children, total }) {
  return (
    <section className="border-t border-gray-100 pt-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
        {total != null ? (
          <p className="text-xs tabular-nums text-gray-500">{total}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyLine({ children }) {
  return <p className="py-1 text-sm text-gray-400">{children}</p>;
}

function LinesTable({ columns, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="text-gray-400">
            {columns.map((col) => (
              <th key={col} className="pb-1.5 pr-3 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 text-gray-700">{children}</tbody>
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
                ? ['№', 'Название', 'Кол-во', 'Цена', 'Сумма', 'Исполнитель']
                : ['№', 'Название', 'Кол-во', 'Цена', 'Сумма']
            }
          >
            {works.map((w) => (
              <tr key={w.id || `${w.position}-${w.title}`}>
                <td className="py-1.5 pr-3 tabular-nums text-gray-500">{w.position}</td>
                <td className="py-1.5 pr-3 font-medium text-gray-900">{w.title}</td>
                <td className="py-1.5 pr-3 tabular-nums">{w.qty}</td>
                <td className="py-1.5 pr-3 tabular-nums">{formatMoney(w.unit_price)}</td>
                <td className="py-1.5 pr-3 tabular-nums">
                  {formatMoney(w.line_sum ?? lineSum(w.qty, w.unit_price))}
                </td>
                {showExecutors ? (
                  <td className="py-1.5">
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
          <LinesTable columns={['№', 'Название', 'Кол-во', 'Ед.']}>
            {parts.map((p) => (
              <tr key={p.id || `${p.position}-${p.title}`}>
                <td className="py-1.5 pr-3 tabular-nums text-gray-500">{p.position}</td>
                <td className="py-1.5 pr-3 font-medium text-gray-900">{p.title}</td>
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
                  <td className="py-1.5 pr-3 tabular-nums text-gray-500">{p.position}</td>
                  <td className="py-1.5 pr-3 font-medium text-gray-900">
                    <span>{name}</span>
                    {p.is_in_cart ? (
                      <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
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
  const [selectedPaymentIds, setSelectedPaymentIds] = useState([]);
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
    setSelectedPaymentIds([]);
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

  const openReceiptPicker = useCallback(async () => {
    setReceiptPickerOpen(true);
    const items = await loadOrderPayments();
    setSelectedPaymentIds(items.map((row) => row.id));
  }, [loadOrderPayments]);

  const handlePrintSelectedReceipts = useCallback(() => {
    if (!order?.id || selectedPaymentIds.length === 0) return;
    const url = paymentReceiptPrintUrl(order.id, selectedPaymentIds);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
    setReceiptPickerOpen(false);
  }, [order?.id, selectedPaymentIds]);

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
    'inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 md:h-10';
  const primaryBtnClass =
    'inline-flex h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 md:h-10';

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
              <h2 className="text-base font-semibold text-gray-900">
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
              <p className="text-xs text-red-600" role="alert">{statusError}</p>
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
              <Skeleton className="h-10 w-24 rounded-lg" />
              <Skeleton className="h-10 w-20 rounded-lg" />
            </div>
          </div>
        ) : order ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5 text-sm text-gray-900">
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
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Оплачено</p>
                    <p className="mt-0.5 font-semibold tabular-nums text-emerald-700">
                      {formatMoney(payment.paid)} ₽
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Осталось</p>
                    <p className="mt-0.5 font-semibold tabular-nums text-gray-900">
                      {formatMoney(payment.remaining)} ₽
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
            {completeError ? <p className="text-xs text-red-600">{completeError}</p> : null}
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
                    onClick={openReceiptPicker}
                    disabled={paymentsLoading}
                    className={secondaryBtnClass}
                  >
                    Печать чека
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
          <div className="space-y-2 rounded-xl bg-gray-50 px-3.5 py-3">
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
          onPrintReceipt={openReceiptPicker}
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
            <div className="space-y-2 rounded-xl bg-gray-50 px-3.5 py-3 text-sm">
              <p>
                <span className="font-medium text-gray-900">Комментарий клиента</span>
                <span className="mt-0.5 block whitespace-pre-wrap text-gray-700">
                  {order.client_comment?.trim() || '—'}
                </span>
              </p>
              {showExecutors ? (
                <p className="border-t border-gray-100 pt-2">
                  <span className="font-medium text-gray-900">Комментарий сотрудника</span>
                  <span className="mt-0.5 block whitespace-pre-wrap text-gray-700">
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
      title="Печать чека"
      size="sm"
      wrapperClassName="z-[120]"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Выберите операции оплаты по заказ-наряду. В документ попадут только отмеченные строки.
        </p>
        {paymentsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : paymentsError ? (
          <p className="text-sm text-red-600">{paymentsError}</p>
        ) : orderPayments.length === 0 ? (
          <p className="text-sm text-gray-500">Оплат по этому заказ-наряду пока нет.</p>
        ) : (
          <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            {paymentsByDate.map(([dateLabel, rows]) => (
              <section key={dateLabel} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {dateLabel}
                </h3>
                <div className="space-y-2">
                  {rows.map((payment) => {
                    const checked = selectedPaymentIds.includes(payment.id);
                    return (
                      <label
                        key={payment.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={checked}
                          onChange={() => {
                            setSelectedPaymentIds((prev) => (
                              checked
                                ? prev.filter((id) => id !== payment.id)
                                : [...prev, payment.id]
                            ));
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-gray-900">
                            {AUTOSERVICE_PAYMENT_METHOD_LABELS[payment.method] || payment.method}
                            {' · '}
                            <span className="tabular-nums">{formatMoney(payment.amount)} ₽</span>
                          </span>
                          <span className="mt-0.5 block text-xs text-gray-500">
                            Чек № {payment.sequential_number}
                            {formatServerDateTime(payment.created_at) !== '—'
                              ? ` · ${formatServerDateTime(payment.created_at)}`
                              : ''}
                          </span>
                        </span>
                      </label>
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
            onClick={() => setReceiptPickerOpen(false)}
            className={secondaryBtnClass}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handlePrintSelectedReceipts}
            disabled={paymentsLoading || selectedPaymentIds.length === 0}
            className={primaryBtnClass}
          >
            Печать
          </button>
        </div>
      </div>
    </Modal>
    </>
  );
}
