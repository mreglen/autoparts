import React, { useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';

const EMPTY_FORM = {
  brand: '',
  article: '',
  name: '',
  quantity: '1',
  unit_price: '',
};

const fieldClass =
  'mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-0';

export default function AutoserviceWarehouseAddModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
  title = 'Добавить на склад',
  submitLabel = 'Добавить',
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const patch = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setError('');
    onClose?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const quantity = Math.round(Number(form.quantity));
    const unitPrice = Number(form.unit_price);
    if (!name) {
      setError('Укажите наименование');
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      setError('Количество должно быть целым числом ≥ 1');
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError('Цена должна быть ≥ 0');
      return;
    }
    try {
      await onSubmit({
        brand: form.brand.trim(),
        article: form.article.trim(),
        name,
        quantity,
        unit_price: unitPrice,
      });
      setForm(EMPTY_FORM);
      setError('');
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={title} size="sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Бренд</span>
          <input
            className={fieldClass}
            value={form.brand}
            onChange={(e) => patch('brand', e.target.value)}
            placeholder="Например, Bosch"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Артикул</span>
          <input
            className={fieldClass}
            value={form.article}
            onChange={(e) => patch('article', e.target.value)}
            placeholder="Например, 0986424794"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Наименование</span>
          <input
            className={fieldClass}
            value={form.name}
            onChange={(e) => patch('name', e.target.value)}
            placeholder="Например, Колодки тормозные"
            required
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Количество</span>
            <input
              type="number"
              min="1"
              step="1"
              className={fieldClass}
              value={form.quantity}
              onChange={(e) => patch('quantity', e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Цена, ₽</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className={fieldClass}
              value={form.unit_price}
              onChange={(e) => patch('unit_price', e.target.value)}
              placeholder="0"
              required
            />
          </label>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Отмена
          </Button>
          <Button type="submit" loading={submitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
