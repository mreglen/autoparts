import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import {
  clampFinanceDate,
  formatFinanceCurrency,
  formatFinanceDate,
  getFinanceTodayDate,
  getMonthRangeDefaults,
} from '../Finance/financeDisplay';
import { formatServerDateTime } from '../../utils/serverDate';
import MobileCollapsibleFilters from '../../components/MobileCollapsibleFilters/MobileCollapsibleFilters';
import {
  warehouseEmptyShellClass,
  warehousePageClass,
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';

const METHOD_LABELS = {
  card: 'Оплата картой',
  cash: 'Наличными',
  bank: 'Расчётный счёт',
};

function StatsBlocks({ totals, totalAmount, count }) {
  const blocks = [
    { value: formatFinanceCurrency(totals?.card), label: METHOD_LABELS.card, accent: false },
    { value: formatFinanceCurrency(totals?.cash), label: METHOD_LABELS.cash, accent: true },
    { value: formatFinanceCurrency(totals?.bank), label: METHOD_LABELS.bank, accent: false },
  ];

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid grid-cols-3 gap-4 sm:flex sm:shrink-0 sm:gap-8">
        {blocks.map((block) => (
          <div key={block.label} className="text-center">
            <div
              className={`text-2xl font-bold tabular-nums leading-none sm:text-[1.75rem] ${
                block.accent ? 'text-indigo-600' : 'text-gray-900'
              }`}
            >
              {block.value}
            </div>
            <div className="mt-1.5 text-xs text-gray-500 sm:text-sm">{block.label}</div>
          </div>
        ))}
      </div>
      <div className="text-center sm:text-right">
        <div className="text-2xl font-bold tabular-nums text-gray-900 sm:text-[1.75rem]">
          {formatFinanceCurrency(totalAmount)}
        </div>
        <div className="mt-1.5 text-xs text-gray-500 sm:text-sm">
          {count} {count === 1 ? 'поступление' : count >= 2 && count <= 4 ? 'поступления' : 'поступлений'}
        </div>
      </div>
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

  const handleDateFromChange = (value) => {
    setDateFrom(clampFinanceDate(value, todayDate));
  };

  const handleDateToChange = (value) => {
    setDateTo(clampFinanceDate(value, todayDate));
  };

  const items = data.items || [];

  return (
    <div className={warehousePageClass}>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Финансы сервиса</h1>
        <p className="mt-0.5 text-sm text-gray-500">Поступления по оплате заказ-нарядов</p>
      </div>

      <MobileCollapsibleFilters
        className="mb-4"
        summary={`${formatFinanceDate(dateFrom)} — ${formatFinanceDate(dateTo)}`}
      >
        <div className={warehouseToolbarClass}>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-500">
            С
            <input
              type="date"
              max={todayDate}
              value={dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className={warehousePillControlClass}
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-500">
            По
            <input
              type="date"
              max={todayDate}
              value={dateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              className={warehousePillControlClass}
            />
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className={warehousePrimaryButtonClass}
          >
            {loading ? 'Загрузка…' : 'Обновить'}
          </button>
        </div>
      </MobileCollapsibleFilters>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mb-5 rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 sm:p-5">
        <StatsBlocks totals={data.totals} totalAmount={data.total_amount} count={data.count} />
      </div>

      <div className="hidden overflow-x-auto rounded-2xl bg-white ring-1 ring-gray-200/80 md:block">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">№</th>
              <th className="px-4 py-3">Заказ-наряд</th>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Способ</th>
              <th className="px-4 py-3 text-right">Сумма</th>
              <th className="px-4 py-3">Дата</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  Загрузка…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  За выбранный период поступлений нет
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={`${row.sequential_number}-${row.created_at}`} className="text-gray-700">
                  <td className="px-4 py-3 tabular-nums font-medium text-gray-900">{row.sequential_number}</td>
                  <td className="px-4 py-3 tabular-nums">№ {row.repair_order_number}</td>
                  <td className="px-4 py-3">{row.client_name || '—'}</td>
                  <td className="px-4 py-3">{METHOD_LABELS[row.method] || row.method}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                    {formatFinanceCurrency(row.amount)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {formatServerDateTime(row.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {loading ? (
          <p className={`${warehouseEmptyShellClass} text-sm text-gray-500`}>Загрузка…</p>
        ) : items.length === 0 ? (
          <p className={`${warehouseEmptyShellClass} text-sm text-gray-500`}>
            За выбранный период поступлений нет
          </p>
        ) : (
          items.map((row) => (
            <div
              key={`${row.sequential_number}-${row.created_at}`}
              className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-gray-200/80"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Поступление №{row.sequential_number}</p>
                  <p className="mt-0.5 text-sm text-gray-600">Заказ-наряд №{row.repair_order_number}</p>
                </div>
                <p className="text-sm font-bold tabular-nums text-gray-900">
                  {formatFinanceCurrency(row.amount)}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>{row.client_name || '—'}</span>
                <span>{METHOD_LABELS[row.method] || row.method}</span>
                <span>{formatServerDateTime(row.created_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
