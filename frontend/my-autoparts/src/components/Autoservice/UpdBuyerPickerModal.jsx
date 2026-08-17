import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../UI/Modal';
import { apiRequest } from '../../utils/apiClient';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 disabled:bg-gray-50';
const secondaryBtnClass =
  'inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 md:h-10';
const primaryBtnClass =
  'inline-flex h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60 md:h-10';

function buyerLabel(row) {
  const parts = [];
  if (row.inn) parts.push(`ИНН ${row.inn}`);
  if (row.kpp) parts.push(`КПП ${row.kpp}`);
  if (row.address) parts.push(row.address);
  return parts.join(' · ');
}

function emptyForm(name = '') {
  return {
    name: name || '',
    address: '',
    inn: '',
    kpp: '',
  };
}

function formFromBuyer(row) {
  return {
    name: row.name || '',
    address: row.address || '',
    inn: row.inn || '',
    kpp: row.kpp || '',
  };
}

export default function UpdBuyerPickerModal({
  open,
  onClose,
  orderId,
  defaultName = '',
  onSelected,
}) {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [formMode, setFormMode] = useState('list');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const resetCreateForm = useCallback(() => {
    setForm(emptyForm(defaultName));
  }, [defaultName]);

  const loadBuyers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/autoservice/document-buyers');
      setBuyers(Array.isArray(data) ? data : []);
    } catch (e) {
      setBuyers([]);
      setError(e?.message || 'Не удалось загрузить покупателей');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setFormMode('list');
    setEditingId(null);
    setError('');
    resetCreateForm();
    loadBuyers();
    return undefined;
  }, [open, loadBuyers, resetCreateForm]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter((row) => {
      const hay = `${row.name || ''} ${row.inn || ''} ${row.address || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [buyers, query]);

  const openPrint = (buyerId) => {
    if (!orderId || !buyerId) return;
    window.open(
      `/autoservice/orders/${orderId}/print/upd?buyerId=${encodeURIComponent(buyerId)}`,
      '_blank',
      'noopener,noreferrer',
    );
    onSelected?.(buyerId);
    onClose?.();
  };

  const payloadFromForm = (name) => ({
    name,
    address: form.address.trim() || null,
    inn: form.inn.trim() || null,
    kpp: form.kpp.trim() || null,
  });

  const backToList = () => {
    setFormMode('list');
    setEditingId(null);
    setError('');
  };

  const startEdit = (row) => {
    setForm(formFromBuyer(row));
    setEditingId(row.id);
    setFormMode('edit');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (name.length < 2) {
      setError('Укажите наименование покупателя');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (formMode === 'edit' && editingId) {
        const row = await apiRequest(`/autoservice/document-buyers/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payloadFromForm(name)),
        });
        setBuyers((prev) => prev.map((item) => (item.id === row.id ? row : item)));
        backToList();
        return;
      }
      const row = await apiRequest('/autoservice/document-buyers', {
        method: 'POST',
        body: JSON.stringify(payloadFromForm(name)),
      });
      openPrint(row.id);
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить покупателя');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Покупатель для УПД"
      size="sm"
      wrapperClassName="z-[130]"
    >
      {formMode !== 'list' ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm text-gray-500">
            {formMode === 'edit'
              ? 'Изменения сохранятся в справочнике.'
              : 'Новый покупатель сохранится в справочнике.'}
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600">Наименование</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
              maxLength={255}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Адрес</label>
            <input
              className={inputClass}
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600">ИНН</label>
              <input
                className={inputClass}
                inputMode="numeric"
                maxLength={12}
                value={form.inn}
                onChange={(e) =>
                  setForm((p) => ({ ...p, inn: e.target.value.replace(/\D/g, '').slice(0, 12) }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">КПП</label>
              <input
                className={inputClass}
                inputMode="numeric"
                maxLength={9}
                value={form.kpp}
                onChange={(e) =>
                  setForm((p) => ({ ...p, kpp: e.target.value.replace(/\D/g, '').slice(0, 9) }))
                }
                placeholder="для юрлица"
              />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className={secondaryBtnClass}
              disabled={saving}
              onClick={backToList}
            >
              К списку
            </button>
            <button type="submit" className={primaryBtnClass} disabled={saving}>
              {saving
                ? 'Сохранение…'
                : formMode === 'edit'
                  ? 'Сохранить'
                  : 'Сохранить и открыть'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <input
            className={inputClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени или ИНН"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {loading ? (
            <p className="py-6 text-center text-sm text-gray-500">Загрузка…</p>
          ) : filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              {buyers.length === 0 ? 'Покупателей пока нет' : 'Нет совпадений'}
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto rounded-lg border border-gray-200">
              {filtered.map((row) => {
                const details = buyerLabel(row);
                return (
                  <li key={row.id} className="flex items-stretch border-b border-gray-100 last:border-b-0">
                    <button
                      type="button"
                      className="min-w-0 flex-1 px-3 py-2.5 text-left text-sm hover:bg-indigo-50"
                      onClick={() => openPrint(row.id)}
                    >
                      <span className="block font-medium text-gray-900">{row.name}</span>
                      {details ? (
                        <span className="mt-0.5 block text-xs text-gray-500">{details}</span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="shrink-0 border-l border-gray-100 px-3 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                      onClick={() => startEdit(row)}
                    >
                      Изменить
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            className={`${primaryBtnClass} w-full`}
            onClick={() => {
              resetCreateForm();
              setEditingId(null);
              setFormMode('create');
              setError('');
            }}
          >
            Новый покупатель
          </button>
        </div>
      )}
    </Modal>
  );
}
