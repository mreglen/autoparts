import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import {
  clampFinanceDate,
  formatFinanceCurrency,
  getFinanceTodayDate,
  getMonthRangeDefaults,
} from '../Finance/financeDisplay';
import { toDateInputValue } from '../../utils/serverDate';
import MobileCollapsibleFilters from '../../components/MobileCollapsibleFilters/MobileCollapsibleFilters';
import { Skeleton } from '../../components/UI';
import { ConfirmDialog } from '../../components/UI/Modal';
import PaymentPayerSelect from '../../components/Autoservice/PaymentPayerSelect';
import {
  warehouseEmptyShellClass,
  warehousePageClass,
  warehousePillControlClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';

const METHOD_BLOCKS = [
  { id: 'card', label: 'Оплата картой' },
  { id: 'cash', label: 'Наличными' },
  { id: 'bank', label: 'Расчётный счёт' },
];

const tabFilterButtonClass = (active) =>
  `inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition ${
    active
      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
      : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
  }`;

function receiptsWord(count) {
  if (count === 1) return 'поступление';
  if (count >= 2 && count <= 4) return 'поступления';
  return 'поступлений';
}

function FinanceField({ label, children }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 text-right font-medium text-gray-900 break-words">{children}</span>
    </div>
  );
}

const paymentDateInputClass =
  'block w-full min-w-[9.5rem] rounded-full border border-transparent bg-gray-100 px-3 py-1.5 text-sm text-gray-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-wait disabled:opacity-60';

