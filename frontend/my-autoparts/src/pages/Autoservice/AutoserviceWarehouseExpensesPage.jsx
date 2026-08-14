import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import Modal from '../../components/UI/Modal';
import { useAuthReady } from '../../hooks/useAuthReady';
import { userHasAutoserviceOrganization } from '../../utils/sellerAutoserviceMode';
import { formatAutoserviceWarehouseMoney, formatAutoserviceWarehouseQty } from '../../utils/autoserviceWarehouseUi';
import {
  warehousePageClass,
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseSecondaryButtonClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU');
}

export default function AutoserviceWarehouseExpensesPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [writeOffQty, setWriteOffQty] = useState('1');
  const [writeOffReason, setWriteOffReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [expenses, stockItems] = await Promise.all([
        apiRequest('/autoservice/warehouse/expenses'),
        apiRequest('/autoservice/warehouse/items?available_only=true'),
      ]);
      setRows(Array.isArray(expenses) ? expenses : []);
      setItems(Array.isArray(stockItems) ? stockItems : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить расходы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    if (!userHasAutoserviceOrganization(user)) return;
    loadData();
  }, [isReady, isAuthenticated, user, loadData]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.brand, row.article, row.name, row.reason, row.creator_name]
      .some((value) => String(value || '').toLowerCase().includes(q)));
  }, [rows, searchQuery]);

  const selectedItem = items.find((item) => String(item.id) === String(selectedItemId));

  const handleWriteOff = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    setError('');
    try {
      await apiRequest('/autoservice/warehouse/expenses', {
        method: 'POST',
        body: JSON.stringify({
          item_id: selectedItem.id,
          quantity: Number(writeOffQty),
          reason: writeOffReason.trim() || null,
        }),
      });
      setWriteOffOpen(false);
      setSelectedItemId('');
      setWriteOffQty('1');
      setWriteOffReason('');
      await loadData();
    } catch (err) {
      setError(err?.message || 'Не удалось списать запчасть');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !userHasAutoserviceOrganization(user)) return null;

  return (
    <div className={warehousePageClass}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Расходы</h1>
          <p className="mt-1 text-sm text-gray-500">Списания со склада автосервиса</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setWriteOffOpen(true)} className={warehousePrimaryButtonClass}>
            Списать
          </button>
          <button type="button" onClick={loadData} className={warehouseSecondaryButtonClass}>
            Обновить
          </button>
        </div>
      </div>

      <div className={`${warehouseToolbarClass} mb-4`}>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Поиск"
          className={`${warehousePillControlClass} sm:max-w-md`}
        />
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          Загрузка…
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <p className="text-sm text-gray-600">Расходов пока нет</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Бренд</th>
                <th className="px-4 py-3">Артикул</th>
                <th className="px-4 py-3">Наименование</th>
                <th className="px-4 py-3 text-right">Кол-во</th>
                <th className="px-4 py-3 text-right">Цена</th>
                <th className="px-4 py-3">Причина</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((row) => (
                <tr key={row.id} className="text-gray-800">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{row.brand || '—'}</td>
                  <td className="px-4 py-3 font-mono text-gray-600">{row.article || '—'}</td>
                  <td className="px-4 py-3">{row.name || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.quantity} шт.</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {formatAutoserviceWarehouseMoney(row.unit_price)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {writeOffOpen ? (
        <Modal open={writeOffOpen} title="Списать со склада автосервиса" onClose={() => setWriteOffOpen(false)}>
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Позиция</span>
              <select
                value={selectedItemId}
                onChange={(event) => {
                  setSelectedItemId(event.target.value);
                  const item = items.find((row) => String(row.id) === event.target.value);
                  setWriteOffQty('1');
                  if (item) {
                    setWriteOffReason('');
                  }
                }}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Выберите позицию</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {[item.brand, item.article, item.name].filter(Boolean).join(' · ')}
                    {' '}
                    ({formatAutoserviceWarehouseQty(item)})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Количество</span>
              <input
                type="number"
                min="1"
                max={selectedItem?.available_qty || 1}
                value={writeOffQty}
                onChange={(event) => setWriteOffQty(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {selectedItem ? (
                <span className="mt-1 block text-xs text-gray-500">
                  Доступно: {selectedItem.available_qty} шт.
                </span>
              ) : null}
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Причина</span>
              <input
                type="text"
                value={writeOffReason}
                onChange={(event) => setWriteOffReason(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Необязательно"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className={warehouseSecondaryButtonClass} onClick={() => setWriteOffOpen(false)}>
                Отмена
              </button>
              <button
                type="button"
                className={warehousePrimaryButtonClass}
                disabled={!selectedItem || submitting}
                onClick={handleWriteOff}
              >
                {submitting ? 'Списание…' : 'Списать'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
