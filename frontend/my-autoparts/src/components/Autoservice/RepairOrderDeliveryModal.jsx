import { useEffect, useState } from 'react';
import Modal from '../UI/Modal';
import NumericInput from '../UI/NumericInput';

const btnPrimaryClass =
  'inline-flex min-h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 sm:min-h-10';

const btnSecondaryClass =
  'inline-flex min-h-11 items-center justify-center rounded-sg-sm border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition hover:bg-surface-muted disabled:opacity-60 sm:min-h-10';

const inputClass =
  'sg-pill-input sg-pill-input-sm w-full';

export default function RepairOrderDeliveryModal({ open, deliveries, onClose, onSave }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!open) return;
    setItems((deliveries || []).map((d) => ({ title: d.title || '', price: d.price ?? '' })));
  }, [open, deliveries]);

  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { title: `Доставка ${prev.length + 1}`, price: '' },
    ]);
  };

  const handleSave = () => {
    onSave?.(
      items.map((item) => ({
        title: item.title.trim(),
        price: item.price === '' || item.price == null ? '0' : String(item.price),
      }))
    );
    onClose?.();
  };

  return (
    <Modal open={open} onClose={onClose} title="Доставка" size="sm">
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-ink-muted">Доставки не добавлены</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr,1fr,auto] items-end gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    Наименование
                  </label>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateItem(index, { title: e.target.value })}
                    className={inputClass}
                    placeholder="Доставка"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    Цена
                  </label>
                  <NumericInput
                    mode="decimal"
                    value={item.price}
                    onChange={(e) => updateItem(index, { price: e.target.value })}
                    className={inputClass}
                    placeholder="0"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="flex h-9 w-9 items-center justify-center rounded-sg border border-line bg-surface text-ink-muted transition hover:bg-surface-muted"
                  aria-label="Удалить доставку"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addItem}
          className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          + Добавить доставку
        </button>
        <div className="flex justify-end gap-2 pt-2 max-md:flex-col">
          <button type="button" onClick={onClose} className={btnSecondaryClass}>
            Отмена
          </button>
          <button type="button" onClick={handleSave} className={btnPrimaryClass}>
            Сохранить
          </button>
        </div>
      </div>
    </Modal>
  );
}
