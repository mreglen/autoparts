import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import {
  clampFinanceDate,
  formatFinanceCurrency,
  getFinanceTodayDate,
  getMonthRangeDefaults,
} from '../Finance/financeDisplay';
import { formatServerDateTime } from '../../utils/serverDate';
import MobileCollapsibleFilters from '../../components/MobileCollapsibleFilters/MobileCollapsibleFilters';
import { Button, ConfirmDialog, Modal, Skeleton } from '../../components/UI';
import RepairOrderViewModal from '../../components/Autoservice/RepairOrderViewModal';
import Toast from '../../components/UI/Toast';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import {
  FINANCE_METHOD_LABELS,
} from '../../utils/financeReceiptSearch';
import {
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTbodyClass,
  autoserviceListTdClass,
  autoserviceListThClass,
  autoserviceListTheadRowClass,
  autoserviceListTrClickableClass,
  warehouseEmptyShellClass,
  warehousePillControlClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';

const ALL_METHODS = [
  { id: 'all', label: 'Все' },
  { id: 'card', label: 'Карта' },
  { id: 'cash', label: 'Наличные' },
  { id: 'bank', label: 'Расчётный счёт' },
];

const METHOD_COLORS = {
  card: 'bg-blue-50 text-blue-700',
  cash: 'bg-green-50 text-green-700',
  bank: 'bg-amber-50 text-amber-700',
};

function MethodSegmentedFilter({ methods, selected, onChange }) {
  const containerRef = useRef(null);
  const [thumb, setThumb] = useState(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const active = container?.querySelector('[data-selected="true"]');
    if (!active) {
      setThumb(null);
      return;
    }
    setThumb({
      left: active.offsetLeft,
      top: active.offsetTop,
      width: active.offsetWidth,
      height: active.offsetHeight,
    });
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, selected]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return (
    <div ref={containerRef} className={`${warehouseToolbarClass} relative`}>
      {thumb ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full bg-surface shadow-sm ring-1 ring-line transition-all duration-200 ease-out"
          style={{
            left: thumb.left,
            top: thumb.top,
            width: thumb.width,
            height: thumb.height,
          }}
        />
      ) : null}
      {methods.map((method) => {
        const active = selected === method.id;
        return (
          <button
            key={method.id}
            type="button"
            data-selected={active || undefined}
            onClick={() => onChange(method.id)}
            className={`relative z-10 inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition ${
              active ? 'text-ink' : 'text-ink-muted hover:bg-surface/60 hover:text-ink'
            }`}
          >
            {method.label}
          </button>
        );
      })}
    </div>
  );
}

function receiptsWord(count) {
  if (count === 1) return 'поступление';
  if (count >= 2 && count <= 4) return 'поступления';
  return 'поступлений';
}

