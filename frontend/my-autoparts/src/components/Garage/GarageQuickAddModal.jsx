import { useEffect, useState } from 'react';
import MobileFormField from '../MobileFormField/MobileFormField';
import SoftServiceNotice from '../SoftServiceNotice/SoftServiceNotice';
import { apiRequest } from '../../utils/apiClient';
import {
  candidateLabel,
  mapCandidateToGarageCreatePayload,
  mapCandidateToGarageForm,
  softNoticeVariantFromReason,
} from '../../utils/laximoVinCandidate';
import { normalizeVinOrNull, sanitizeVinInput, looksLikeVin, VIN_INPUT_MAX_LENGTH } from '../../utils/laximoVin';
import {
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseSecondaryButtonClass,
} from '../../utils/warehouseListUi';

const LOOKUP_INPUT_MAX_LENGTH = 32;
const formInputClass = `${warehousePillControlClass} mt-0`;
const formTextareaClass = `${formInputClass.replace('rounded-full', 'rounded-xl')} min-h-[80px] resize-y py-3`;

const emptyForm = {
  vin: '',
  make: '',
  model: '',
  year: '',
  color: '',
  plate: '',
  notes: '',
};

function detectLookupKind(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (looksLikeVin(raw)) return 'vin';
  const compact = raw.toUpperCase().replace(/\s+/g, '');
  if (compact.includes('-') && compact.length >= 6) return 'frame';
  if (/[А-ЯЁ]/.test(raw) && compact.length >= 6) return 'plate';
  if (compact.length >= 6 && compact.length <= 12 && /[A-Z]/.test(compact) && /\d/.test(compact)) return 'plate';
  if (compact.length >= 6) return 'frame';
  return null;
}

function formatLookupInput(value) {
  const raw = String(value || '');
  if (looksLikeVin(raw)) return sanitizeVinInput(raw);
  return raw.toUpperCase().replace(/\s+/g, ' ').trimStart();
}

