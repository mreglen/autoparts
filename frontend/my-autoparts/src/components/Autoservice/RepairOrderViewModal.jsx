import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../UI/Modal';
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
import { splitVatInclusive } from '../../utils/updDocument';
import { repairOrderNumberLabel } from '../../utils/autoserviceOrderDisplay';
import PayerFormModal from './PayerFormModal';
import { payerDisplayName, payerSearchText } from '../../utils/autoservicePayerRequisites';

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
  payerId,
  payerQuery,
  payers,
  payersLoading,
  payerCreating,
  saving,
  error,
  onMethodChange,
  onAmountChange,
  onPayDateChange,
  onPayerQueryChange,
  onPayerSelect,
  onPayerCreate,
  onSubmit,
}) {
  const payAmount = Number(amount) || 0;
  const afterPay = Math.max(0, Math.round((remaining - payAmount) * 100) / 100);
  const canSubmit = Boolean(method) && Boolean(payDate) && payAmount > 0 && payAmount <= remaining + 0.005;
  const queryNorm = (payerQuery || '').trim().toLowerCase();
  const filteredPayers = useMemo(() => {
    const list = Array.isArray(payers) ? payers : [];
    if (!queryNorm) return list;
    return list.filter((row) => payerSearchText(row).includes(queryNorm));
  }, [payers, queryNorm]);
  const exactMatch = (payers || []).some(
    (row) => payerSearchText(row) === queryNorm
      || String(row.display_name || payerDisplayName(row)).trim().toLowerCase() === queryNorm,
  );
  const canCreatePayer = Boolean(queryNorm) && !exactMatch;
  const [payerMenuOpen, setPayerMenuOpen] = useState(false);
  const payerRootRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (payerRootRef.current && !payerRootRef.current.contains(e.target)) {
        setPayerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

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

        <div>
          <label className="block text-xs font-medium text-gray-700">
            Плательщик
            <span className="ml-1 font-normal text-gray-400">необязательно</span>
          </label>
          <div ref={payerRootRef} className="relative mt-1">
            <input
              type="text"
              value={payerQuery}
              onChange={(e) => {
                onPayerQueryChange(e.target.value);
                setPayerMenuOpen(true);
              }}
              onFocus={() => setPayerMenuOpen(true)}
              disabled={saving || payerCreating || payersLoading}
              placeholder={payersLoading ? 'Загрузка…' : 'Введите или выберите плательщика'}
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
            />
            {payerMenuOpen && !saving && !payerCreating && !payersLoading ? (
              <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {filteredPayers.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-400">
                    {(payers || []).length === 0 ? 'Справочник пуст' : 'Ничего не найдено'}
                  </li>
                ) : (
                  filteredPayers.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
                          payerId === row.id ? 'bg-indigo-50 font-medium text-indigo-800' : 'text-gray-800'
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onPayerSelect(row);
                          setPayerMenuOpen(false);
                        }}
                      >
                        {row.display_name || payerDisplayName(row)}
                      </button>
                    </li>
                  ))
                )}
                {canCreatePayer ? (
                  <li className="sticky bottom-0 border-t border-gray-100 bg-white">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPayerMenuOpen(false);
                        onPayerCreate();
                      }}
                    >
                      Создать плательщика
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
          {payerId ? (
            <p className="mt-1 text-xs text-emerald-700">Выбран из справочника</p>
          ) : null}
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

function OrderStatusStepButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
}) {
  const className = variant === 'success'
    ? 'inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60'
    : 'inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

function OrderStatusProgress({
  status,
  enablePayment,
  payment,
  statusSaving,
  paySaving,
  onAdvanceStatus,
  onPay,
  onComplete,
}) {
  const normalized = normalizeRepairOrderStatus(status);
  if (!enablePayment || status === 'cancelled' || normalized === 'completed' || normalized === 'review') {
    return null;
  }

  const busy = statusSaving || paySaving;

  if (normalized === 'pending') {
    return (
      <OrderStatusStepButton
        disabled={busy}
        onClick={() => onAdvanceStatus('in_progress')}
      >
        {statusSaving ? 'Сохранение…' : 'В работу'}
      </OrderStatusStepButton>
    );
  }

  if (normalized === 'in_progress') {
    return (
      <OrderStatusStepButton
        disabled={busy}
        onClick={() => onAdvanceStatus('done')}
      >
        {statusSaving ? 'Сохранение…' : 'Выполнено'}
      </OrderStatusStepButton>
    );
  }

  if (normalized === 'done') {
    if (payment?.remaining > 0.005) {
      return (
        <OrderStatusStepButton disabled={busy} onClick={onPay}>
          Оплатить
        </OrderStatusStepButton>
      );
    }
    if (payment?.isPaid) {
      return (
        <OrderStatusStepButton
          variant="success"
          disabled={busy}
          onClick={onComplete}
        >
          {statusSaving ? 'Закрытие…' : 'Закрыть'}
        </OrderStatusStepButton>
      );
    }
  }

  return null;
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
  const [payPayerId, setPayPayerId] = useState(null);
  const [payPayerQuery, setPayPayerQuery] = useState('');
  const [payers, setPayers] = useState([]);
  const [payerCreateOpen, setPayerCreateOpen] = useState(false);
  const [payerCreateInitial, setPayerCreateInitial] = useState(null);
  const [payersLoading, setPayersLoading] = useState(false);
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [completeSaving, setCompleteSaving] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const [printPickerOpen, setPrintPickerOpen] = useState(false);

  useEffect(() => {
    setPayOpen(false);
    setPayMethod(null);
    setPayAmount('');
    setPayDate(todayDateInputValue());
    setPayPayerId(null);
    setPayPayerQuery('');
    setPayError('');
    setStatusError('');
    setCompleteError('');
    setPrintPickerOpen(false);
  }, [order?.id]);

  const totals = order ? orderTotals(order) : null;
  const payment = order && totals ? paymentSummary(order, totals.grand) : null;
  const normalizedStatus = order ? normalizeRepairOrderStatus(order.status) : null;
  const canPay =
    enablePayment
    && payment
    && payment.remaining > 0.005
    && normalizedStatus === 'done';

  const handlePayerQueryChange = useCallback((value) => {
    setPayPayerQuery(value);
    const query = String(value || '').trim().toLowerCase();
    const match = payers.find(
      (row) => payerSearchText(row) === query
        || String(row.display_name || payerDisplayName(row)).trim().toLowerCase() === query,
    );
    setPayPayerId(match ? match.id : null);
  }, [payers]);

  const handlePayerSelect = useCallback((row) => {
    if (!row) return;
    setPayPayerId(row.id);
    setPayPayerQuery(row.display_name || payerDisplayName(row) || '');
  }, []);

  const handlePayerCreateOpen = useCallback(() => {
    const query = payPayerQuery.trim();
    setPayerCreateInitial(query ? { name: query } : null);
    setPayerCreateOpen(true);
  }, [payPayerQuery]);

  const handlePayerCreated = useCallback((created) => {
    if (!created) return;
    setPayers((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      if (!next.some((row) => row.id === created.id)) next.push(created);
      return next.sort((a, b) => String(a.display_name || payerDisplayName(a)).localeCompare(
        String(b.display_name || payerDisplayName(b)),
        'ru',
      ));
    });
    setPayPayerId(created.id);
    setPayPayerQuery(created.display_name || payerDisplayName(created) || '');
    setPayerCreateOpen(false);
    setPayerCreateInitial(null);
  }, []);

  const loadPayers = useCallback(async () => {
    setPayersLoading(true);
    try {
      const data = await apiRequest('/autoservice/payers');
      setPayers(Array.isArray(data) ? data : []);
    } catch (e) {
      setPayers([]);
      setPayError(e?.message || 'Не удалось загрузить плательщиков');
    } finally {
      setPayersLoading(false);
    }
  }, []);

  const resetPaymentWizard = useCallback(() => {
    setPayOpen(false);
    setPayMethod(null);
    setPayAmount('');
    setPayDate(todayDateInputValue());
    setPayPayerId(null);
    setPayPayerQuery('');
    setPayError('');
  }, []);

  const handleStartPayment = useCallback(() => {
    setCompleteError('');
    setStatusError('');
    setPayOpen(true);
    setPayMethod(null);
    setPayAmount(payment?.remaining ? String(payment.remaining) : '');
    setPayDate(todayDateInputValue());
    setPayPayerId(null);
    setPayPayerQuery('');
    setPayError('');
    loadPayers();
  }, [payment?.remaining, loadPayers]);

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
      const trimmedPayer = payPayerQuery.trim();
      if (payPayerId) {
        payload.payer_id = payPayerId;
      } else if (trimmedPayer) {
        payload.payer_name = trimmedPayer;
      }
      const updated = await apiRequest(`/autoservice/repair-orders/${order.id}/payments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const updatedTotals = orderTotals(updated);
      const updatedPayment = paymentSummary(updated, updatedTotals.grand);
      if (
        normalizeRepairOrderStatus(updated.status) === 'done'
        && updatedPayment.isPaid
      ) {
        const completed = await apiRequest(`/autoservice/repair-orders/${order.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'completed' }),
        });
        onOrderChange?.(completed);
      } else {
        onOrderChange?.(updated);
      }
      resetPaymentWizard();
    } catch (e) {
      setPayError(e?.message || 'Не удалось провести оплату');
    } finally {
      setPaySaving(false);
    }
  }, [order?.id, payMethod, payAmount, payDate, payPayerId, payPayerQuery, onOrderChange, resetPaymentWizard]);

  if (!order && !loading) return null;

  const clientLine = [order?.client?.name, order?.client?.phone].filter(Boolean).join(' · ') || '—';
  const hasClientComment = Boolean(order?.client_comment?.trim());
  const hasStaffComment = Boolean(order?.staff_comment?.trim());
  const secondaryBtnClass =
    'inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 md:h-10';

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
              <OrderStatusBadge status={order.status} />
              <OrderStatusProgress
                status={order.status}
                enablePayment={enablePayment}
                payment={payment}
                statusSaving={statusSaving || completeSaving}
                paySaving={paySaving}
                onAdvanceStatus={handleAdvanceStatus}
                onPay={handleStartPayment}
                onComplete={handleCompleteOrder}
              />
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
            <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-end">
              {order?.id && showExecutors ? (
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
              {canPay && payOpen ? (
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
          payerId={payPayerId}
          payerQuery={payPayerQuery}
          payers={payers}
          payersLoading={payersLoading}
          payerCreating={payerCreateOpen}
          saving={paySaving}
          error={payError}
          onMethodChange={(value) => {
            setPayMethod(value);
            if (value && !payAmount) {
              setPayAmount(String(payment.remaining));
            }
          }}
          onAmountChange={setPayAmount}
          onPayDateChange={setPayDate}
          onPayerQueryChange={handlePayerQueryChange}
          onPayerSelect={handlePayerSelect}
          onPayerCreate={handlePayerCreateOpen}
          onSubmit={handleSubmitPayment}
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
    <PayerFormModal
      open={payerCreateOpen}
      mode="create"
      initialForm={payerCreateInitial}
      onClose={() => {
        setPayerCreateOpen(false);
        setPayerCreateInitial(null);
      }}
      onSaved={handlePayerCreated}
    />
    </>
  );
}