function MethodBadge({ method }) {
  const label = FINANCE_METHOD_LABELS[method] || method || '—';
  const colorClass = METHOD_COLORS[method] || 'bg-surface-subtle text-ink-soft';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${colorClass}`}>
      {label}
    </span>
  );
}

function FinanceField({ label, children }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <span className="min-w-0 text-right font-medium text-ink break-words">{children}</span>
    </div>
  );
}

const paymentDateInputClass =
  'sg-pill-input sg-native-date-input w-full min-w-[9.5rem] disabled:cursor-wait disabled:opacity-60';

function PaymentReceiptDateField({ row, todayDate, saving, onSave }) {
  const [draft, setDraft] = useState(() => {
    const d = new Date(row.created_at);
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    const d = new Date(row.created_at);
    setDraft(d.toISOString().slice(0, 10));
  }, [row.created_at, row.id]);

  const handleChange = async (nextValue) => {
    const clamped = clampFinanceDate(nextValue, todayDate);
    setDraft(clamped);
    const current = new Date(row.created_at).toISOString().slice(0, 10);
    if (!clamped || clamped === current) return;
    await onSave(row.id, clamped);
  };

  return (
    <input
      type="date"
      className={paymentDateInputClass}
      value={draft}
      max={todayDate}
      disabled={saving}
      onChange={(e) => handleChange(e.target.value)}
      aria-label={`Дата поступления № ${row.sequential_number}`}
    />
  );
}

function FinanceReceiptRows({ rows, onOpen, onOpenOrder, emptyText = 'Нет поступлений за период' }) {
  if (!rows.length) {
    return (
      <p className={`${warehouseEmptyShellClass} text-sm text-ink-muted`}>
        {emptyText}
      </p>
    );
  }

  return (
    <>
      <div className="md:hidden divide-y divide-line-soft">
        {rows.map((row) => (
          <div
            role="button"
            tabIndex={0}
            key={row.id}
            onClick={() => onOpen(row)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(row); }}
            className="block w-full cursor-pointer space-y-1.5 py-3 text-left transition hover:bg-surface-muted/50"
          >
            <FinanceField label="Дата">{formatServerDateTime(row.created_at)}</FinanceField>
            <FinanceField label="Клиент">{row.client_name || '—'}</FinanceField>
            <FinanceField label="Способ"><MethodBadge method={row.method} /></FinanceField>
            <FinanceField label="Сумма">{formatFinanceCurrency(row.amount)}</FinanceField>
            <FinanceField label="Документ">
              {row.repair_order_number ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenOrder?.(row.repair_order_id);
                  }}
                  className="font-medium text-brand-600 hover:underline"
                >
                  Заказ-наряд № {row.repair_order_number}
                </button>
              ) : '—'}
            </FinanceField>
          </div>
        ))}
      </div>

      <div className={autoserviceListTableWrapClass}>
        <table className={autoserviceListTableClass}>
          <thead>
            <tr className={autoserviceListTheadRowClass}>
              <th className={`w-[15%] ${autoserviceListThClass} text-center`}>Дата</th>
              <th className={`w-[30%] ${autoserviceListThClass} text-center`}>Клиент</th>
              <th className={`w-[20%] ${autoserviceListThClass} text-center`}>Способ оплаты</th>
              <th className={`w-[15%] ${autoserviceListThClass} text-center`}>Сумма</th>
              <th className={`w-[20%] ${autoserviceListThClass} text-center`}>Документ</th>
            </tr>
          </thead>
          <tbody className={autoserviceListTbodyClass}>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={autoserviceListTrClickableClass}
                onClick={() => onOpen(row)}
              >
                <td className={`${autoserviceListTdClass} whitespace-nowrap text-center text-ink-muted`}>
                  {formatServerDateTime(row.created_at)}
                </td>
                <td className={`${autoserviceListTdClass} truncate text-center`}>
                  {row.client_name || '—'}
                </td>
                <td className={`${autoserviceListTdClass} text-center`}>
                  <MethodBadge method={row.method} />
                </td>
                <td className={`${autoserviceListTdClass} text-center font-semibold tabular-nums`}>
                  {formatFinanceCurrency(row.amount)}
                </td>
                <td className={`${autoserviceListTdClass} text-center tabular-nums`}>
                  {row.repair_order_number ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenOrder?.(row.repair_order_id);
                      }}
                      className="cursor-pointer border-0 bg-transparent p-0 font-medium text-brand-600 hover:underline"
                    >
                      Заказ-наряд № {row.repair_order_number}
                    </button>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AutoserviceFinancePage() {
  const defaults = useMemo(() => getMonthRangeDefaults(), []);
  const todayDate = useMemo(() => getFinanceTodayDate(), []);
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ totals: {}, total_amount: 0, count: 0, items: [] });
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [savingPaymentId, setSavingPaymentId] = useState(null);
  const [detailsPayment, setDetailsPayment] = useState(null);
  const [deletePayment, setDeletePayment] = useState(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState(null);
  const [viewRepairOrder, setViewRepairOrder] = useState(null);
  const [viewRepairOrderLoading, setViewRepairOrderLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      const response = await apiRequest(`/autoservice/finance/receipts?${params.toString()}`);
      setData(response || { totals: {}, total_amount: 0, count: 0, items: [] });
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить поступления');
      setData({ totals: {}, total_amount: 0, count: 0, items: [] });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/autoservice/finance') {
        load();
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [load]);

  const handlePaymentDateSave = async (paymentId, paidAt) => {
    setSavingPaymentId(paymentId);
    setError('');
    try {
      const updated = await apiRequest(`/autoservice/finance/receipts/${paymentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ paid_at: paidAt }),
      });
      setDetailsPayment((prev) => (prev && prev.id === paymentId ? { ...prev, ...updated } : prev));
      await load();
    } catch (e) {
      setError(e?.message || 'Не удалось изменить дату поступления');
    } finally {
      setSavingPaymentId(null);
    }
  };

  const handleDeletePaymentConfirm = async () => {
    if (!deletePayment) return;
    setDeletingPaymentId(deletePayment.id);
    setError('');
    try {
      await apiRequest(`/autoservice/finance/receipts/${deletePayment.id}`, {
        method: 'DELETE',
      });
      setDeletePayment(null);
      setDetailsPayment(null);
      await load();
    } catch (e) {
      setError(e?.message || 'Не удалось отменить оплату');
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const openRepairOrder = useCallback(async (orderId) => {
    if (!orderId) return;
    setViewRepairOrderLoading(true);
    try {
      const order = await apiRequest(`/autoservice/repair-orders/${orderId}`);
      setViewRepairOrder(order);
    } catch (err) {
      setError(err?.message || 'Не удалось открыть заказ-наряд');
    } finally {
      setViewRepairOrderLoading(false);
    }
  }, []);

  const items = useMemo(() => data.items || [], [data.items]);

  const filteredRows = useMemo(() => {
    if (selectedMethod === 'all') return items;
    return items.filter((row) => row.method === selectedMethod);
  }, [items, selectedMethod]);

  const selectedLabel = useMemo(() => {
    const found = ALL_METHODS.find((m) => m.id === selectedMethod);
    return found?.label || 'Все';
  }, [selectedMethod]);

  const selectedTotal = useMemo(() => {
    if (selectedMethod === 'all') return data.total_amount || 0;
    return filteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [filteredRows, selectedMethod, data.total_amount]);

  return (
    <div className="min-w-0 space-y-4 lg:mt-5">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <h1 className="text-2xl font-bold text-ink max-lg:hidden sm:text-[1.75rem]">Финансы</h1>
        <div className="grid grid-cols-2 gap-4 sm:flex sm:shrink-0 sm:gap-8">
          <div className="text-center">
            {loading ? (
              <Skeleton className="mx-auto h-8 w-24 sm:h-9" />
            ) : (
              <div className="text-2xl font-bold tabular-nums leading-none text-ink sm:text-[1.75rem]">
                {formatFinanceCurrency(selectedTotal)}
              </div>
            )}
            <div className="mt-1.5 text-xs text-ink-muted sm:text-sm">{selectedLabel}</div>
          </div>
          <div className="text-center">
            {loading ? (
              <Skeleton className="mx-auto h-8 w-12 sm:h-9" />
            ) : (
              <div className="text-2xl font-bold tabular-nums leading-none text-brand-600 sm:text-[1.75rem]">
                {filteredRows.length}
              </div>
            )}
            <div className="mt-1.5 text-xs text-ink-muted sm:text-sm">{receiptsWord(filteredRows.length)}</div>
          </div>
        </div>
      </div>

      <MobileCollapsibleFilters title="Период">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Период с</span>
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
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Период по</span>
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

      <Toast message={error} variant="error" onClose={() => setError('')} />

      <MethodSegmentedFilter
        methods={ALL_METHODS}
        selected={selectedMethod}
        onChange={setSelectedMethod}
      />

      {loading ? (
        <div className="space-y-3">
          <div className="space-y-3 md:hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3 rounded-sg-lg bg-surface p-4 ring-1 ring-line/80">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-sg-lg bg-surface ring-1 ring-line/80 md:block">
            <div className="space-y-0 divide-y divide-line-soft px-4 py-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <FinanceReceiptRows
          rows={filteredRows}
          onOpen={setDetailsPayment}
          onOpenOrder={openRepairOrder}
          emptyText="Нет поступлений за период"
        />
      )}

      <Modal
        open={Boolean(detailsPayment)}
        onClose={() => {
          if (!deletingPaymentId) setDetailsPayment(null);
        }}
        title={detailsPayment ? `Поступление № ${detailsPayment.sequential_number}` : ''}
        size="sm"
        footer={detailsPayment ? (
          <div className="flex flex-wrap justify-end gap-2 max-md:flex-col">
            <Button
              variant="secondary"
              onClick={() => setDetailsPayment(null)}
              disabled={Boolean(deletingPaymentId)}
              className="max-md:min-h-11"
            >
              Закрыть
            </Button>
            <Button
              variant="danger"
              onClick={() => setDeletePayment(detailsPayment)}
              disabled={Boolean(deletingPaymentId)}
              className="max-md:min-h-11"
            >
              Отменить оплату
            </Button>
          </div>
        ) : null}
      >
        {detailsPayment ? (
          <div className="space-y-1.5">
            <FinanceField label="Клиент">{detailsPayment.client_name || '—'}</FinanceField>
            <FinanceField label="Телефон">{detailsPayment.client_phone || '—'}</FinanceField>
            <FinanceField label="Заказ-наряд">№ {detailsPayment.repair_order_number || '—'}</FinanceField>
            <FinanceField label="Способ">{FINANCE_METHOD_LABELS[detailsPayment.method] || detailsPayment.method}</FinanceField>
            <FinanceField label="Сумма">{formatFinanceCurrency(detailsPayment.amount)}</FinanceField>
            <div className="flex justify-between gap-3 pt-1 text-sm">
              <span className="shrink-0 text-ink-muted">Дата</span>
              <PaymentReceiptDateField
                row={detailsPayment}
                todayDate={todayDate}
                saving={savingPaymentId === detailsPayment.id}
                onSave={handlePaymentDateSave}
              />
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deletePayment)}
        onClose={() => {
          if (!deletingPaymentId) setDeletePayment(null);
        }}
        onConfirm={handleDeletePaymentConfirm}
        title="Отменить оплату?"
        message={
          deletePayment
            ? `Поступление № ${deletePayment.sequential_number} на сумму ${formatFinanceCurrency(deletePayment.amount)} по заказ-наряду № ${deletePayment.repair_order_number} будет удалено.`
            : ''
        }
        confirmLabel="Удалить"
        danger
        loading={Boolean(deletingPaymentId)}
      />

      <RepairOrderViewModal
        order={viewRepairOrder}
        loading={viewRepairOrderLoading}
        enablePayment
        wrapperZIndex="var(--sg-z-modal-elevated-shell)"
        onClose={() => setViewRepairOrder(null)}
        onOrderChange={(updated) => setViewRepairOrder(updated)}
      />
    </div>
  );
}
