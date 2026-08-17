import { useCallback, useEffect, useState } from 'react';
import Modal, { ConfirmDialog } from '../UI/Modal';
import { formatServerDateTime } from '../../utils/serverDate';
import { apiRequest } from '../../utils/apiClient';
import { Skeleton } from '../UI';
import {
  formatShopPartQty,
  formatShopPartUnit,
  priceWithMarkup,
  shopLineSum,
  shopPartDisplayName,
  shopPartPricingOptions,
} from '../../utils/repairOrderShopPartUtils';

export const REPAIR_ORDER_STATUS_LABELS = {
  pending: 'Ожидание',
  in_progress: 'В работе',
  done: 'Выполнен',
  completed: 'Завершён',
  cancelled: 'Отменён',
  accepted: 'Ожидание',
  ready: 'Завершён',
  issued: 'Завершён',
  open: 'Ожидание',
};

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  in_progress: 'bg-sky-50 text-sky-800 ring-sky-200',
  done: 'bg-violet-50 text-violet-800 ring-violet-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-200',
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
  const cents = Math.round((Number(amount) || 0) * 100);
  return Math.round((cents * 20) / 120) / 100;
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

function PaymentWizard({ remaining, method, amount, saving, error, onMethodChange, onAmountChange, onSubmit }) {
  const payAmount = Number(amount) || 0;
  const afterPay = Math.max(0, Math.round((remaining - payAmount) * 100) / 100);
  const canSubmit = Boolean(method) && payAmount > 0 && payAmount <= remaining + 0.005;

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
          Сумма, ₽
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={remaining}
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            disabled={saving}
            className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm tabular-nums text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
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
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_STYLES[status] || STATUS_STYLES.open
      } ${className}`}
    >
      {REPAIR_ORDER_STATUS_LABELS[status] || status}
    </span>
  );
}

function MetaItem({ label, children }) {
  return (
    <div className="min-w-0">
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
                  <td className="py-1.5 pr-3 font-medium text-gray-900">{name}</td>
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
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState('');
  const [completeSaving, setCompleteSaving] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelSaving, setCancelSaving] = useState(false);
  const [cancelError, setCancelError] = useState('');

  useEffect(() => {
    setPayOpen(false);
    setPayMethod(null);
    setPayAmount('');
    setPayError('');
    setCompleteError('');
    setCancelError('');
    setCancelConfirmOpen(false);
  }, [order?.id]);

  const totals = order ? orderTotals(order) : null;
  const payment = order && totals ? paymentSummary(order, totals.grand) : null;
  const canPay = enablePayment && payment && payment.remaining > 0.005 && order.status !== 'completed' && order.status !== 'cancelled';
  const canComplete =
    enablePayment &&
    payment?.isPaid &&
    order?.status !== 'completed' &&
    order?.status !== 'cancelled';
  const canCancel =
    showExecutors &&
    order?.status !== 'completed' &&
    order?.status !== 'cancelled';

  const resetPaymentWizard = useCallback(() => {
    setPayOpen(false);
    setPayMethod(null);
    setPayAmount('');
    setPayError('');
  }, []);

  const handleStartPayment = useCallback(() => {
    setCompleteError('');
    setPayOpen(true);
    setPayMethod(null);
    setPayAmount(payment?.remaining ? String(payment.remaining) : '');
    setPayError('');
  }, [payment?.remaining]);

  const handleSubmitPayment = useCallback(async () => {
    if (!order?.id || !payMethod) return;
    setPaySaving(true);
    setPayError('');
    try {
      const updated = await apiRequest(`/autoservice/repair-orders/${order.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method: payMethod, amount: Number(payAmount) }),
      });
      onOrderChange?.(updated);
      resetPaymentWizard();
    } catch (e) {
      setPayError(e?.message || 'Не удалось провести оплату');
    } finally {
      setPaySaving(false);
    }
  }, [order?.id, payMethod, payAmount, onOrderChange, resetPaymentWizard]);

  const handleCompleteOrder = useCallback(async () => {
    if (!order?.id) return;
    setCompleteSaving(true);
    setCompleteError('');
    try {
      const updated = await apiRequest(`/autoservice/repair-orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });
      onOrderChange?.(updated);
    } catch (e) {
      setCompleteError(e?.message || 'Не удалось закрыть заказ-наряд');
    } finally {
      setCompleteSaving(false);
    }
  }, [order?.id, onOrderChange]);

  const handleCancelOrder = useCallback(async () => {
    if (!order?.id) return;
    setCancelSaving(true);
    setCancelError('');
    try {
      const updated = await apiRequest(`/autoservice/repair-orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      setCancelConfirmOpen(false);
      onOrderChange?.(updated);
    } catch (e) {
      setCancelError(e?.message || 'Не удалось отменить заказ-наряд');
    } finally {
      setCancelSaving(false);
    }
  }, [order?.id, onOrderChange]);

  if (!order && !loading) return null;

  const clientLine = [order?.client?.name, order?.client?.phone].filter(Boolean).join(' · ') || '—';
  const hasClientComment = Boolean(order?.client_comment?.trim());
  const hasStaffComment = Boolean(order?.staff_comment?.trim());

  return (
    <>
    <Modal
      open={!!order || loading}
      onClose={onClose}
      size="lg"
      title={
        order ? (
          <div className="flex flex-wrap items-center gap-2.5 pr-2">
            <h2 className="text-base font-semibold text-gray-900">Заказ-наряд №{order.order_number}</h2>
            <OrderStatusBadge status={order.status} />
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
            {cancelError ? <p className="text-xs text-red-600">{cancelError}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              {canCancel && !payOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setCancelError('');
                    setCancelConfirmOpen(true);
                  }}
                  disabled={cancelSaving || paySaving || completeSaving}
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60 md:hidden"
                >
                  Отменить
                </button>
              ) : null}
              {order?.id && showExecutors ? (
                <button
                  type="button"
                  onClick={() => {
                    window.open(`/autoservice/orders/${order.id}/print`, '_blank', 'noopener,noreferrer');
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Печать (макет ещё в разработке)
                </button>
              ) : null}
              {onEdit && !payOpen ? (
                <button
                  type="button"
                  onClick={() => onEdit(order)}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Изменить
                </button>
              ) : null}
              {canPay && payOpen ? (
                <button
                  type="button"
                  onClick={resetPaymentWizard}
                  disabled={paySaving}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                >
                  Подробности
                </button>
              ) : null}
              {canPay && !payOpen ? (
                <button
                  type="button"
                  onClick={handleStartPayment}
                  disabled={paySaving || completeSaving}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  Оплата
                </button>
              ) : null}
              {canComplete && !payOpen ? (
                <button
                  type="button"
                  onClick={handleCompleteOrder}
                  disabled={completeSaving || paySaving}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {completeSaving ? 'Закрытие…' : 'Закрыть'}
                </button>
              ) : null}
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
          saving={paySaving}
          error={payError}
          onMethodChange={(value) => {
            setPayMethod(value);
            if (value && !payAmount) {
              setPayAmount(String(payment.remaining));
            }
          }}
          onAmountChange={setPayAmount}
          onSubmit={handleSubmitPayment}
        />
      ) : (
        <div className="space-y-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <MetaItem label="Клиент">{clientLine}</MetaItem>
            <MetaItem label="Авто">{vehicleLabel(order.vehicle)}</MetaItem>
            <MetaItem label="Дата">{formatDateTime(order.scheduled_at) || '—'}</MetaItem>
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
    <ConfirmDialog
      open={cancelConfirmOpen}
      onClose={() => {
        if (cancelSaving) return;
        setCancelConfirmOpen(false);
      }}
      onConfirm={handleCancelOrder}
      title="Отменить заказ-наряд?"
      message="Заказ-наряд будет переведён в статус «Отменён». Резервы запчастей будут сняты."
      confirmLabel="Отменить"
      cancelLabel="Отмена"
      danger
      loading={cancelSaving}
    />
  </>
  );
}
