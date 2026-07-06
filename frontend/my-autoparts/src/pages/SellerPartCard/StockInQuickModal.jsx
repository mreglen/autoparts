import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createStockIn } from '../../redux/slices/StockInSlice';

export default function StockInQuickModal({
  isOpen,
  onClose,
  part,
  onSuccess,
}) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [quantity, setQuantity] = useState('1');
  const [salePrice, setSalePrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !part) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      setError('Укажите количество');
      return;
    }
    if (!part.storage_location_id) {
      setError('У товара не указан склад');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await dispatch(createStockIn({
        product_id: part.id,
        storage_location_id: part.storage_location_id,
        quantity: qty,
        sale_price: parseFloat(salePrice) || 0,
        acquired_product_id: null,
      })).unwrap();

      const newQuantity = (part.quantity || 0) + qty;
      onSuccess?.(newQuantity);
      setQuantity('1');
      setSalePrice('');
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Не удалось оформить приход');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Приход на склад</h2>
          <p className="text-sm text-gray-600">
            {part.brand} {part.article} · остаток {part.quantity || 0} шт.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Количество</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Цена закупки, ₽ (необязательно)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
            />
          </div>

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
              type="submit"
              disabled={saving || !user}
              className="flex-1 min-h-12 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50"
            >
              {saving ? 'Сохранение…' : 'Оформить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
