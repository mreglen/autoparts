import { useEffect, useState } from 'react';
import Modal from '../UI/Modal';
import PhoneInput from '../UI/PhoneInput';
import { apiRequest } from '../../utils/apiClient';
import {
  formatPhoneFromRaw,
  validatePhone,
} from '../../utils/contactValidation';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

export default function InspectionBookingAddModal({
  open,
  onClose,
  onCreated,
  onSaved,
  initialPreferredDate = null,
  workZoneId = null,
  title = 'Запись на осмотр',
  initialBooking = null,
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredDate, setPreferredDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isEdit = Boolean(initialBooking?.id);
  const initialName = (isEdit ? initialBooking.name : '') || '';
  const initialPhone = (isEdit ? initialBooking.phone : '') || '';
  const initialPreferred = (isEdit ? initialBooking.preferred_date : initialPreferredDate) || new Date().toISOString().slice(0, 10);
  const initialNotes = (isEdit ? initialBooking.notes : '') || '';

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setPhone(initialPhone);
    setPreferredDate(initialPreferred);
    setNotes(initialNotes);
    setPhoneError('');
    setError(null);
    setSaving(false);
    setIsEditing(!isEdit);
  }, [open, initialName, initialPhone, initialPreferred, initialNotes, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setPhoneError('');
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError(isEdit ? 'Укажите клиента' : 'Укажите имя');
      return;
    }
    const phoneErr = validatePhone(phone);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }
    if (!preferredDate) {
      setError(isEdit ? 'Укажите дату' : 'Укажите желаемую дату');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: trimmedName,
        phone,
        preferred_date: preferredDate,
        notes: notes.trim() || null,
      };
      if (!isEdit && workZoneId != null) {
        body.work_zone_id = Number(workZoneId);
      }
      const row = await apiRequest(
        isEdit ? `/autoservice/inspection-bookings/${initialBooking.id}` : '/autoservice/inspection-bookings',
        {
          method: isEdit ? 'PATCH' : 'POST',
          body: JSON.stringify(body),
        },
      );
      if (isEdit) {
        onSaved?.(row);
      } else {
        onCreated?.(row);
      }
      onClose?.();
    } catch (err) {
      setError(err?.message || (isEdit ? 'Не удалось сохранить заявку' : 'Не удалось создать заявку'));
    } finally {
      setSaving(false);
    }
  };

  function formatDateView(value) {
    if (!value) return '—';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ru-RU');
  }

  const modalTitle = isEdit
    ? (isEditing ? 'Редактировать запись' : 'Запись на осмотр')
    : title;

  const footer = isEditing ? (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={() => {
          if (isEdit) {
            setName(initialName);
            setPhone(initialPhone);
            setPreferredDate(initialPreferred);
            setNotes(initialNotes);
            setPhoneError('');
            setError(null);
            setIsEditing(false);
          } else {
            onClose?.();
          }
        }}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        disabled={saving}
      >
        {isEdit ? 'Отмена' : 'Закрыть'}
      </button>
      <button
        type="submit"
        form="add-inspection-booking"
        disabled={saving}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {saving ? 'Сохранение…' : 'Сохранить'}
      </button>
    </div>
  ) : (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        Закрыть
      </button>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        Редактировать
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      size="sm"
      footer={footer}
    >
      {isEditing ? (
        <form id="add-inspection-booking" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{isEdit ? 'Клиент' : 'Имя'}</label>
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
            <PhoneInput
              className={`${inputClass} ${phoneError ? 'border-red-500' : ''}`}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneError('');
              }}
              placeholder="+7 (___) ___-__-__"
              disabled={saving}
              required
            />
            {phoneError ? <p className="mt-1 text-sm text-red-600">{phoneError}</p> : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{isEdit ? 'Дата' : 'Желаемая дата'}</label>
            <input
              type="date"
              className={inputClass}
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              disabled={saving}
              required
            />
          </div>
          {isEdit && initialBooking?.vehicle && initialBooking.vehicle !== '—' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">Автомобиль</label>
              <p className="mt-1 text-sm text-gray-900">{initialBooking.vehicle}</p>
            </div>
          ) : null}
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
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Клиент</label>
            <p className="mt-0.5 text-sm text-gray-900">{name || '—'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Телефон</label>
            <p className="mt-0.5 text-sm text-gray-900">{formatPhoneFromRaw(phone) || '—'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Дата</label>
            <p className="mt-0.5 text-sm text-gray-900">{formatDateView(preferredDate)}</p>
          </div>
          {initialBooking?.vehicle && initialBooking.vehicle !== '—' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">Автомобиль</label>
              <p className="mt-0.5 text-sm text-gray-900">{initialBooking.vehicle}</p>
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700">Заметка</label>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-900">{notes || '—'}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
