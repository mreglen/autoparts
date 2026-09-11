import { useEffect, useRef, useState } from 'react';
import Modal from '../UI/Modal';
import PhoneInput from '../UI/PhoneInput';
import SearchablePillSelect from '../SearchablePillSelect/SearchablePillSelect';
import { apiRequest } from '../../utils/apiClient';
import {
  formatPhoneFromRaw,
  validatePhone,
} from '../../utils/contactValidation';

const inputClass = 'sg-pill-input mt-1';
const textareaClass = 'sg-pill-textarea mt-1';

function zoneNameById(zones, zoneId) {
  if (zoneId == null) return null;
  const id = Number(zoneId);
  return zones.find((z) => Number(z.id) === id)?.name || null;
}

export default function InspectionBookingAddModal({
  open,
  onClose,
  onCreated,
  onSaved,
  initialPreferredDate = null,
  workZoneId = null,
  zones = [],
  title = 'Запись на осмотр',
  initialBooking = null,
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredDate, setPreferredDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [preferredTime, setPreferredTime] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedWorkZoneId, setSelectedWorkZoneId] = useState(null);
  const [phoneError, setPhoneError] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const editStartedAtRef = useRef(0);
  const isEdit = Boolean(initialBooking?.id);
  const initialName = (isEdit ? initialBooking.name : '') || '';
  const initialPhone = (isEdit ? initialBooking.phone : '') || '';
  const initialPreferred = (isEdit ? initialBooking.preferred_date : initialPreferredDate) || new Date().toISOString().slice(0, 10);
  const initialPreferredTime = (isEdit ? initialBooking.preferred_time : '')?.slice(0, 5) || '';
  const initialNotes = (isEdit ? initialBooking.notes : '') || '';
  const initialWorkZoneId = (isEdit ? initialBooking.work_zone_id : workZoneId) ?? null;

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setPhone(initialPhone);
    setPreferredDate(initialPreferred);
    setPreferredTime(initialPreferredTime);
    setNotes(initialNotes);
    setSelectedWorkZoneId(initialWorkZoneId);
    setPhoneError('');
    setError(null);
    setSaving(false);
    setIsEditing(!isEdit);
  }, [open, initialName, initialPhone, initialPreferred, initialPreferredTime, initialNotes, initialWorkZoneId, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isEdit && Date.now() - editStartedAtRef.current < 500) return;
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
        preferred_time: preferredTime || null,
        notes: notes.trim() || null,
      };
      if (selectedWorkZoneId != null) {
        body.work_zone_id = Number(selectedWorkZoneId);
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

  function formatDateTimeView(dateValue, timeValue) {
    const date = formatDateView(dateValue);
    return timeValue ? `${date}, ${timeValue.slice(0, 5)}` : date;
  }

  const modalTitle = isEdit
    ? (isEditing ? 'Редактировать запись' : 'Запись на осмотр')
    : title;

  const footer = isEditing ? (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (isEdit) {
            setName(initialName);
            setPhone(initialPhone);
            setPreferredDate(initialPreferred);
            setPreferredTime(initialPreferredTime);
            setNotes(initialNotes);
            setSelectedWorkZoneId(initialWorkZoneId);
            setPhoneError('');
            setError(null);
            setIsEditing(false);
          } else {
            onClose?.();
          }
        }}
        className="rounded-sg-sm min-h-11 border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-muted"
        disabled={saving}
      >
        {isEdit ? 'Отмена' : 'Закрыть'}
      </button>
      <button
        type="submit"
        form="add-inspection-booking"
        disabled={saving}
        className="rounded-sg-sm min-h-11 bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? 'Сохранение…' : 'Сохранить'}
      </button>
    </div>
  ) : (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
        className="rounded-sg-sm min-h-11 border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-muted"
      >
        Закрыть
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          editStartedAtRef.current = Date.now();
          setIsEditing(true);
        }}
        className="rounded-sg-sm min-h-11 bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
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
            <label className="block text-sm font-medium text-ink-soft">{isEdit ? 'Клиент' : 'Имя'}</label>
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
            <label className="block text-sm font-medium text-ink-soft">Телефон</label>
            <PhoneInput
              className={`${inputClass} ${phoneError ? '!border-danger-600 !bg-danger-50 focus:!border-danger-600' : ''}`}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneError('');
              }}
              placeholder="+7 (___) ___-__-__"
              disabled={saving}
              required
            />
            {phoneError ? <p className="mt-1 text-sm text-danger-600">{phoneError}</p> : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-ink-soft">{isEdit ? 'Дата' : 'Желаемая дата'}</label>
              <input
                type="date"
                className={`${inputClass} sg-native-date-input`}
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                disabled={saving}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft">Время</label>
              <input
                type="time"
                className={inputClass}
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                disabled={saving}
                step="60"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft">Рабочая зона</label>
            <SearchablePillSelect
              className="mt-1"
              inputClassName="sg-pill-input"
              value={selectedWorkZoneId ?? ''}
              onChange={(value) => setSelectedWorkZoneId(value ? Number(value) : null)}
              options={zones.map((zone) => ({ value: zone.id, label: zone.name }))}
              placeholder="Введите рабочую зону"
              emptyOptionLabel="Не указано"
              disabled={saving || zones.length === 0}
              ariaLabel="Рабочая зона"
            />
          </div>
          {isEdit && initialBooking?.vehicle && initialBooking.vehicle !== '—' ? (
            <div>
              <label className="block text-sm font-medium text-ink-soft">Автомобиль</label>
              <p className="mt-1 text-sm text-ink">{initialBooking.vehicle}</p>
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-ink-soft">Заметка</label>
            <textarea
              className={textareaClass}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              maxLength={2000}
            />
          </div>
          {error ? <p className="text-sm text-danger-600">{error}</p> : null}
        </form>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-soft">Клиент</label>
            <p className="mt-0.5 text-sm text-ink">{name || '—'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft">Телефон</label>
            <p className="mt-0.5 text-sm text-ink">{formatPhoneFromRaw(phone) || '—'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft">Дата и время</label>
            <p className="mt-0.5 text-sm text-ink">{formatDateTimeView(preferredDate, preferredTime)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft">Рабочая зона</label>
            <p className="mt-0.5 text-sm text-ink">{zoneNameById(zones, selectedWorkZoneId) || '—'}</p>
          </div>
          {initialBooking?.vehicle && initialBooking.vehicle !== '—' ? (
            <div>
              <label className="block text-sm font-medium text-ink-soft">Автомобиль</label>
              <p className="mt-0.5 text-sm text-ink">{initialBooking.vehicle}</p>
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-ink-soft">Заметка</label>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{notes || '—'}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
