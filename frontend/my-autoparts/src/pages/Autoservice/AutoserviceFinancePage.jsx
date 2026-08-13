import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import {
  clampFinanceDate,
  formatFinanceCurrency,
  getFinanceTodayDate,
  getMonthRangeDefaults,
} from '../Finance/financeDisplay';
import { formatServerDateTime } from '../../utils/serverDate';
import MobileCollapsibleFilters from '../../components/MobileCollapsibleFilters/MobileCollapsibleFilters';
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

export default function AutoserviceFinancePage() {
  const defaults = useMemo(() => getMonthRangeDefaults(), []);
  const todayDate = useMemo(() => getFinanceTodayDate(), []);
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({ totals: {}, total_amount: 0, count: 0, items: [] });
  const [selectedMethod, setSelectedMethod] = useState(null);

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
            <div className="text-2xl font-bold tabular-nums leading-none text-gray-900 sm:text-[1.75rem]">
              {formatFinanceCurrency(data.total_amount)}
            </div>
            <div className="mt-1.5 text-xs text-gray-500 sm:text-sm">Итого</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums leading-none text-indigo-600 sm:text-[1.75rem]">
              {data.count ?? 0}
            </div>
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

      {loading && !items.length && !data.count ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
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
                  key={`${row.sequential_number}-${row.created_at}`}
                  className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-gray-200/80"
                >
                  <FinanceField label="№">{row.sequential_number}</FinanceField>
                  <FinanceField label="Заказ-наряд">№ {row.repair_order_number}</FinanceField>
                  <FinanceField label="Клиент">{row.client_name || '—'}</FinanceField>
                  <FinanceField label="Сумма">{formatFinanceCurrency(row.amount)}</FinanceField>
                  <FinanceField label="Дата">{formatServerDateTime(row.created_at)}</FinanceField>
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
                  <th className="px-4 py-3 font-medium">Клиент</th>
                  <th className="px-4 py-3 text-right font-medium">Сумма</th>
                  <th className="px-4 py-3 font-medium">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!selectedItems.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Нет поступлений за период
                    </td>
                  </tr>
                ) : (
                  selectedItems.map((row) => (
                    <tr key={`${row.sequential_number}-${row.created_at}`} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 tabular-nums font-medium text-gray-900">
                        {row.sequential_number}
                      </td>
                      <td className="px-4 py-3 tabular-nums">№ {row.repair_order_number}</td>
                      <td className="px-4 py-3">{row.client_name || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatFinanceCurrency(row.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {formatServerDateTime(row.created_at)}
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
              className="flex aspect-square flex-col justify-between rounded-2xl bg-white p-3 text-left ring-1 ring-gray-200/80 transition hover:bg-gray-50 hover:ring-gray-300 sm:p-5"
            >
              <p className="text-[11px] font-medium leading-tight text-gray-500 sm:text-sm">{block.label}</p>
              <div>
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
    </div>
  );
}
