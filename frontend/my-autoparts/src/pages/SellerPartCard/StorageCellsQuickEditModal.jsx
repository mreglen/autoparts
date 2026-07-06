import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  deleteProductCellLink,
  fetchStorageCells,
  linkProductToCell,
} from '../../redux/slices/StorageCellsSlice';

export default function StorageCellsQuickEditModal({
  isOpen,
  onClose,
  part,
  onSuccess,
}) {
  const dispatch = useDispatch();
  const [cells, setCells] = useState([]);
  const [values, setValues] = useState({});
  const [existingLinks, setExistingLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !part?.storage_location_id) return undefined;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const locationCells = await dispatch(fetchStorageCells(part.storage_location_id)).unwrap();
        if (cancelled) return;
        setCells(Array.isArray(locationCells) ? locationCells : []);
        const links = part.product_storage_cells || [];
        setExistingLinks(links);
        const initial = {};
        links.forEach((link) => {
          if (link.storage_cell_id != null) {
            initial[link.storage_cell_id] = link.value || '';
          }
        });
        setValues(initial);
      } catch (err) {
        if (!cancelled) {
          setError(typeof err === 'string' ? err : 'Не удалось загрузить ячейки');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [dispatch, isOpen, part]);

  const handleChange = useCallback((cellId, value) => {
    setValues((prev) => ({ ...prev, [cellId]: value }));
  }, []);

  const handleSave = async () => {
    if (!part?.id) return;
    setSaving(true);
    setError('');
    try {
      for (const link of existingLinks) {
        if (link.id) {
          await dispatch(deleteProductCellLink(link.id)).unwrap();
        }
      }

      const entries = Object.entries(values);
      const created = [];
      for (const [cellId, value] of entries) {
        const trimmed = (value || '').trim();
        if (!trimmed) continue;
        const row = await dispatch(linkProductToCell({
          product_id: part.id,
          storage_cell_id: parseInt(cellId, 10),
          value: trimmed,
        })).unwrap();
        created.push({
          id: row.id,
          storage_cell_id: row.storage_cell_id,
          value: row.value,
          storage_cell_name: cells.find((c) => c.id === row.storage_cell_id)?.name || null,
        });
      }

      onSuccess?.(created);
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Не удалось сохранить ячейки');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !part) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="p-5 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Адресное хранение</h2>
          <p className="text-sm text-gray-600">{part.name}</p>

          {!part.storage_location_id ? (
            <p className="text-sm text-amber-700">У товара не указан склад — ячейки недоступны.</p>
          ) : loading ? (
            <p className="text-sm text-gray-500">Загрузка ячеек…</p>
          ) : cells.length === 0 ? (
            <p className="text-sm text-gray-500">На складе нет настроенных ячеек.</p>
          ) : (
            <div className="space-y-3">
              {cells.map((cell) => (
                <div key={cell.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{cell.name}</label>
                  <input
                    type="text"
                    value={values[cell.id] || ''}
                    onChange={(e) => handleChange(cell.id, e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
                    placeholder="Количество или значение"
                  />
                </div>
              ))}
            </div>
          )}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 min-h-12 rounded-xl border border-gray-300 text-gray-700 font-medium"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || !part.storage_location_id}
              className="flex-1 min-h-12 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
