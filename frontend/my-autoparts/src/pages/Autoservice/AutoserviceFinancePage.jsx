import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import {
  clampFinanceDate,
  formatFinanceCurrency,
  getFinanceTodayDate,
  getMonthRangeDefaults,
} from '../Finance/financeDisplay';
import { formatServerDateTime, toDateInputValue } from '../../utils/serverDate';
import MobileCollapsibleFilters from '../../components/MobileCollapsibleFilters/MobileCollapsibleFilters';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import { Button, ConfirmDialog, Modal, Skeleton } from '../../components/UI';
import Toast from '../../components/UI/Toast';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import { useDebouncedValue } from '../../hooks/useDebouncedCallback';
import {
  filterFinanceReceipts,
  financeReceiptClientLabel,
  FINANCE_METHOD_LABELS,
} from '../../utils/financeReceiptSearch';
import {
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTbodyClass,
  autoserviceListTdClass,
  autoserviceListTdRightClass,
  autoserviceListThClass,
  autoserviceListThRightClass,
  autoserviceListTheadRowClass,
  autoserviceListTrClickableClass,
  warehouseEmptyShellClass,
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
      ? 'bg-surface text-ink shadow-sm ring-1 ring-line'
      : 'text-ink-muted hover:bg-surface/60 hover:text-ink'
  }`;

function receiptsWord(count) {
  if (count === 1) return 'поступление';
  if (count >= 2 && count <= 4) return 'поступления';
  return 'поступлений';
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

function FinanceReceiptRows({
  entries,
  onOpen,
  showMethod = false,
  showMatchHint = false,
  emptyText = 'Нет поступлений за период',
}) {
  if (!entries.length) {
    return (
      <p className={`${warehouseEmptyShellClass} text-sm text-ink-muted`}>
        {emptyText}
      </p>
    );
  }

  return (
    <>
      <div className="md:hidden">
        {entries.map(({ row, hint }) => (
          <button
            type="button"
            key={row.id}
            onClick={() => onOpen(row)}
            className="block w-full space-y-1.5 border-b border-line-soft py-3 text-left transition last:border-0 hover:bg-surface-muted/50"
          >
            <FinanceField label="Клиент">{financeReceiptClientLabel(row)}</FinanceField>
            {!showMethod ? (
              <>
                <FinanceField label="№">{row.sequential_number}</FinanceField>
                <FinanceField label="Заказ-наряд">№ {row.repair_order_number}</FinanceField>
              </>
            ) : null}
            {showMethod ? (
              <FinanceField label="Способ">{FINANCE_METHOD_LABELS[row.method] || row.method}</FinanceField>
            ) : null}
            <FinanceField label="Сумма">{formatFinanceCurrency(row.amount)}</FinanceField>
            <FinanceField label="Дата">{formatServerDateTime(row.created_at)}</FinanceField>
            {showMatchHint && hint ? (
              <p className="text-xs text-brand-700">{hint}</p>
            ) : null}
          </button>
        ))}
      </div>

      <div className={autoserviceListTableWrapClass}>
        <table className={autoserviceListTableClass}>
          <thead>
            <tr className={autoserviceListTheadRowClass}>
              {showMethod ? null : <th className={`w-16 ${autoserviceListThClass}`}>№</th>}
              {showMethod ? null : <th className={`w-28 ${autoserviceListThClass}`}>Заказ-наряд</th>}
              <th className={autoserviceListThClass}>Клиент</th>
              {showMethod ? <th className={`w-32 ${autoserviceListThClass}`}>Способ</th> : null}
              <th className={`w-32 ${autoserviceListThRightClass}`}>Сумма</th>
              <th className={`w-40 ${autoserviceListThClass}`}>Дата</th>
              {showMatchHint ? <th className={autoserviceListThClass}>Найдено</th> : null}
            </tr>
          </thead>
          <tbody className={autoserviceListTbodyClass}>
            {entries.map(({ row, hint }) => (
              <tr
                key={row.id}
                className={autoserviceListTrClickableClass}
                onClick={() => onOpen(row)}
              >
                {showMethod ? null : (
                  <td className={`${autoserviceListTdClass} tabular-nums font-medium text-ink`}>
                    {row.sequential_number}
                  </td>
                )}
                {showMethod ? null : (
                  <td className={`${autoserviceListTdClass} tabular-nums`}>№ {row.repair_order_number}</td>
                )}
                <td className={autoserviceListTdClass}>
                  {financeReceiptClientLabel(row)}
                </td>
                {showMethod ? (
                  <td className={autoserviceListTdClass}>{FINANCE_METHOD_LABELS[row.method] || row.method}</td>
                ) : null}
                <td className={`${autoserviceListTdRightClass} font-medium tabular-nums`}>
                  {formatFinanceCurrency(row.amount)}
                </td>
                <td className={autoserviceListTdClass}>
                  {formatServerDateTime(row.created_at)}
                </td>
                {showMatchHint ? (
                  <td className={`${autoserviceListTdClass} text-ink-muted`}>{hint || '—'}</td>
                ) : null}
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
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [savingPaymentId, setSavingPaymentId] = useState(null);
  const [detailsPayment, setDetailsPayment] = useState(null);
  const [deletePayment, setDeletePayment] = useState(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const searchQuery = useDebouncedValue(searchInput, 280);

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

  const items = useMemo(() => data.items || [], [data.items]);
  const searchApplied = Boolean(searchQuery.trim());

  const searchResults = useMemo(
    () => filterFinanceReceipts(items, searchQuery, {
      method: selectedMethod || undefined,
    }),
    [items, searchQuery, selectedMethod],
  );

  const methodStats = useMemo(() => {
    const sourceItems = searchApplied
      ? searchResults.map((entry) => entry.row)
      : items;
    const counts = { card: 0, cash: 0, bank: 0 };
    sourceItems.forEach((row) => {
      if (counts[row.method] != null) counts[row.method] += 1;
    });
    return METHOD_BLOCKS.map((block) => ({
      ...block,
      amount: searchApplied
        ? searchResults
          .filter((entry) => entry.row.method === block.id)
          .reduce((sum, entry) => sum + Number(entry.row.amount || 0), 0)
        : Number(data.totals?.[block.id] || 0),
      count: counts[block.id],
    }));
  }, [items, data.totals, searchApplied, searchResults]);

  const selectedBlock = methodStats.find((block) => block.id === selectedMethod) || null;
  const selectedEntries = useMemo(() => {
    if (searchApplied) return searchResults;
    if (!selectedMethod) return [];
    return items
      .filter((row) => row.method === selectedMethod)
      .map((row) => ({
        row,
        match: null,
        hint: null,
      }));
  }, [searchApplied, searchResults, selectedMethod, items]);

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
                {formatFinanceCurrency(data.total_amount)}
              </div>
            )}
            <div className="mt-1.5 text-xs text-ink-muted sm:text-sm">Итого</div>
          </div>
          <div className="text-center">
            {loading ? (
              <Skeleton className="mx-auto h-8 w-12 sm:h-9" />
            ) : (
              <div className="text-2xl font-bold tabular-nums leading-none text-brand-600 sm:text-[1.75rem]">
                {data.count ?? 0}
              </div>
            )}
            <div className="mt-1.5 text-xs text-ink-muted sm:text-sm">Платежей</div>
          </div>
        </div>
      </div>

      <MobileCollapsibleFilters title="Период и параметры">
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

      <div className={warehouseToolbarClass}>
        <button
          type="button"
          onClick={() => setSelectedMethod(null)}
          className={tabFilterButtonClass(!selectedMethod)}
        >
          Поступления
        </button>
      </div>

      <AutoserviceLiveSearchField
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Клиент, телефон, заказ-наряд, № поступления"
        ariaLabel="Поиск поступлений"
      />

      {searchApplied && !selectedMethod ? (
        <p className="text-sm text-ink-muted">
          {loading ? 'Поиск…' : `Найдено ${searchResults.length} из ${items.length}`}
        </p>
      ) : null}

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-sg-lg bg-surface p-4 ring-1 ring-line/80"
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-6 w-28" />
                <Skeleton className="mt-2 h-3 w-20" />
              </div>
            ))}
          </div>
        )
      ) : searchApplied && !selectedMethod ? (
        <FinanceReceiptRows
          entries={searchResults}
          onOpen={setDetailsPayment}
          showMethod
          showMatchHint
          emptyText="Ничего не найдено"
        />
      ) : selectedBlock ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedMethod(null)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-subtle px-3 text-sm font-medium text-ink-soft transition hover:bg-surface-muted"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Назад
            </button>
            <div className="text-right">
              <p className="text-sm font-semibold text-ink">{selectedBlock.label}</p>
              <p className="text-xs text-ink-muted">
                {formatFinanceCurrency(selectedBlock.amount)} · {selectedBlock.count} {receiptsWord(selectedBlock.count)}
                {searchApplied ? ` · по запросу «${searchQuery.trim()}»` : ''}
              </p>
            </div>
          </div>

          <FinanceReceiptRows
            entries={selectedEntries}
            onOpen={setDetailsPayment}
            showMatchHint={searchApplied}
            emptyText={searchApplied ? 'Ничего не найдено' : 'Нет поступлений за период'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {methodStats.map((block) => (
            <button
              key={block.id}
              type="button"
              onClick={() => setSelectedMethod(block.id)}
              className="rounded-sg-lg bg-surface p-4 text-left ring-1 ring-line/80 transition hover:bg-surface-muted hover:ring-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <p className="text-xs font-medium text-ink-muted">{block.label}</p>
              <p className="mt-2 text-lg font-bold tabular-nums text-ink sm:text-xl">
                {formatFinanceCurrency(block.amount)}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {block.count} {receiptsWord(block.count)}
              </p>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(detailsPayment)}
        onClose={() => {
          if (!deletingPaymentId) setDetailsPayment(null);
        }}
        title={
          detailsPayment
            ? `Поступление № ${detailsPayment.sequential_number}`
            : ''
        }
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
            <FinanceField label="Клиент">{financeReceiptClientLabel(detailsPayment)}</FinanceField>
            <FinanceField label="Заказ-наряд">
              № {detailsPayment.repair_order_number || '—'}
            </FinanceField>
            <FinanceField label="Способ">
              {FINANCE_METHOD_LABELS[detailsPayment.method] || detailsPayment.method}
            </FinanceField>
            <FinanceField label="Сумма">
              {formatFinanceCurrency(detailsPayment.amount)}
            </FinanceField>
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
    </div>
  );
}
