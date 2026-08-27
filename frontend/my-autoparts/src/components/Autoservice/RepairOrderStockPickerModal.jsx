import React, { useEffect, useState } from 'react';
import Modal from '../UI/Modal';
import { apiRequest } from '../../utils/apiClient';
import { formatAutoserviceWarehouseMoney, autoserviceWarehouseItemLabel } from '../../utils/autoserviceWarehouseUi';
import { formatShopPartUnit } from '../../utils/repairOrderShopPartUtils';
import { warehousePrimaryButtonClass, warehouseSecondaryButtonClass } from '../../utils/warehouseListUi';

export default function RepairOrderStockPickerModal({
  open,
  onClose,
  onSelect,
  title,
  endpoint,
  mapSelection,
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [qty, setQty] = useState('1');

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setSelectedId(null);
    setQty('1');
    setError('');
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const suffix = endpoint.includes('warehouse/items')
          ? `?q=${encodeURIComponent(query)}&available_only=true`
          : `?q=${encodeURIComponent(query)}`;
        const data = await apiRequest(`${endpoint}${suffix}`);
        if (!cancelled) {
          setItems(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Не удалось загрузить позиции');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, endpoint]);

  if (!open) return null;

  const selected = items.find((item) => item.id === selectedId);
  const selectedUnit = selected?.unit === 'l' || selected?.unit === 'kg' ? selected.unit : 'pcs';
  const maxQty = selected?.available_qty ?? selected?.quantity ?? 1;
  const qtyStep = selectedUnit === 'pcs' ? 1 : 0.001;
  const qtyMin = selectedUnit === 'pcs' ? 1 : 0.001;

  const handleConfirm = () => {
    if (!selected) return;
    const raw = Number(qty);
    const quantity = selectedUnit === 'pcs'
      ? Math.max(1, Math.min(Math.round(raw || 1), maxQty))
      : Math.max(qtyMin, Math.min(Number.isFinite(raw) ? raw : qtyMin, maxQty));
    onSelect?.(mapSelection(selected, quantity));
    onClose?.();
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-4">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по названию, артикулу, бренду"
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm max-md:min-h-11 max-md:text-base"
          autoFocus
        />
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">Загрузка…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">Позиции не найдены</div>
          ) : (
            items.map((item) => {
              const label = autoserviceWarehouseItemLabel(item);
              const available = item.available_qty ?? item.quantity ?? 0;
              const unitLabel = formatShopPartUnit(item.unit || 'pcs');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setQty('1');
                  }}
                  className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm transition ${
                    selectedId === item.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">{label || '—'}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      Доступно: {available} {unitLabel}
                    </div>
                  </div>
                  <div className="shrink-0 font-semibold tabular-nums text-gray-900">
                    {formatAutoserviceWarehouseMoney(item.price ?? item.unit_price)}
                  </div>
                </button>
              );
            })
          )}
        </div>
        {selected ? (
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Количество</span>
            <input
              type="number"
              min={qtyMin}
              max={maxQty}
              step={qtyStep}
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm max-md:min-h-11 max-md:text-base"
            />
            <span className="mt-1 block text-xs text-gray-500">
              Доступно: {maxQty} {formatShopPartUnit(selectedUnit)}
            </span>
          </label>
        ) : null}
        <div className="flex justify-end gap-2 max-md:flex-col">
          <button type="button" className={`${warehouseSecondaryButtonClass} max-md:min-h-11`} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={`${warehousePrimaryButtonClass} max-md:min-h-11`}
            disabled={!selected}
            onClick={handleConfirm}
          >
            Добавить
          </button>
        </div>
      </div>
    </Modal>
  );
}
