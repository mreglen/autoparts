import React, { useEffect, useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import { apiAxios } from '../../utils/apiClient';
import AutoserviceReceiptSuggestField from './AutoserviceReceiptSuggestField';
import {
  buildRosskoLookupText,
  getRosskoMinPrice,
  pickBestRosskoPart,
  roundRosskoSalePrice,
} from '../../pages/AutoParts/NewParts/rosskoHelpers';

const EMPTY_FORM = {
  brand: '',
  article: '',
  name: '',
  quantity: '1',
  unit_price: '',
};

const fieldClass =
  'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-0';

export default function AutoserviceWarehouseAddModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
  title = 'Добавить на склад',
  submitLabel = 'Добавить',
  showRosskoLookup = true,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [rosskoLookupLoading, setRosskoLookupLoading] = useState(false);
  const [rosskoLookupError, setRosskoLookupError] = useState('');
  const [rosskoLookupNotice, setRosskoLookupNotice] = useState('');
  const [filledFromRossko, setFilledFromRossko] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setError('');
    setRosskoLookupError('');
    setRosskoLookupNotice('');
    setFilledFromRossko(false);
  }, [open]);

  const patch = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
    setRosskoLookupError('');
    setRosskoLookupNotice('');
    if (key === 'brand' || key === 'article' || key === 'name' || key === 'unit_price') {
      setFilledFromRossko(false);
    }
  };

  const applyReceiptSuggestion = (row) => {
    setForm((prev) => ({
      ...prev,
      brand: row.brand ?? prev.brand,
      article: row.article ?? prev.article,
      name: row.name ?? prev.name,
      unit_price: row.unit_price != null && row.unit_price !== ''
        ? String(row.unit_price)
        : prev.unit_price,
    }));
    setFilledFromRossko(false);
    setError('');
    setRosskoLookupError('');
    setRosskoLookupNotice('');
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setError('');
    setRosskoLookupError('');
    setRosskoLookupNotice('');
    setFilledFromRossko(false);
    onClose?.();
  };

  const handleFillFromRossko = async () => {
    const article = form.article.trim();
    const brand = form.brand.trim();
    if (!article) {
      setRosskoLookupError('Введите артикул для поиска в Rossko');
      return;
    }

    setRosskoLookupLoading(true);
    setRosskoLookupError('');
    setRosskoLookupNotice('');

    try {
      const response = await apiAxios.post('/rossko/GetSearch', {
        text: buildRosskoLookupText(article, brand),
        delivery_id: '000000001',
        address_id: 176458,
      });

      const best = pickBestRosskoPart(response.data, article, brand);
      if (!best) {
        setRosskoLookupError('В Rossko ничего не найдено по введённым данным');
        return;
      }

      const minPrice = roundRosskoSalePrice(getRosskoMinPrice(best));
      const filledArticle = best.partnumber || article;
      const filledBrand = best.brand || brand;
      const filledName = best.name || form.name;

      setForm((prev) => ({
        ...prev,
        article: filledArticle,
        brand: filledBrand,
        name: filledName || prev.name,
        unit_price: minPrice > 0 ? String(minPrice) : prev.unit_price,
      }));
      setFilledFromRossko(true);
      setRosskoLookupNotice(
        `Данные заполнены: ${filledBrand || '—'} ${filledArticle}`.trim(),
      );
    } catch (err) {
      setRosskoLookupError(
        err.response?.data?.detail || err.message || 'Ошибка при поиске в Rossko',
      );
    } finally {
      setRosskoLookupLoading(false);
    }
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
        source: filledFromRossko ? 'rossko' : 'manual',
      });
      setForm(EMPTY_FORM);
      setError('');
      setRosskoLookupError('');
      setRosskoLookupNotice('');
      setFilledFromRossko(false);
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={title} size="sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Бренд</span>
          <span className="ml-1 text-xs font-normal text-gray-400">необязательно</span>
          <AutoserviceReceiptSuggestField
            field="brand"
            value={form.brand}
            onValueChange={(value) => patch('brand', value)}
            onPick={applyReceiptSuggestion}
            placeholder="Например, Bosch"
            inputClassName={`mt-1 ${fieldClass}`}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Артикул</span>
          <span className="ml-1 text-xs font-normal text-gray-400">необязательно</span>
          <div className="mt-1 flex h-10 items-stretch gap-2">
            <AutoserviceReceiptSuggestField
              field="article"
              value={form.article}
              onValueChange={(value) => patch('article', value)}
              onPick={applyReceiptSuggestion}
              placeholder="Например, 0986424794"
              inputClassName={fieldClass}
              className="min-w-0 flex-1"
            />
            {showRosskoLookup ? (
              <button
                type="button"
                onClick={handleFillFromRossko}
                disabled={rosskoLookupLoading || !form.article.trim()}
                className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold leading-none text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rosskoLookupLoading ? 'Поиск…' : 'Найти в Rossko'}
              </button>
            ) : null}
          </div>
        </label>
        {showRosskoLookup && rosskoLookupError ? (
          <p className="text-sm text-red-600">{rosskoLookupError}</p>
        ) : null}
        {showRosskoLookup && rosskoLookupNotice ? (
          <p className="text-sm text-green-700">{rosskoLookupNotice}</p>
        ) : null}
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Наименование</span>
          <span className="ml-1 text-xs font-normal text-red-500">*</span>
          <AutoserviceReceiptSuggestField
            field="name"
            value={form.name}
            onValueChange={(value) => patch('name', value)}
            onPick={applyReceiptSuggestion}
            placeholder="Например, Колодки тормозные"
            inputClassName={`mt-1 ${fieldClass}`}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Количество</span>
            <input
              type="number"
              min="1"
              step="1"
              className={`mt-1 ${fieldClass}`}
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
              className={`mt-1 ${fieldClass}`}
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