function PaymentReceiptDateField({ row, todayDate, saving, onSave }) {
  const [draft, setDraft] = useState(() => toDateInputValue(row.created_at));

  useEffect(() => {
    setDraft(toDateInputValue(row.created_at));
  }, [row.created_at, row.id]);

  const handleChange = async (nextValue) => {
    const clamped = clampFinanceDate(nextValue, todayDate);
    setDraft(clamped);
    const current = toDateInputValue(row.created_at);
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

export default function AutoserviceFinancePage() {
  const defaults = useMemo(() => getMonthRangeDefaults(), []);
  const todayDate = useMemo(() => getFinanceTodayDate(), []);
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ totals: {}, total_amount: 0, count: 0, items: [] });
  const [payers, setPayers] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [savingPaymentId, setSavingPaymentId] = useState(null);
  const [savingPayerPaymentId, setSavingPayerPaymentId] = useState(null);
  const [deletePayment, setDeletePayment] = useState(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      const payerRows = await apiRequest('/autoservice/payers');
      const response = await apiRequest(`/autoservice/finance/receipts?${params.toString()}`);
      setPayers(Array.isArray(payerRows) ? payerRows : []);
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

  const handlePaymentDateSave = async (paymentId, paidAt) => {
    setSavingPaymentId(paymentId);
    setError('');
    try {
      await apiRequest(`/autoservice/finance/receipts/${paymentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ paid_at: paidAt }),
      });
      await load();
    } catch (e) {
      setError(e?.message || 'Не удалось изменить дату поступления');
    } finally {
      setSavingPaymentId(null);
    }
  };

  const handlePaymentPayerSave = async (paymentId, payerId) => {
    setSavingPayerPaymentId(paymentId);
    setError('');
    try {
      const updated = await apiRequest(`/autoservice/finance/receipts/${paymentId}/payer`, {
        method: 'PATCH',
        body: JSON.stringify({ payer_id: payerId }),
      });
      setData((prev) => ({
        ...prev,
        items: (prev.items || []).map((row) => (row.id === paymentId ? updated : row)),
      }));
    } catch (e) {
      setError(e?.message || 'Не удалось изменить плательщика');
    } finally {
      setSavingPayerPaymentId(null);
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
      await load();
    } catch (e) {
      setError(e?.message || 'Не удалось отменить оплату');
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const items = data.items || [];
  const methodStats = useMemo(() => {
    const counts = { card: 0, cash: 0, bank: 0 };
    items.forEach((row) => {
      if (counts[row.method] != null) counts[row.method] += 1;
    });
    return METHOD_BLOCKS.map((block) => ({
      ...block,
      amount: Number(data.totals?.[block.id] || 0),
      count: counts[block.id],
    }));
  }, [items, data.totals]);

  const selectedBlock = methodStats.find((block) => block.id === selectedMethod) || null;
  const selectedItems = selectedMethod ? items.filter((row) => row.method === selectedMethod) : [];

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-4`}>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Финансы</h1>
        <div className="grid grid-cols-2 gap-4 sm:flex sm:shrink-0 sm:gap-8">
          <div className="text-center">
            {loading ? (
              <Skeleton className="mx-auto h-8 w-24 sm:h-9" />
            ) : (
              <div className="text-2xl font-bold tabular-nums leading-none text-gray-900 sm:text-[1.75rem]">
                {formatFinanceCurrency(data.total_amount)}
              </div>
            )}
            <div className="mt-1.5 text-xs text-gray-500 sm:text-sm">Итого</div>
          </div>
          <div className="text-center">
            {loading ? (
              <Skeleton className="mx-auto h-8 w-12 sm:h-9" />
            ) : (
              <div className="text-2xl font-bold tabular-nums leading-none text-indigo-600 sm:text-[1.75rem]">
                {data.count ?? 0}
              </div>
            )}
            <div className="mt-1.5 text-xs text-gray-500 sm:text-sm">Записей</div>
          </div>
        </div>
      </div>

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

      {error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80">
          {error}
        </div>
      ) : null}

      <div className={warehouseToolbarClass}>
        <button
          type="button"
          onClick={() => setSelectedMethod(null)}
          className={tabFilterButtonClass(true)}
        >
          Поступления
        </button>
      </div>

      {loading ? (
        selectedBlock ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-9 w-24 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="ml-auto h-4 w-28" />
                <Skeleton className="ml-auto h-3 w-36" />
              </div>
            </div>
            <div className="space-y-3 md:hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-gray-200/80">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              ))}
            </div>
            <div className="hidden overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200/80 md:block">
              <div className="space-y-0 divide-y divide-gray-100 px-4 py-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-3">
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 sm:p-5"
              >
                <Skeleton className="h-3 w-16 sm:h-4 sm:w-24" />
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-6 w-20 sm:h-8 sm:w-28" />
                  <Skeleton className="h-3 w-14 sm:w-20" />
                </div>
              </div>
            ))}
          </div>
        )
      ) : selectedBlock ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedMethod(null)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gray-100 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Назад
            </button>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{selectedBlock.label}</p>
              <p className="text-xs text-gray-500">
                {formatFinanceCurrency(selectedBlock.amount)} · {selectedBlock.count} {receiptsWord(selectedBlock.count)}
              </p>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {!selectedItems.length ? (
              <p className={`${warehouseEmptyShellClass} text-sm text-gray-500`}>
                Нет поступлений за период
              </p>
            ) : (
              selectedItems.map((row) => (
                <div
                  key={row.id}
                  className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-gray-200/80"
                >
                  <FinanceField label="№">{row.sequential_number}</FinanceField>
                  <FinanceField label="Заказ-наряд">№ {row.repair_order_number}</FinanceField>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="shrink-0 text-gray-500">Плательщик</span>
                    <PaymentPayerSelect
                      row={row}
                      payers={payers}
                      saving={savingPayerPaymentId === row.id}
                      onSave={handlePaymentPayerSave}
                      className="min-w-0"
                    />
                  </div>
                  <FinanceField label="Сумма">{formatFinanceCurrency(row.amount)}</FinanceField>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="shrink-0 text-gray-500">Дата</span>
                    <PaymentReceiptDateField
                      row={row}
                      todayDate={todayDate}
                      saving={savingPaymentId === row.id}
                      onSave={handlePaymentDateSave}
                    />
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setDeletePayment(row)}
                      disabled={Boolean(deletingPaymentId)}
                      className="text-sm font-medium text-red-600 transition hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      Отменить оплату
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl bg-white ring-1 ring-gray-200/80 md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">№</th>
                  <th className="px-4 py-3 font-medium">Заказ-наряд</th>
                  <th className="px-4 py-3 font-medium">Плательщик</th>
                  <th className="px-4 py-3 text-right font-medium">Сумма</th>
                  <th className="px-4 py-3 font-medium">Дата</th>
                  <th className="px-4 py-3 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!selectedItems.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Нет поступлений за период
                    </td>
                  </tr>
                ) : (
                  selectedItems.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 tabular-nums font-medium text-gray-900">
                        {row.sequential_number}
                      </td>
                      <td className="px-4 py-3 tabular-nums">№ {row.repair_order_number}</td>
                      <td className="px-4 py-3">
                        <PaymentPayerSelect
                          row={row}
                          payers={payers}
                          saving={savingPayerPaymentId === row.id}
                          onSave={handlePaymentPayerSave}
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatFinanceCurrency(row.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentReceiptDateField
                          row={row}
                          todayDate={todayDate}
                          saving={savingPaymentId === row.id}
                          onSave={handlePaymentDateSave}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDeletePayment(row)}
                          disabled={Boolean(deletingPaymentId)}
                          className="text-sm font-medium text-red-600 transition hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
                        >
                          Отменить
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {methodStats.map((block) => (
            <button
              key={block.id}
              type="button"
              onClick={() => setSelectedMethod(block.id)}
              className="rounded-2xl bg-white p-4 text-left ring-1 ring-gray-200/80 transition hover:bg-gray-50 hover:ring-gray-300 sm:p-5"
            >
              <p className="text-[11px] font-medium leading-tight text-gray-500 sm:text-sm">{block.label}</p>
              <div className="mt-3">
                <p className="text-base font-bold tabular-nums leading-tight text-gray-900 sm:text-2xl">
                  {formatFinanceCurrency(block.amount)}
                </p>
                <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">
                  {block.count} {receiptsWord(block.count)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

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
    </div>
  );
}