function ModalShell({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Закрыть" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Закрыть"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function VehicleFormFields({ initial, onSubmit, onCancel, saving, submitLabel, notice, onRetryDecode, onBackToLookup }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const make = form.make.trim();
    const model = form.model.trim();
    if (!make || !model) {
      setError('Укажите марку и модель');
      return;
    }
    const year = form.year ? Number(form.year) : null;
    if (form.year && (!Number.isFinite(year) || year < 1900 || year > 2100)) {
      setError('Некорректный год');
      return;
    }
    try {
      await onSubmit({
        vin: form.vin.trim() || null,
        make,
        model,
        year,
        color: form.color.trim() || null,
        plate: form.plate.trim() || null,
        notes: form.notes.trim() || null,
      });
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {notice ? <SoftServiceNotice variant={notice} onRetry={onRetryDecode} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MobileFormField label="Марка" htmlFor="garage-add-make" required>
          <input
            id="garage-add-make"
            className={formInputClass}
            value={form.make}
            onChange={(event) => setForm((prev) => ({ ...prev, make: event.target.value }))}
            required
            disabled={saving}
            maxLength={80}
          />
        </MobileFormField>
        <MobileFormField label="Модель" htmlFor="garage-add-model" required>
          <input
            id="garage-add-model"
            className={formInputClass}
            value={form.model}
            onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
            required
            disabled={saving}
            maxLength={80}
          />
        </MobileFormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MobileFormField label="Год" htmlFor="garage-add-year">
          <input
            id="garage-add-year"
            type="number"
            className={formInputClass}
            value={form.year}
            onChange={(event) => setForm((prev) => ({ ...prev, year: event.target.value }))}
            min={1900}
            max={2100}
            disabled={saving}
          />
        </MobileFormField>
        <MobileFormField label="Госномер" htmlFor="garage-add-plate">
          <input
            id="garage-add-plate"
            className={formInputClass}
            value={form.plate}
            onChange={(event) => setForm((prev) => ({ ...prev, plate: event.target.value.toUpperCase() }))}
            disabled={saving}
            maxLength={20}
          />
        </MobileFormField>
      </div>

      <MobileFormField label="VIN" htmlFor="garage-add-vin">
        <input
          id="garage-add-vin"
          className={formInputClass}
          value={form.vin}
          onChange={(event) => setForm((prev) => ({ ...prev, vin: sanitizeVinInput(event.target.value) }))}
          maxLength={VIN_INPUT_MAX_LENGTH}
          disabled={saving}
        />
      </MobileFormField>

      <MobileFormField label="Заметка" htmlFor="garage-add-notes">
        <textarea
          id="garage-add-notes"
          className={formTextareaClass}
          rows={2}
          value={form.notes}
          onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          disabled={saving}
        />
      </MobileFormField>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
        <button type="button" onClick={onBackToLookup} disabled={saving} className={warehouseSecondaryButtonClass}>
          Назад
        </button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={onCancel} disabled={saving} className={warehouseSecondaryButtonClass}>
            Отмена
          </button>
          <button type="submit" disabled={saving} className={warehousePrimaryButtonClass}>
            {saving ? 'Сохранение…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function GarageQuickAddModal({ onClose, onCreated, clientId = null }) {
  const [step, setStep] = useState('lookup');
  const [lookupInput, setLookupInput] = useState('');
  const [lookupDecoding, setLookupDecoding] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [resolvedPlate, setResolvedPlate] = useState('');
  const [frameInput, setFrameInput] = useState('');
  const [lookupFromPlate, setLookupFromPlate] = useState(false);
  const [lookupFromFrame, setLookupFromFrame] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [addCandidates, setAddCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [addNotice, setAddNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  const resetToLookup = () => {
    setStep('lookup');
    setLookupInput('');
    setLookupError('');
    setResolvedPlate('');
    setFrameInput('');
    setLookupFromPlate(false);
    setLookupFromFrame(false);
    setAddForm(emptyForm);
    setAddCandidates([]);
    setSelectedCandidate(null);
    setAddNotice(null);
  };

  const openManualForm = () => {
    setSelectedCandidate(null);
    setLookupFromPlate(false);
    setLookupFromFrame(false);
    setAddNotice(null);
    setAddForm(emptyForm);
    setStep('form');
  };

  const applyCandidate = (candidate, vin, plate = '') => {
    setSelectedCandidate(candidate);
    setAddForm(mapCandidateToGarageForm(candidate, vin, plate));
    setAddNotice(null);
    setStep('form');
  };

  const handleDecodeVin = async (rawValue) => {
    setLookupError('');
    const vin = normalizeVinOrNull(rawValue ?? lookupInput);
    if (!vin) {
      setLookupError('VIN должен содержать от 11 до 17 символов');
      return;
    }
    setLookupInput(vin);
    setLookupDecoding(true);
    setLookupFromPlate(false);
    setLookupFromFrame(false);
    setResolvedPlate('');
    setFrameInput('');
    try {
      const result = await apiRequest('/autoservice/garage/decode-vin', {
        method: 'POST',
        body: JSON.stringify({ vin }),
      });
      const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
      if (result?.ok && candidates.length === 1) {
        applyCandidate(candidates[0], vin, resolvedPlate);
        return;
      }
      if (result?.ok && candidates.length > 1) {
        setAddCandidates(candidates);
        setSelectedCandidate(null);
        setAddForm({ ...emptyForm, vin, plate: resolvedPlate });
        setAddNotice(null);
        setStep('pick');
        return;
      }
      setSelectedCandidate(null);
      setAddForm({ ...emptyForm, vin, plate: resolvedPlate });
      setAddNotice(softNoticeVariantFromReason(result?.reason));
      setStep('form');
    } catch (err) {
      setLookupError(err?.message || 'Не удалось распознать VIN');
    } finally {
      setLookupDecoding(false);
    }
  };

  const handleDecodePlate = async (rawValue) => {
    setLookupError('');
    const plate = String(rawValue ?? lookupInput).trim();
    if (plate.length < 6) {
      setLookupError('Укажите госномер');
      return;
    }
    setLookupInput(formatLookupInput(plate));
    setLookupDecoding(true);
    setLookupFromPlate(true);
    setLookupFromFrame(false);
    setFrameInput('');
    try {
      const result = await apiRequest('/autoservice/garage/decode-plate', {
        method: 'POST',
        body: JSON.stringify({ plate, country_code: 'ru' }),
      });
      const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
      const vin = (result?.vin || '').trim().toUpperCase();
      const normalizedPlate = (result?.plate || plate).trim();
      setResolvedPlate(normalizedPlate);
      setLookupInput(normalizedPlate);
      if (result?.ok && candidates.length === 1) {
        applyCandidate(candidates[0], vin, normalizedPlate);
        return;
      }
      if (result?.ok && candidates.length > 1) {
        setAddCandidates(candidates);
        setSelectedCandidate(null);
        setAddForm({ ...emptyForm, vin, plate: normalizedPlate });
        setAddNotice(null);
        setStep('pick');
        return;
      }
      setSelectedCandidate(null);
      setAddForm({ ...emptyForm, vin, plate: normalizedPlate });
      setAddNotice(softNoticeVariantFromReason(result?.reason));
      setStep('form');
    } catch (err) {
      setLookupError(err?.message || 'Не удалось распознать госномер');
    } finally {
      setLookupDecoding(false);
    }
  };

  const handleDecodeFrame = async (rawValue) => {
    setLookupError('');
    const frame = String(rawValue ?? lookupInput).trim().toUpperCase().replace(/\s+/g, '');
    if (frame.length < 6) {
      setLookupError('Укажите Frame (номер кузова)');
      return;
    }
    setLookupInput(frame);
    setLookupDecoding(true);
    setLookupFromPlate(false);
    setLookupFromFrame(true);
    setResolvedPlate('');
    try {
      const result = await apiRequest('/autoservice/garage/decode-frame', {
        method: 'POST',
        body: JSON.stringify({ frame }),
      });
      const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
      const normalizedFrame = (result?.frame || frame).trim();
      setFrameInput(normalizedFrame);
      setLookupInput(normalizedFrame);
      if (result?.ok && candidates.length === 1) {
        applyCandidate(candidates[0], '', resolvedPlate);
        return;
      }
      if (result?.ok && candidates.length > 1) {
        setAddCandidates(candidates);
        setSelectedCandidate(null);
        setAddForm({ ...emptyForm, plate: resolvedPlate });
        setAddNotice(null);
        setStep('pick');
        return;
      }
      setSelectedCandidate(null);
      setAddForm({ ...emptyForm, plate: resolvedPlate });
      setAddNotice(softNoticeVariantFromReason(result?.reason));
      setStep('form');
    } catch (err) {
      setLookupError(err?.message || 'Не удалось распознать Frame');
    } finally {
      setLookupDecoding(false);
    }
  };

  const handleDecodeLookup = async () => {
    setLookupError('');
    const raw = lookupInput.trim();
    if (!raw) {
      setLookupError('Введите VIN, госномер или Frame');
      return;
    }
    const kind = detectLookupKind(raw);
    if (kind === 'vin') {
      await handleDecodeVin(raw);
      return;
    }
    if (kind === 'plate') {
      await handleDecodePlate(raw);
      return;
    }
    if (kind === 'frame') {
      await handleDecodeFrame(raw);
      return;
    }
    setLookupError('Не удалось определить тип. Проверьте VIN, госномер или Frame.');
  };

  const handleCreateVehicle = async (body) => {
    setSaving(true);
    try {
      const payload = mapCandidateToGarageCreatePayload(
        selectedCandidate,
        {
          vin: body.vin || '',
          make: body.make,
          model: body.model,
          year: body.year != null ? String(body.year) : '',
          color: body.color || '',
          plate: body.plate || '',
          notes: body.notes || '',
        },
        {
          fromPlate: lookupFromPlate,
          fromFrame: lookupFromFrame,
          frameQuery: lookupFromFrame ? frameInput.trim() : '',
        },
      );
      payload.year = body.year;
      const row = await apiRequest(
        clientId ? '/autoservice/garage/vehicles/staff' : '/autoservice/garage/vehicles',
        {
        method: 'POST',
          body: JSON.stringify(clientId ? { ...payload, client_id: Number(clientId) } : payload),
        }
      );
      onCreated?.(row);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  if (step === 'pick') {
    return (
      <ModalShell title="Выберите автомобиль" onClose={onClose}>
        <p className="text-sm text-gray-600">Найдено несколько вариантов — выберите подходящий.</p>
        <ul className="mt-4 space-y-2">
          {addCandidates.map((candidate, idx) => (
            <li key={`${candidate.vehicle_id || 'v'}-${idx}`}>
              <button
                type="button"
                onClick={() =>
                  applyCandidate(
                    candidate,
                    addForm.vin || lookupInput.trim().toUpperCase(),
                    addForm.plate || resolvedPlate,
                  )
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm transition hover:border-gray-300 hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{candidateLabel(candidate)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={openManualForm} className={`${warehouseSecondaryButtonClass} mt-4`}>
          Добавить по марке вручную
        </button>
      </ModalShell>
    );
  }

  if (step === 'form') {
    return (
      <ModalShell title="Данные автомобиля" onClose={onClose}>
        <VehicleFormFields
          initial={addForm}
          saving={saving}
          submitLabel="Сохранить"
          notice={addNotice}
          onRetryDecode={
            addNotice
              ? () => {
                  setStep('lookup');
                  setLookupInput(addForm.vin || addForm.plate || frameInput || lookupInput);
                  setLookupError('');
                  setAddNotice(null);
                }
              : undefined
          }
          onBackToLookup={resetToLookup}
          onCancel={onClose}
          onSubmit={handleCreateVehicle}
        />
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Добавить автомобиль" onClose={onClose}>
      <p className="text-sm text-gray-600">
        Введите VIN, госномер или Frame — подставим данные автоматически.
      </p>

      <div className="mt-4 space-y-4">
        <MobileFormField label="Госномер, VIN или Frame" htmlFor="garage-add-lookup">
          <input
            id="garage-add-lookup"
            className={formInputClass}
            value={lookupInput}
            onChange={(event) => {
              setLookupInput(formatLookupInput(event.target.value));
              setLookupError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleDecodeLookup();
              }
            }}
            maxLength={LOOKUP_INPUT_MAX_LENGTH}
            disabled={lookupDecoding}
            placeholder="А123БВ77, WVWZZZ1JZYW123456 или SGL5-400683"
            autoComplete="off"
            autoFocus
          />
        </MobileFormField>

        {lookupError ? (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
            {lookupError}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button type="button" onClick={openManualForm} disabled={lookupDecoding} className={warehouseSecondaryButtonClass}>
            Добавить по марке
          </button>
          <button type="button" onClick={handleDecodeLookup} disabled={lookupDecoding} className={warehousePrimaryButtonClass}>
            {lookupDecoding ? 'Проверка…' : 'Продолжить'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
