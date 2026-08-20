import React, { useEffect, useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import { apiAxios } from '../../utils/apiClient';
import AutoserviceReceiptSuggestField from './AutoserviceReceiptSuggestField';
import {
  pickBestRosskoPart,
} from '../../pages/AutoParts/NewParts/rosskoHelpers';

const EMPTY_FORM = {
  brand: '',
  article: '',
  name: '',
  quantity: '1',
  unit: 'pcs',
  unit_price: '',
};

const fieldClass =
  'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-0';

export default function AutoserviceWarehouseAddModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
  title = 'Добавить запчасть вручную',
  submitLabel = 'Добавить',
  showRosskoLookup = true,
  showUnitSelector = true,
  initialValues = null,
  preserveDraftOnClose = false,
  onDraftPersist,
  mode = 'add',
  editScope = null,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [rosskoLookupLoading, setRosskoLookupLoading] = useState(false);
  const [rosskoLookupError, setRosskoLookupError] = useState('');
  const [rosskoLookupNotice, setRosskoLookupNotice] = useState('');
  const [filledFromRossko, setFilledFromRossko] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialValues) {
      setForm({
        brand: initialValues.brand ?? '',
        article: initialValues.article ?? '',
        name: initialValues.name ?? '',
        quantity: initialValues.quantity == null || initialValues.quantity === ''
          ? '1'
          : String(initialValues.quantity),
        unit: initialValues.unit || 'pcs',
        unit_price: initialValues.unit_price == null || initialValues.unit_price === ''
          ? ''
          : String(initialValues.unit_price),
      });
    } else if (!(preserveDraftOnClose && mode === 'add')) {
      setForm(EMPTY_FORM);
    }
    setError('');
    setRosskoLookupError('');
    setRosskoLookupNotice('');
    setFilledFromRossko(false);
  }, [open, initialValues, preserveDraftOnClose, mode]);

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
    if (preserveDraftOnClose && mode === 'add') {
      onDraftPersist?.({ ...form });
    } else {
      setForm(EMPTY_FORM);
    }
    setError('');
    setRosskoLookupError('');
    setRosskoLookupNotice('');
    setFilledFromRossko(false);
    onClose?.();
  };

  const handleFillFromRossko = async () => {
    const article = form.article.trim();
    if (!article) {
      setRosskoLookupError('Введите артикул для поиска в Rossko');
      return;
    }

    setRosskoLookupLoading(true);
    setRosskoLookupError('');
    setRosskoLookupNotice('');

    try {
      const response = await apiAxios.post('/rossko/GetSearch', {
        text: article,
        delivery_id: '000000001',
        address_id: 176458,
      });

      const best = pickBestRosskoPart(response.data, article, '');
      if (!best) {
        setRosskoLookupError('В Rossko ничего не найдено по этому артикулу');
        return;
      }

      const filledArticle = best.partnumber || article;
      const filledBrand = best.brand || '';
      const filledName = best.name || form.name;

      setForm((prev) => ({
        ...prev,
        article: filledArticle,
        brand: filledBrand || prev.brand,
        name: filledName || prev.name,
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
    const unit = form.unit || 'pcs';
    const isWarehouseEdit = mode === 'edit' && editScope === 'warehouse';
    const quantityRaw = Number(form.quantity);
    const unitPrice = Number(form.unit_price);
    if (!name) {
      setError('Укажите наименование');
      return;
    }
    if (!isWarehouseEdit) {
      if (unit === 'pcs') {
        const quantity = Math.round(quantityRaw);
        if (!Number.isFinite(quantity) || quantity < 1) {
          setError('Количество должно быть целым числом ≥ 1');
          return;
        }
      } else if (!Number.isFinite(quantityRaw) || quantityRaw < 0.001) {
        setError('Количество должно быть ≥ 0,001');
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        setError('Цена должна быть ≥ 0');
        return;
      }
    } else if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError('Себестоимость должна быть ≥ 0');
      return;
    }
    try {
      await onSubmit({
        brand: form.brand.trim(),
        article: form.article.trim(),
        name,
        quantity: unit === 'pcs' ? Math.round(quantityRaw) : quantityRaw,
        unit,
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

  const modalTitle = mode === 'edit' ? 'Редактировать товар' : title;
  const modalSubmitLabel = mode === 'edit' ? 'Сохранить' : submitLabel;
  const isWarehouseEdit = mode === 'edit' && editScope === 'warehouse';

  return (
    <Modal open={open} onClose={handleClose} title={modalTitle} size="sm">
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
        <div className={`grid gap-3 ${isWarehouseEdit ? 'grid-cols-2' : showUnitSelector ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {!isWarehouseEdit ? (
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Количество</span>
              <input
                type="number"
                min={form.unit === 'pcs' ? 1 : 0.001}
                step={form.unit === 'pcs' ? 1 : 0.001}
                className={`mt-1 ${fieldClass}`}
                value={form.quantity}
                onChange={(e) => patch('quantity', e.target.value)}
                required
              />
            </label>
          ) : null}
          {showUnitSelector ? (
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Ед.</span>
              <select
                className={`mt-1 ${fieldClass}`}
                value={form.unit}
                onChange={(e) => patch('unit', e.target.value)}
              >
                <option value="pcs">шт.</option>
                <option value="l">л</option>
                <option value="kg">кг</option>
              </select>
            </label>
          ) : null}
          {!isWarehouseEdit ? (
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
              />
            </label>
          ) : (
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Себестоимость, ₽</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className={`mt-1 ${fieldClass}`}
                value={form.unit_price}
                onChange={(e) => patch('unit_price', e.target.value)}
                placeholder="0"
              />
            </label>
          )}
        </div>
        {isWarehouseEdit ? (
          <p className="text-xs text-gray-500">
            Себестоимость обновит карточку товара. Даты и суммы в уже созданных поступлениях и расходах не изменятся.
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Отмена
          </Button>
          <Button type="submit" loading={submitting}>
            {modalSubmitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
