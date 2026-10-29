import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import Modal from '../UI/Modal';
import { ActionsDropdownItem } from '../ActionsDropdown/ActionsDropdown';
import { formatServerDateTime, formatServerDate, formatWallClockDateTime } from '../../utils/serverDate';
import { apiRequest } from '../../utils/apiClient';
import { NumericInput, Skeleton } from '../UI';
import Toast from '../UI/Toast';
import { buildActionsDropdownMenuClassName } from '../../utils/actionsDropdownPlacement';
import {
  formatShopPartQty,
  formatShopPartUnit,
  priceWithMarkup,
  shopLineSum,
  shopPartDisplayName,
  shopPartPricingOptions,
} from '../../utils/repairOrderShopPartUtils';
import { formatVatRate, orderVatRate, splitVatInclusive } from '../../utils/updDocument';
import { repairOrderNumberLabel } from '../../utils/autoserviceOrderDisplay';
import { AUTOSERVICE_PAYMENT_METHOD_LABELS } from '../../utils/autoservicePaymentReceipt';
import { normalizeVinForLookupOrNull } from '../../utils/laximoVin';

const LazyClientProfileModal = lazy(() =>
  import('./ClientProfileModals').then((m) => ({ default: m.ClientProfileModal })),
);
const LazyAddGuestVehicleModal = lazy(() =>
  import('./ClientProfileModals').then((m) => ({ default: m.AddGuestVehicleModal })),
);
const LazyEditGuestVehicleModal = lazy(() =>
  import('./ClientProfileModals').then((m) => ({ default: m.EditGuestVehicleModal })),
);
const LazyRepairOrderPrintPage = lazy(() => import('../../pages/Autoservice/RepairOrderPrintPage'));
const LazyRepairOrderUpdPrintPage = lazy(() => import('../../pages/Autoservice/RepairOrderUpdPrintPage'));
const LazyRepairOrderInvoicePrintPage = lazy(() => import('../../pages/Autoservice/RepairOrderInvoicePrintPage'));

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
  return formatWallClockDateTime(value);
}

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function vatIncluded(amount, rate) {
  return splitVatInclusive(amount, rate).vat;
}

const PAYMENT_METHODS = [
  { value: 'card', label: 'Картой' },
  { value: 'cash', label: 'Наличными' },
  { value: 'bank', label: 'Расчётный счёт' },
];

function paymentSummary(order, grandTotal) {
  const paid = Number(order?.paid_amount ?? 0);
  const remaining = Math.max(0, grandTotal - paid);
  const isPaid = remaining <= 0.005;
  return { paid, remaining, isPaid };
}

function todayDateInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function paymentReceiptLabel(payment) {
  const dateTime = formatServerDateTime(payment.paid_at || payment.created_at);
  return dateTime === '—' ? `Чек № ${payment.sequential_number}` : `Чек № ${payment.sequential_number} · ${dateTime}`;
}

