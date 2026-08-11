import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import SoftServiceNotice from '../../components/SoftServiceNotice/SoftServiceNotice';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';
import Modal from '../../components/UI/Modal';
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

const pillControlClass =
  'h-10 w-full rounded-full border border-transparent bg-gray-100 px-4 text-sm text-gray-900 shadow-none transition hover:bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-0';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

const btnPrimary =
  'inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60';

const btnGhost =
  'inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60';

const emptyForm = {
  vin: '',
  make: '',
  model: '',
  year: '',
  color: '',
  plate: '',
  notes: '',
};

function vehicleTitle(v) {
  return `${v.make || ''} ${v.model || ''}`.trim() + (v.year ? `, ${v.year}` : '');
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
    <form id="garage-vehicle-form" onSubmit={handleSubmit} className="space-y-4">
      {notice ? <SoftServiceNotice variant={notice} onRetry={onRetryDecode} /> : null}
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
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className={btnGhost} disabled={saving}>
          Отмена
        </button>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? 'Сохранение…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function VehicleMobileCard({ vehicle, deletingId, onEdit, onDelete }) {
  return (
    <div className="border-b border-gray-100 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{vehicleTitle(vehicle)}</p>
          <p className="mt-1 text-sm text-gray-600">
            {vehicle.vin ? `VIN: ${vehicle.vin}` : 'VIN не указан'}
            {vehicle.plate ? ` · ${vehicle.plate}` : ''}
          </p>
          {vehicle.color ? <p className="mt-0.5 text-xs text-gray-500">{vehicle.color}</p> : null}
          {vehicle.notes ? <p className="mt-1 text-xs text-gray-500 line-clamp-2">{vehicle.notes}</p> : null}
        </div>
        <ActionsDropdown
          menuClassName="w-40 z-50"
          estimatedMenuHeight={100}
          showLabel={false}
          buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50"
          disabled={deletingId === vehicle.id}
        >
          <ActionsDropdownItem onClick={onEdit}>Изменить</ActionsDropdownItem>
          <ActionsDropdownItem danger onClick={onDelete}>
            {deletingId === vehicle.id ? 'Удаление…' : 'Удалить'}
          </ActionsDropdownItem>
        </ActionsDropdown>
      </div>
    </div>
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
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');

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

  const openAdd = useCallback(() => {
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
  }, []);

  useEffect(() => {
    if (!location.state?.openAdd) return;
    openAdd();
    navigate(location.pathname, {
      replace: true,
      state: location.state?.returnTo ? { returnTo: location.state.returnTo } : {},
    });
  }, [location.pathname, location.state?.openAdd, location.state?.returnTo, navigate, openAdd]);

  const filteredVehicles = useMemo(() => {
    const query = qApplied.trim().toLowerCase();
    if (!query) return vehicles;
    return vehicles.filter((v) => {
      const hay = [v.make, v.model, v.year, v.vin, v.plate, v.color, v.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }, [vehicles, qApplied]);

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
    return <p className="py-12 text-center text-sm text-gray-500">Загрузка…</p>;
  }

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Мои авто</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {vehiclesLoading
              ? 'Загрузка…'
              : qApplied.trim()
                ? `${filteredVehicles.length} из ${vehicles.length}`
                : `${vehicles.length} автомобилей`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/autoservice/repair-booking" className={btnGhost}>
            Запись на ремонт
          </Link>
          <button type="button" onClick={openAdd} className={btnPrimary}>
            Добавить авто
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <input
            className={`${pillControlClass} pr-10`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Марка, модель, VIN или госномер"
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQApplied(q);
            }}
            aria-label="Поиск автомобилей"
          />
          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setQApplied('');
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600"
              aria-label="Очистить поиск"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setQApplied(q)}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-gray-900 px-5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Найти
        </button>
        <button
          type="button"
          onClick={loadVehicles}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
          title="Обновить"
          aria-label="Обновить"
        >
          <svg
            className={`h-4 w-4 ${vehiclesLoading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {pageError ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {pageError}
        </p>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full table-fixed divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="py-3 pr-3">Автомобиль</th>
              <th className="w-48 py-3 pr-3">VIN</th>
              <th className="w-36 py-3 pr-3">Госномер</th>
              <th className="hidden w-28 py-3 pr-3 lg:table-cell">Цвет</th>
              <th className="w-28 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vehiclesLoading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-500">
                  Загрузка…
                </td>
              </tr>
            ) : filteredVehicles.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-500">
                  {vehicles.length === 0
                    ? 'Пока нет автомобилей. Добавьте первый по VIN, госномеру или Frame.'
                    : 'Ничего не найдено'}
                </td>
              </tr>
            ) : (
              filteredVehicles.map((v) => (
                <tr key={v.id} className="transition-colors hover:bg-gray-50/70">
                  <td className="py-3 pr-3 align-middle">
                    <div className="font-medium text-gray-900">{vehicleTitle(v)}</div>
                    {v.notes ? (
                      <div className="mt-0.5 truncate text-xs text-gray-500" title={v.notes}>
                        {v.notes}
                      </div>
                    ) : null}
                  </td>
                  <td className="truncate py-3 pr-3 align-middle font-mono text-xs text-gray-700" title={v.vin || ''}>
                    {v.vin || '—'}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 align-middle text-gray-700">{v.plate || '—'}</td>
                  <td className="hidden py-3 pr-3 align-middle text-gray-600 lg:table-cell">{v.color || '—'}</td>
                  <td className="py-3 text-right align-middle">
                    <ActionsDropdown
                      menuClassName="w-40 z-50"
                      estimatedMenuHeight={100}
                      showLabel
                      buttonClassName="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                      disabled={deletingId === v.id}
                    >
                      <ActionsDropdownItem onClick={() => setEditVehicle(v)}>Изменить</ActionsDropdownItem>
                      <ActionsDropdownItem danger onClick={() => handleDeleteVehicle(v.id)}>
                        {deletingId === v.id ? 'Удаление…' : 'Удалить'}
                      </ActionsDropdownItem>
                    </ActionsDropdown>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        {vehiclesLoading ? (
          <p className="py-10 text-center text-sm text-gray-500">Загрузка…</p>
        ) : filteredVehicles.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            {vehicles.length === 0
              ? 'Пока нет автомобилей. Добавьте первый по VIN, госномеру или Frame.'
              : 'Ничего не найдено'}
          </p>
        ) : (
          filteredVehicles.map((v) => (
            <VehicleMobileCard
              key={v.id}
              vehicle={v}
              deletingId={deletingId}
              onEdit={() => setEditVehicle(v)}
              onDelete={() => handleDeleteVehicle(v.id)}
            />
          ))
        )}
      </div>

      <Modal
        open={addOpen && addStep === 'vin'}
        onClose={() => setAddOpen(false)}
        title="Добавление авто в гараж"
        size="sm"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
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
              className={btnGhost}
            >
              Искать по марке
            </button>
            <button type="button" onClick={handleDecodeLookup} disabled={lookupDecoding} className={btnPrimary}>
              {lookupDecoding ? 'Проверка…' : 'Продолжить'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Введите VIN, госномер или Frame — подставим данные автоматически.</p>
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
            {lookupError ? <p className="mt-1 text-sm text-red-600">{lookupError}</p> : null}
          </div>
        </div>
      </Modal>

      <Modal
        open={addOpen && addStep === 'pick'}
        onClose={() => setAddOpen(false)}
        title="Выберите автомобиль"
        size="sm"
        footer={
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => {
                setSelectedCandidate(null);
                setAddNotice(null);
                setAddStep('form');
              }}
              className={btnGhost}
            >
              Искать по марке
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Найдено несколько вариантов. Выберите подходящий.</p>
          <ul className="divide-y divide-gray-100">
            {addCandidates.map((c, idx) => (
              <li key={`${c.vehicle_id || 'v'}-${idx}`}>
                <button
                  type="button"
                  onClick={() => applyCandidate(c, resolvedVin, addForm.plate || resolvedPlate)}
                  className="w-full py-3 text-left text-sm transition hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{candidateLabel(c)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      <Modal
        open={addOpen && addStep === 'form'}
        onClose={() => setAddOpen(false)}
        title="Данные автомобиля"
        size="md"
      >
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

      <Modal open={Boolean(editVehicle)} onClose={() => setEditVehicle(null)} title="Изменить автомобиль" size="md">
        {editVehicle ? (
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
        ) : null}
      </Modal>
    </div>
  );
}
