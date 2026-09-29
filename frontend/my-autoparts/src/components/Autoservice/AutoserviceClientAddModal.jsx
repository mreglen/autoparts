import { useEffect, useRef, useState } from 'react';
import Modal from '../UI/Modal';
import PhoneInput from '../UI/PhoneInput';
import { apiRequest } from '../../utils/apiClient';
import { validatePhoneOptional } from '../../utils/contactValidation';

const inputClass = 'sg-pill-input mt-1';

export default function AutoserviceClientAddModal({ open = true, onClose, onCreated, initialName = '' }) {
  const [name, setName] = useState(() => String(initialName || '').trim());
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName(String(initialName || '').trim());
    setPhone('');
    setPhoneError('');
    setError(null);
    setSaving(false);
  }, [open, initialName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setPhoneError('');
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError('Укажите имя');
      return;
    }
    const phoneErr = validatePhoneOptional(phone);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }
    setSaving(true);
    try {
      const payload = { name: trimmedName };
      if (phone.trim()) payload.phone = phone;
      const row = await apiRequest('/autoservice/clients', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onCreated(row);
      onClose();
    } catch (err) {
      const msg = err?.message || 'Не удалось добавить клиента';
      if (/телефон/i.test(msg)) {
        setPhoneError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить клиента"
      size="sm"
      initialFocusRef={nameInputRef}
      draggable
      footer={
        <div className="flex justify-end gap-2 max-md:flex-col">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sg-sm border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-muted max-md:min-h-11"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            form="add-autoservice-client"
            disabled={saving}
            className="rounded-sg-sm bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 max-md:min-h-11"
          >
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </div>
      }
    >
      <form id="add-autoservice-client" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-soft">ФИО</label>
          <input
            ref={nameInputRef}
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Иванов Иван Иванович"
            disabled={saving}
            required
            maxLength={120}
            autoComplete="name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-soft">Телефон (необязательно)</label>
          <PhoneInput
            className={`${inputClass} ${phoneError ? '!border-danger-600 !bg-danger-50 focus:!border-danger-600' : ''}`}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setPhoneError('');
            }}
            placeholder="+7 (___) ___-__-__"
            disabled={saving}
            autoComplete="tel"
          />
          {phoneError ? <p className="mt-1 text-sm text-danger-600">{phoneError}</p> : null}
        </div>
        {error ? <p className="text-sm text-danger-600">{error}</p> : null}
      </form>
    </Modal>
  );
}