function PaymentHistoryList({
  rows,
  loading = false,
  error = '',
  emptyText = 'Оплат по этому заказ-наряду пока нет.',
  onEdit,
  onCancel,
  actionsDisabled = false,
}) {
  const groups = useMemo(() => {
    const buckets = new Map();
    rows.forEach((payment) => {
      const dateKey = formatServerDate(payment.paid_at || payment.created_at) || '—';
      const bucket = buckets.get(dateKey);
      if (bucket) bucket.push(payment);
      else buckets.set(dateKey, [payment]);
    });
    return [...buckets.entries()];
  }, [rows]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-sg-sm" />
        <Skeleton className="h-10 w-full rounded-sg-sm" />
      </div>
    );
  }
  if (error) return <p className="text-sm text-danger-600">{error}</p>;
  if (rows.length === 0) return <p className="text-sm text-ink-muted">{emptyText}</p>;

  return (
    <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1 lg:max-h-[26rem]">
      {groups.map(([dateLabel, items]) => (
        <section key={dateLabel} className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{dateLabel}</h4>
          <div className="space-y-2">
            {items.map((payment) => {
              const cancelled = Boolean(payment.is_cancelled);
              return (
                <div
                  key={payment.id}
                  className={`flex items-start gap-2 rounded-sg-sm border border-line px-3 py-2.5 ${cancelled ? 'opacity-60' : ''}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium text-ink ${cancelled ? 'line-through' : ''}`}>
                      {AUTOSERVICE_PAYMENT_METHOD_LABELS[payment.method] || payment.method}
                      {' · '}
                      <span className="tabular-nums">{formatMoney(payment.amount)} ₽</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {cancelled ? 'Отменено · ' : ''}
                      {paymentReceiptLabel(payment)}
                    </span>
                  </span>
                  {cancelled ? null : (
                    <span className="flex shrink-0 items-center gap-1">
                      {onEdit ? (
                        <button
                          type="button"
                          onClick={() => onEdit(payment)}
                          disabled={actionsDisabled}
                          aria-label="Редактировать оплату"
                          title="Редактировать оплату"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-sg-sm text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                      ) : null}
                      {onCancel ? (
                        <button
                          type="button"
                          onClick={() => onCancel(payment)}
                          disabled={actionsDisabled}
                          aria-label="Отменить операцию"
                          title="Отменить операцию"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-sg-sm text-danger-600 transition hover:bg-danger-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      ) : null}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
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
  payments,
  paymentsLoading,
  paymentsError,
  onCancelPayment,
  onEditPayment,
  actionsDisabled,
}) {
  const payAmount = Number(amount) || 0;
  const afterPay = Math.max(0, Math.round((remaining - payAmount) * 100) / 100);
  const canSubmit = Boolean(method) && Boolean(payDate) && payAmount > 0 && payAmount <= remaining + 0.005;
  const fullyPaid = remaining <= 0.005;

  const panel = success ? (
    <div className="space-y-5">
      <div className="rounded-sg border border-success-100 bg-success-50 px-4 py-5 text-center">
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
      <div className="flex flex-col gap-2 sm:flex-row">
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
  ) : (
    <div className="space-y-5">
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
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
      <div className="min-w-0">{panel}</div>
      <section className="min-w-0 space-y-3 border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pt-0 lg:pl-8">
        <h3 className="text-sm font-semibold text-ink">История оплат</h3>
        <PaymentHistoryList
          rows={payments}
          loading={paymentsLoading}
          error={paymentsError}
          onEdit={onEditPayment}
          onCancel={onCancelPayment}
          actionsDisabled={actionsDisabled}
        />
      </section>
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

export function vehicleMakeModelLabel(v) {
  if (!v) return '—';
  return [v.make, v.model].filter(Boolean).join(' ') || '—';
}

export function OrderStatusBadge({ status, className = '', noRing = false }) {
  const normalized = normalizeRepairOrderStatus(status);
  const tone = STATUS_STYLES[normalized] || STATUS_STYLES[status] || STATUS_STYLES.open;
  const toneClass = noRing ? tone.replace(/\s*ring-\S+/g, '') : tone;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        noRing ? '' : 'ring-1 ring-inset'
      } ${toneClass} ${className}`}
    >
      {REPAIR_ORDER_STATUS_LABELS[normalized] || REPAIR_ORDER_STATUS_LABELS[status] || status}
    </span>
  );
}

export function buildRepairOrderStatusOptions({ status } = {}) {
  const normalized = normalizeRepairOrderStatus(status);

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
  noRing = false,
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
    return <OrderStatusBadge status={status} noRing={noRing} />;
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
        <OrderStatusBadge status={status} noRing={noRing} className={saving ? 'opacity-70' : ''} />
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
                    <div className="flex flex-col gap-0.5">
                      <span className="truncate">
                        {(w.executors || []).length
                          ? (w.executors || [])
                              .map((ex) => ex.employee?.name)
                              .filter(Boolean)
                              .join(', ') || '—'
                          : w.executor?.name || '—'}
                      </span>
                      {(w.contractors || []).map((c) => (
                        <span
                          key={`${w.id}-${c.contractor_id}`}
                          className="truncate text-warning-700"
                        >
                          {c.contractor?.name || 'Подрядчик'} · {formatMoney(c.amount)} ₽
                        </span>
                      ))}
                    </div>
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
  const worksTotal = works.reduce(
    (sum, work) => sum + lineSum(work.qty, work.unit_price),
    0,
  );
  const shopTotal = shop.reduce(
    (sum, part) => sum + (
      Number(part.line_sum) || shopLineSum(
        part.qty,
        part.unit_price,
        part.markup_percent,
        shopPartPricingOptions(part),
      )
    ),
    0,
  );
  return { worksTotal, shopTotal, grand: worksTotal + shopTotal };
}

export default function RepairOrderViewModal({
  order,
  loading = false,
  onClose,
  onEdit,
  onOrderChange,
  showExecutors = true,
  enablePayment = false,
  wrapperZIndex = null,
}) {
  const navigate = useNavigate();
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
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [printPickerOpen, setPrintPickerOpen] = useState(false);
  const [printDoc, setPrintDoc] = useState(null);
  const printOverlayRef = useRef(null);
  const [orderPayments, setOrderPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelSaving, setCancelSaving] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editMethod, setEditMethod] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [clientCardOpen, setClientCardOpen] = useState(false);
  const [clientVehicles, setClientVehicles] = useState([]);
  const [clientVehiclesLoading, setClientVehiclesLoading] = useState(false);
  const [clientEditVehicle, setClientEditVehicle] = useState(null);
  const [clientAddVehicleOpen, setClientAddVehicleOpen] = useState(false);

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
    setCompleteConfirmOpen(false);
    setPrintPickerOpen(false);
    setPrintDoc(null);
    setOrderPayments([]);
    setPaymentsError('');
    setCancelTarget(null);
    setCancelError('');
    setCancelConfirmOpen(false);
    setCancelSaving(false);
    setEditTarget(null);
    setEditError('');
    setEditSaving(false);
    setStatusPickerOpen(false);
    setClientCardOpen(false);
    setClientVehicles([]);
    setClientVehiclesLoading(false);
    setClientEditVehicle(null);
    setClientAddVehicleOpen(false);
  }, [order?.id]);

  const clientCardId = order?.client?.id || null;
  const printOpen = Boolean(printDoc && order?.id);

  useFocusTrap(printOverlayRef, {
    active: printOpen,
    onEscape: () => setPrintDoc(null),
  });

  useEffect(() => {
    if (!printOpen) return undefined;
    document.documentElement.classList.add('sg-print-doc-open');
    return () => {
      document.documentElement.classList.remove('sg-print-doc-open');
    };
  }, [printOpen]);

  const openPrintDoc = useCallback((doc) => {
    setPrintPickerOpen(false);
    setPrintDoc(doc);
  }, []);

  const loadClientVehicles = useCallback(async (clientId) => {
    if (!clientId) return;
    setClientVehiclesLoading(true);
    try {
      const data = await apiRequest(`/autoservice/garage/vehicles?client_id=${clientId}`);
      setClientVehicles(Array.isArray(data) ? data : []);
    } catch {
      setClientVehicles([]);
    } finally {
      setClientVehiclesLoading(false);
    }
  }, []);

  const openClientCard = useCallback(() => {
    if (!clientCardId) return;
    setClientCardOpen(true);
    loadClientVehicles(clientCardId);
  }, [clientCardId, loadClientVehicles]);

  const openVehicleEdit = useCallback(async () => {
    const vehicleId = order?.vehicle?.id;
    if (!vehicleId) return;
    if (clientCardId) {
      try {
        const data = await apiRequest(`/autoservice/garage/vehicles?client_id=${clientCardId}`);
        const full = (Array.isArray(data) ? data : []).find((v) => v.id === vehicleId);
        if (full) {
          setClientEditVehicle(full);
          return;
        }
      } catch {
        /* fall back to order.vehicle */
      }
    }
    setClientEditVehicle(order.vehicle);
  }, [clientCardId, order?.vehicle]);

  const handleClientVinClick = useCallback(
    async (rawVin) => {
      const vin = normalizeVinForLookupOrNull(rawVin);
      if (!vin) return;
      try {
        if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(vin);
      } catch {
        /* clipboard may be unavailable */
      }
      setClientCardOpen(false);
      onClose?.();
      navigate(`/autoparts/vin?vin=${encodeURIComponent(vin)}`);
    },
    [navigate, onClose],
  );

  const totals = order ? orderTotals(order) : null;
  const payment = order && totals ? paymentSummary(order, totals.grand) : null;
  const showPayButton = enablePayment && payment;

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

  useEffect(() => {
    if (payOpen && enablePayment && order?.id) loadOrderPayments();
  }, [payOpen, enablePayment, order?.id, loadOrderPayments]);

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

  const askCancelPayment = useCallback((payment) => {
    setCancelTarget(payment);
    setCancelError('');
    setCancelConfirmOpen(true);
  }, []);

  const handleCancelPayment = useCallback(async () => {
    if (!cancelTarget?.id) return;
    setCancelSaving(true);
    try {
      await apiRequest(`/autoservice/finance/receipts/${cancelTarget.id}`, { method: 'DELETE' });
      setCancelConfirmOpen(false);
      setCancelTarget(null);
      await loadOrderPayments();
      await reloadOrder();
    } catch (e) {
      setCancelError(e?.message || 'Не удалось отменить операцию');
    } finally {
      setCancelSaving(false);
    }
  }, [cancelTarget, loadOrderPayments, reloadOrder]);

  const askEditPayment = useCallback((payment) => {
    setEditTarget(payment);
    setEditMethod(payment.method);
    setEditAmount(String(payment.amount));
    const raw = String(payment.paid_at || payment.created_at || '').slice(0, 10);
    setEditDate(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayDateInputValue());
    setEditError('');
    setEditSaving(false);
  }, []);

  const closeEditPayment = useCallback(() => {
    setEditTarget(null);
    setEditError('');
  }, []);

  const handleEditPayment = useCallback(async () => {
    if (!editTarget?.id) return;
    const nextAmount = Number(editAmount);
    if (!editMethod || !editDate || !(nextAmount > 0)) {
      setEditError('Заполните способ, дату и сумму оплаты');
      return;
    }
    setEditSaving(true);
    try {
      await apiRequest(`/autoservice/finance/receipts/${editTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ paid_at: editDate, amount: nextAmount, method: editMethod }),
      });
      closeEditPayment();
      await loadOrderPayments();
      await reloadOrder();
    } catch (e) {
      setEditError(e?.message || 'Не удалось изменить оплату');
    } finally {
      setEditSaving(false);
    }
  }, [editTarget, editMethod, editAmount, editDate, closeEditPayment, loadOrderPayments, reloadOrder]);

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
      setCompleteConfirmOpen(false);
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
      setStatusPickerOpen(false);
      setCompleteConfirmOpen(true);
      return;
    }
    await handleAdvanceStatus(nextStatus);
  }, [handleAdvanceStatus]);

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
      await loadOrderPayments();
    } catch (e) {
      setPayError(e?.message || 'Не удалось провести оплату');
    } finally {
      setPaySaving(false);
    }
  }, [order?.id, payMethod, payAmount, payDate, onOrderChange, loadOrderPayments]);

  const handlePayMore = useCallback(() => {
    setPaySuccess(false);
    setLastPaidAmount(0);
    setPayMethod(null);
    setPayAmount(payment?.remaining ? String(payment.remaining) : '');
    setPayDate(todayDateInputValue());
    setPayError('');
  }, [payment?.remaining]);

  if (!order && !loading) return null;

  const handleClose = () => {
    setPrintPickerOpen(false);
    onClose?.();
  };

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
      onClose={handleClose}
      size="lg"
      className="max-lg:!rounded-none max-sm:h-full"
      wrapperZIndex={wrapperZIndex}
      draggable
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
                  noRing
                  onChange={handleStatusChange}
                />
              ) : (
                <OrderStatusBadge status={order.status} noRing />
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
                  В том числе НДС {formatVatRate(orderVatRate(order))}%:{' '}
                  <span className="tabular-nums">
                    {formatMoney(vatIncluded(totals.grand, orderVatRate(order)))} ₽
                  </span>
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
                    Оплата
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
              {onEdit && !payOpen && order?.status !== 'completed' && order?.status !== 'cancelled' ? (
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
          payments={orderPayments}
          paymentsLoading={paymentsLoading}
          paymentsError={paymentsError}
          onCancelPayment={askCancelPayment}
          onEditPayment={askEditPayment}
          actionsDisabled={cancelSaving || editSaving}
        />
      ) : (
        <div className="space-y-5">
          <dl className="grid gap-4 sm:grid-cols-[minmax(0,1.45fr)_minmax(0,0.9fr)]">
            <MetaItem label="Клиент">
              {order?.client?.id ? (
                <button
                  type="button"
                  onClick={openClientCard}
                  className="inline-block whitespace-nowrap font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 transition hover:text-brand-800 hover:decoration-brand-600"
                  title="Открыть карточку клиента"
                >
                  {clientLine}
                </button>
              ) : (
                <span className="inline-block whitespace-nowrap">{clientLine}</span>
              )}
            </MetaItem>
            <MetaItem label="Авто">
              {order?.vehicle?.id ? (
                <button
                  type="button"
                  onClick={openVehicleEdit}
                  className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 transition hover:text-brand-800 hover:decoration-brand-600"
                  title="Изменить автомобиль"
                >
                  {vehicleLabel(order.vehicle)}
                </button>
              ) : (
                vehicleLabel(order.vehicle)
              )}
            </MetaItem>
            <MetaItem label="Дата начала">{formatDateTime(order.scheduled_at) || '—'}</MetaItem>
            {order.inspection_scheduled_at ? (
              <MetaItem label="Дата записи на осмотр">
                <span className="text-success-700">{formatDateTime(order.inspection_scheduled_at)}</span>
              </MetaItem>
            ) : null}
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
      open={completeConfirmOpen && Boolean(order?.id)}
      onClose={() => {
        if (!completeSaving) setCompleteConfirmOpen(false);
      }}
      title="Закрыть заказ-наряд?"
    >
      <div className="space-y-5">
        <p className="text-sm text-ink-soft">
          Вы точно хотите закрыть {repairOrderNumberLabel(order)}?
          {payment?.remaining > 0.005
            ? ` Заказ оплачен не полностью. Осталось ${formatMoney(payment.remaining)} ₽.`
            : ''}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setCompleteConfirmOpen(false)}
            disabled={completeSaving}
            className={secondaryBtnClass}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleCompleteOrder}
            disabled={completeSaving}
            className={primaryBtnClass}
          >
            {completeSaving ? 'Закрытие…' : 'Да, закрыть'}
          </button>
        </div>
      </div>
    </Modal>
    <Modal
      open={printPickerOpen && Boolean(order?.id)}
      onClose={() => setPrintPickerOpen(false)}
      title="Какой документ распечатать?"
      size="sm"
      wrapperClassName="z-[120]"
    >
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className={`${secondaryBtnClass} w-full`}
          onClick={() => openPrintDoc('order')}
        >
          Заказ-наряд
        </button>
        <button
          type="button"
          className={`${secondaryBtnClass} w-full`}
          onClick={() => openPrintDoc('upd')}
        >
          УПД
        </button>
        <button type="button" disabled className={`${secondaryBtnClass} w-full cursor-not-allowed opacity-50`}>
          ТОРГ-12
        </button>
        <button
          type="button"
          className={`${secondaryBtnClass} w-full`}
          onClick={() => openPrintDoc('invoice')}
        >
          Счёт на оплату
        </button>
      </div>
    </Modal>
    <Modal
      open={Boolean(editTarget)}
      onClose={editSaving ? () => {} : closeEditPayment}
      title="Редактирование оплаты"
      size="sm"
      wrapperClassName="z-[120]"
    >
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {PAYMENT_METHODS.map((option) => {
            const active = editMethod === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={editSaving}
                onClick={() => setEditMethod(option.value)}
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
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            disabled={editSaving}
            className="sg-pill-input sg-native-date-input mt-1 w-full"
          />
        </label>

        <label className="block text-xs font-medium text-ink-soft">
          Сумма, ₽
          <NumericInput
            mode="decimal"
            min="0.01"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            disabled={editSaving}
            className="sg-pill-input mt-1 w-full"
          />
        </label>
        {editError ? <p className="text-sm text-danger-600">{editError}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={closeEditPayment}
            disabled={editSaving}
            className={secondaryBtnClass}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleEditPayment}
            disabled={editSaving}
            className={primaryBtnClass}
          >
            {editSaving ? 'Сохранение…' : 'Сохранить'}
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
        <p className="text-sm text-ink">
          Отменить оплату{' '}
          <span className="font-semibold tabular-nums">{formatMoney(cancelTarget?.amount)} ₽</span>
          {cancelTarget?.sequential_number ? (
            <span className="text-ink-muted"> · Чек № {cancelTarget.sequential_number}</span>
          ) : null}
          ?
        </p>
        <p className="text-sm text-ink-muted">Она перестанет учитываться в оплаченной сумме заказ-наряда.</p>
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
            className="inline-flex h-11 items-center justify-center rounded-sg-sm bg-danger-600 px-4 text-sm font-semibold text-white transition hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-60 md:h-10"
          >
            {cancelSaving ? 'Отмена…' : 'Да, отменить'}
          </button>
        </div>
      </div>
    </Modal>
    <Toast message={cancelError} variant="error" onClose={() => setCancelError('')} />

    <Suspense fallback={null}>
      <LazyClientProfileModal
        open={clientCardOpen && Boolean(clientCardId)}
        client={order?.client}
        vehicles={clientVehicles}
        loading={clientVehiclesLoading}
        onClose={() => setClientCardOpen(false)}
        onEditVehicle={setClientEditVehicle}
        onAddVehicle={() => setClientAddVehicleOpen(true)}
        onVinClick={handleClientVinClick}
        onSaved={(updated) => {
          if (order && updated) {
            onOrderChange?.({ ...order, client: { ...order.client, ...updated } });
          }
        }}
      />
      <LazyAddGuestVehicleModal
        open={clientAddVehicleOpen}
        clientId={clientCardId}
        onClose={() => setClientAddVehicleOpen(false)}
        onCreated={(created) => {
          if (created?.client_id) {
            setClientVehicles((prev) => [created, ...prev]);
          }
        }}
      />
      <LazyEditGuestVehicleModal
        open={Boolean(clientEditVehicle)}
        vehicle={clientEditVehicle}
        onClose={() => setClientEditVehicle(null)}
        onSaved={(updated) => {
          setClientVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
          if (order?.vehicle?.id === updated.id) {
            onOrderChange?.({ ...order, vehicle: { ...order.vehicle, ...updated } });
          }
        }}
      />
    </Suspense>
    {printOpen
      ? createPortal(
          <div
            ref={printOverlayRef}
            role="dialog"
            aria-modal="true"
            aria-label="Печать документа"
            tabIndex={-1}
            className="fixed inset-0 overflow-y-auto overscroll-contain bg-gray-100 text-black"
            style={{ zIndex: 'var(--sg-z-modal-shell)' }}
          >
            <Suspense
              fallback={<p className="p-6 text-sm text-ink-muted">Загрузка документа…</p>}
            >
              {printDoc === 'order' ? (
                <LazyRepairOrderPrintPage orderId={order.id} onClose={() => setPrintDoc(null)} />
              ) : null}
              {printDoc === 'upd' ? (
                <LazyRepairOrderUpdPrintPage orderId={order.id} onClose={() => setPrintDoc(null)} />
              ) : null}
              {printDoc === 'invoice' ? (
                <LazyRepairOrderInvoicePrintPage orderId={order.id} onClose={() => setPrintDoc(null)} />
              ) : null}
            </Suspense>
          </div>,
          document.body,
        )
      : null}
    </>
  );
}
