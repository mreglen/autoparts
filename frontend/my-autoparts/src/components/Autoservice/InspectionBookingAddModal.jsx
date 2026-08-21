import { useEffect, useState } from 'react';
import Modal from '../UI/Modal';
import { apiRequest } from '../../utils/apiClient';
import { handlePhoneInputChange, validatePhone } from '../../utils/contactValidation';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

export default function InspectionBookingAddModal({
  open,
  onClose,
  onCreated,
  initialPreferredDate = null,
  workZoneId = null,
  title = 'Запись на осмотр',
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredDate, setPreferredDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setPhone('');
    setPreferredDate(initialPreferredDate || new Date().toISOString().slice(0, 10));
    setNotes('');
    setPhoneError('');
    setError(null);
    setSaving(false);
  }, [open, initialPreferredDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setPhoneError('');
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError('Укажите имя');
      return;
    }
    const phoneErr = validatePhone(phone);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }
    if (!preferredDate) {
      setError('Укажите желаемую дату');
      return;
    }
    setSaving(true);
    try {
      const row = await apiRequest('/autoservice/inspection-bookings', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          phone,
          preferred_date: preferredDate,
          notes: notes.trim() || null,
          ...(workZoneId != null ? { work_zone_id: Number(workZoneId) } : {}),
        }),
      });
      onCreated?.(row);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Не удалось создать заявку');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            form="add-inspection-booking"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Сохранение…' : 'Создать'}
          </button>
        </div>
      }
    >
      <form id="add-inspection-booking" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Имя</label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            required
            maxLength={120}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Телефон</label>
          <input
            type="tel"
            className={`${inputClass} ${phoneError ? 'border-red-500' : ''}`}
            value={phone}
            onChange={(e) => {
              handlePhoneInputChange(e, setPhone);
              setPhoneError('');
            }}
            placeholder="+7 (___) ___-__-__"
            disabled={saving}
            required
          />
          {phoneError ? <p className="mt-1 text-sm text-red-600">{phoneError}</p> : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Желаемая дата</label>
          <input
            type="date"
            className={inputClass}
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            disabled={saving}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Заметка</label>
          <textarea
            className={inputClass}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
            maxLength={2000}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}
