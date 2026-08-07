import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import SoftServiceNotice from '../../components/SoftServiceNotice/SoftServiceNotice';
import { apiRequest } from '../../utils/apiClient';
import { selectIsAutoserviceClient } from '../../redux/slices/AutoserviceClientSlice';
import {
  candidateLabel,
  mapCandidateToGarageCreatePayload,
  mapCandidateToGarageForm,
  softNoticeVariantFromReason,
} from '../../utils/laximoVinCandidate';
import { normalizeVinOrNull, sanitizeVinInput, VIN_INPUT_MAX_LENGTH } from '../../utils/laximoVin';
import { normalizePlate } from '../../utils/laximoPlate';
import { detectVehicleLookupKind, formatVehicleLookupInput } from '../../utils/vehicleLookupKind';
import { sanitizeResolvedVin } from '../../utils/laximoVinCandidate';

const LOOKUP_INPUT_MAX_LENGTH = 32;

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

const emptyForm = {
  vin: '',
  make: '',
  model: '',
  year: '',
  color: '',
  plate: '',
  notes: '',
};

function Modal({ title, children, onClose }) {
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

function VehicleForm({ initial, onSubmit, onCancel, saving, submitLabel, notice, onRetryDecode }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
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
      {notice ? (
        <SoftServiceNotice variant={notice} onRetry={onRetryDecode} />
      ) : null}
      {notice === 'not_found' ? (
        <p className="text-sm text-gray-600">
          <Link to="/autoparts/vin?wizard=1" className="font-medium text-indigo-600 hover:underline">
            Подобрать в каталоге
          </Link>
          {' — по параметрам автомобиля, без сохранения в гараж.'}
        </p>
      ) : null}
      <div>
        <label className="block text-sm font-medium text-gray-700">VIN</label>
        <input
          className={inputClass}
          value={form.vin}
          onChange={(e) => setForm((p) => ({ ...p, vin: sanitizeVinInput(e.target.value) }))}
          maxLength={VIN_INPUT_MAX_LENGTH}
          disabled={saving}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Марка</label>
        <input
          className={inputClass}
          value={form.make}
          onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))}
          required
          disabled={saving}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Модель</label>
        <input
          className={inputClass}
          value={form.model}
          onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
          required
          disabled={saving}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Год</label>
        <input
          type="number"
          className={inputClass}
          value={form.year}
          onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
          min={1900}
          max={2100}
          disabled={saving}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Цвет</label>
        <input
          className={inputClass}
          value={form.color}
          onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
          disabled={saving}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Госномер</label>
        <input
          className={inputClass}
          value={form.plate}
          onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))}
          disabled={saving}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Заметка</label>
        <textarea
          className={inputClass}
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          disabled={saving}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          disabled={saving}
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Сохранение…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export default function GaragePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo || null;
  const { isReady, isAuthenticated } = useAuthReady();
  const isClient = useSelector(selectIsAutoserviceClient);
  const clientStatus = useSelector((state) => state.autoserviceClient.status);

  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [pageError, setPageError] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addStep, setAddStep] = useState('vin');
  const [lookupInput, setLookupInput] = useState('');
  const [lookupDecoding, setLookupDecoding] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [resolvedPlate, setResolvedPlate] = useState('');
  const [resolvedVin, setResolvedVin] = useState('');
  const [frameInput, setFrameInput] = useState('');
  const [lookupFromPlate, setLookupFromPlate] = useState(false);
  const [lookupFromFrame, setLookupFromFrame] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [addSaving, setAddSaving] = useState(false);
  const [addCandidates, setAddCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [addNotice, setAddNotice] = useState(null);

  const [editVehicle, setEditVehicle] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadVehicles = useCallback(async () => {
    setVehiclesLoading(true);
    setPageError(null);
    try {
      const data = await apiRequest('/autoservice/garage/vehicles');
      setVehicles(Array.isArray(data) ? data : []);
    } catch (err) {
      setPageError(err?.message || 'Не удалось загрузить автомобили');
      setVehicles([]);
    } finally {
      setVehiclesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated && clientStatus === 'succeeded' && !isClient) {
      navigate('/autoservice/welcome', { replace: true });
    }
  }, [isReady, isAuthenticated, clientStatus, isClient, navigate]);

  useEffect(() => {
    if (isReady && isAuthenticated && isClient) {
      loadVehicles();
    }
  }, [isReady, isAuthenticated, isClient, loadVehicles]);

  const openAdd = () => {
    setAddStep('vin');
    setLookupInput('');
    setLookupError(null);
    setResolvedPlate('');
    setResolvedVin('');
    setFrameInput('');
    setLookupFromPlate(false);
    setLookupFromFrame(false);
    setAddForm(emptyForm);
    setAddCandidates([]);
    setSelectedCandidate(null);
    setAddNotice(null);
    setAddOpen(true);
  };

  useEffect(() => {
    if (!location.state?.openAdd) return;
    openAdd();
    navigate(location.pathname, {
      replace: true,
      state: location.state?.returnTo ? { returnTo: location.state.returnTo } : {},
    });
  }, [location.pathname, location.state?.openAdd, location.state?.returnTo, navigate]);

  const applyCandidate = (candidate, vin, plate = '') => {
    setSelectedCandidate(candidate);
    setAddForm(mapCandidateToGarageForm(candidate, vin, plate));
    setAddNotice(null);
    setAddStep('form');
  };

  const handleDecodeVin = async (rawValue) => {
    setLookupError(null);
    const vin = normalizeVinOrNull(rawValue ?? lookupInput);
    if (!vin) {
      setLookupError('VIN должен содержать от 11 до 17 символов');
      return;
    }
    setLookupInput(vin);
    setResolvedVin(vin);
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
        setAddStep('pick');
        return;
      }
      setSelectedCandidate(null);
      setAddForm({ ...emptyForm, vin, plate: resolvedPlate });
      setAddNotice(softNoticeVariantFromReason(result?.reason));
      setAddStep('form');
    } catch (err) {
      setLookupError(err?.message || 'Не удалось распознать VIN');
    } finally {
      setLookupDecoding(false);
    }
  };

  const handleDecodePlate = async (rawValue) => {
    setLookupError(null);
    const plate = normalizePlate(rawValue ?? lookupInput);
    if (!plate || plate.length < 6) {
      setLookupError('Укажите корректный госномер');
      return;
    }
    setLookupInput(formatVehicleLookupInput(rawValue ?? lookupInput));
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
      const vin = sanitizeResolvedVin(result?.vin || '');
      const normalizedPlate = (result?.plate || plate).trim();
      setResolvedPlate(normalizedPlate);
      setResolvedVin(vin);
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
        setAddStep('pick');
        return;
      }
      setSelectedCandidate(null);
      setAddForm({ ...emptyForm, vin, plate: normalizedPlate });
      setAddNotice(softNoticeVariantFromReason(result?.reason));
      setAddStep('form');
    } catch (err) {
      setLookupError(err?.message || 'Не удалось распознать госномер');
    } finally {
      setLookupDecoding(false);
    }
  };

  const handleDecodeFrame = async (rawValue) => {
    setLookupError(null);
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
    setResolvedVin('');
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
        setAddStep('pick');
        return;
      }
      setSelectedCandidate(null);
      setAddForm({ ...emptyForm, plate: resolvedPlate });
      setAddNotice(softNoticeVariantFromReason(result?.reason));
      setAddStep('form');
    } catch (err) {
      setLookupError(err?.message || 'Не удалось распознать Frame');
    } finally {
      setLookupDecoding(false);
    }
  };

  const handleDecodeLookup = async () => {
    setLookupError(null);
    const raw = lookupInput.trim();
    if (!raw) {
      setLookupError('Введите VIN, госномер или Frame');
      return;
    }
    const kind = detectVehicleLookupKind(raw);
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
    setAddSaving(true);
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
      const row = await apiRequest('/autoservice/garage/vehicles', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setVehicles((prev) => [row, ...prev]);
      setAddOpen(false);
      if (returnTo) {
        navigate(returnTo, { replace: true, state: { selectedVehicleId: row.id } });
      }
    } finally {
      setAddSaving(false);
    }
  };

  const handleUpdateVehicle = async (body) => {
    if (!editVehicle) return;
    setEditSaving(true);
    try {
      const row = await apiRequest(`/autoservice/garage/vehicles/${editVehicle.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setVehicles((prev) => prev.map((v) => (v.id === row.id ? row : v)));
      setEditVehicle(null);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteVehicle = async (id) => {
    if (!window.confirm('Удалить автомобиль из гаража?')) return;
    setDeletingId(id);
    setPageError(null);
    try {
      await apiRequest(`/autoservice/garage/vehicles/${id}`, { method: 'DELETE' });
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      setPageError(err?.message || 'Не удалось удалить');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;

  if (clientStatus === 'loading' || clientStatus === 'idle') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-gray-500">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Мои авто</h1>
          <p className="mt-1 text-sm">
            <Link to="/autoservice/repair-booking" className="text-indigo-600 hover:underline">
              Запись на ремонт
            </Link>
            <span className="text-gray-300"> · </span>
            <Link to="/garage/repairs" className="text-indigo-600 hover:underline">
              История ремонтов
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Добавить авто
        </button>
      </div>

      {pageError && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {pageError}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {vehiclesLoading ? (
          <p className="text-sm text-gray-500">Загрузка автомобилей…</p>
        ) : vehicles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
            Пока нет автомобилей. Добавьте первый по VIN, госномеру или Frame.
          </p>
        ) : (
          vehicles.map((v) => (
            <div
              key={v.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-gray-900">
                  {v.make} {v.model}
                  {v.year ? `, ${v.year}` : ''}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {v.vin ? `VIN: ${v.vin}` : 'VIN не указан'}
                  {v.plate ? ` · ${v.plate}` : ''}
                  {v.color ? ` · ${v.color}` : ''}
                </p>
                {v.notes && <p className="mt-1 text-sm text-gray-500">{v.notes}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditVehicle(v)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Изменить
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteVehicle(v.id)}
                  disabled={deletingId === v.id}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  {deletingId === v.id ? '…' : 'Удалить'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {addOpen && addStep === 'vin' && (
        <Modal title="Добавление авто в гараж" onClose={() => setAddOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Введите VIN, госномер или Frame — подставим данные автоматически.
            </p>
            <div>
              <label htmlFor="garage-add-lookup" className="block text-sm font-medium text-gray-700">
                Госномер, VIN или Frame
              </label>
              <input
                id="garage-add-lookup"
                className={inputClass}
                value={lookupInput}
                onChange={(e) => {
                  setLookupInput(formatVehicleLookupInput(e.target.value));
                  setLookupError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleDecodeLookup();
                  }
                }}
                maxLength={LOOKUP_INPUT_MAX_LENGTH}
                disabled={lookupDecoding}
                placeholder="М460УН154, WVWZZZ1JZYW123456 или SGL5-400683"
                autoComplete="off"
                autoFocus
              />
              {lookupError && <p className="mt-1 text-sm text-red-600">{lookupError}</p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedCandidate(null);
                  setLookupFromPlate(false);
                  setLookupFromFrame(false);
                  setAddNotice(null);
                  setAddForm(emptyForm);
                  setAddStep('form');
                }}
                disabled={lookupDecoding}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
              >
                Искать по марке
              </button>
              <button
                type="button"
                onClick={handleDecodeLookup}
                disabled={lookupDecoding}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {lookupDecoding ? 'Проверка…' : 'Продолжить'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {addOpen && addStep === 'pick' && (
        <Modal title="Выберите автомобиль" onClose={() => setAddOpen(false)}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Найдено несколько вариантов. Выберите подходящий.</p>
            <ul className="space-y-2">
              {addCandidates.map((c, idx) => (
                <li key={`${c.vehicle_id || 'v'}-${idx}`}>
                  <button
                    type="button"
                    onClick={() =>
                      applyCandidate(
                        c,
                        resolvedVin,
                        addForm.plate || resolvedPlate,
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50/40"
                  >
                    <span className="font-medium text-gray-900">{candidateLabel(c)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setSelectedCandidate(null);
                setAddNotice(null);
                setAddStep('form');
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Искать по марке
            </button>
          </div>
        </Modal>
      )}

      {addOpen && addStep === 'form' && (
        <Modal title="Данные автомобиля" onClose={() => setAddOpen(false)}>
          <VehicleForm
            initial={addForm}
            saving={addSaving}
            submitLabel="Добавить"
            notice={addNotice}
            onRetryDecode={
              addNotice
                ? () => {
                    setAddStep('vin');
                    setLookupInput(addForm.vin || addForm.plate || frameInput || lookupInput);
                    setLookupError(null);
                    setAddNotice(null);
                  }
                : undefined
            }
            onCancel={() => setAddOpen(false)}
            onSubmit={handleCreateVehicle}
          />
        </Modal>
      )}

      {editVehicle && (
        <Modal title="Изменить автомобиль" onClose={() => setEditVehicle(null)}>
          <VehicleForm
            initial={{
              vin: editVehicle.vin || '',
              make: editVehicle.make || '',
              model: editVehicle.model || '',
              year: editVehicle.year ? String(editVehicle.year) : '',
              color: editVehicle.color || '',
              plate: editVehicle.plate || '',
              notes: editVehicle.notes || '',
            }}
            saving={editSaving}
            submitLabel="Сохранить"
            onCancel={() => setEditVehicle(null)}
            onSubmit={handleUpdateVehicle}
          />
        </Modal>
      )}
    </div>
  );
}
