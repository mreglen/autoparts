import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import SoftServiceNotice from '../../components/SoftServiceNotice/SoftServiceNotice';
import Modal, { ConfirmDialog } from '../../components/UI/Modal';
import NumericInput from '../../components/UI/NumericInput';
import { apiRequest } from '../../utils/apiClient';
import { selectIsAutoserviceClient } from '../../redux/slices/AutoserviceClientSlice';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import {
  autoserviceListMobileWrapClass,
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTbodyClass,
  autoserviceListTdClass,
  autoserviceListThClass,
  autoserviceListTheadRowClass,
  autoserviceListTrClickableClass,
} from '../../utils/warehouseListUi';
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
          <NumericInput
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

function VehicleMobileCard({ vehicle, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full border-b border-line-soft py-2 text-left last:border-b-0"
    >
      <p className="truncate font-medium text-ink">{vehicleTitle(vehicle)}</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {vehicle.vin ? `VIN: ${vehicle.vin}` : 'VIN не указан'}
        {vehicle.plate ? ` · ${vehicle.plate}` : ''}
      </p>
      {vehicle.color ? <p className="mt-0.5 text-xs text-ink-muted">{vehicle.color}</p> : null}
      {vehicle.notes ? <p className="mt-1 text-xs text-ink-faint line-clamp-2">{vehicle.notes}</p> : null}
    </button>
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

  const [viewVehicle, setViewVehicle] = useState(null);
  const [viewEditing, setViewEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/garage') {
        loadVehicles();
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [loadVehicles]);

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

  const openVehicle = useCallback((vehicle) => {
    setViewVehicle(vehicle);
    setViewEditing(false);
    setDeleteConfirmOpen(false);
  }, []);

  const closeVehicle = useCallback(() => {
    if (deletingId) return;
    setViewVehicle(null);
    setViewEditing(false);
    setDeleteConfirmOpen(false);
  }, [deletingId]);

  const handleUpdateVehicle = async (body) => {
    if (!viewVehicle) return;
    setEditSaving(true);
    try {
      const row = await apiRequest(`/autoservice/garage/vehicles/${viewVehicle.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setVehicles((prev) => prev.map((v) => (v.id === row.id ? row : v)));
      setViewVehicle(row);
      setViewEditing(false);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!viewVehicle) return;
    setDeletingId(viewVehicle.id);
    setPageError(null);
    try {
      await apiRequest(`/autoservice/garage/vehicles/${viewVehicle.id}`, { method: 'DELETE' });
      setVehicles((prev) => prev.filter((v) => v.id !== viewVehicle.id));
      setDeleteConfirmOpen(false);
      setViewVehicle(null);
      setViewEditing(false);
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

      <div className={autoserviceListTableWrapClass}>
        <div className="overflow-x-auto">
          <table className={autoserviceListTableClass}>
            <thead>
              <tr className={autoserviceListTheadRowClass}>
                <th className={autoserviceListThClass}>Автомобиль</th>
                <th className={`w-48 ${autoserviceListThClass}`}>VIN</th>
                <th className={`w-36 ${autoserviceListThClass}`}>Госномер</th>
                <th className={`hidden w-28 lg:table-cell ${autoserviceListThClass}`}>Цвет</th>
              </tr>
            </thead>
            <tbody className={autoserviceListTbodyClass}>
              {vehiclesLoading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-ink-muted">
                    Загрузка…
                  </td>
                </tr>
              ) : filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-ink-muted">
                    {vehicles.length === 0
                      ? 'Пока нет автомобилей. Добавьте первый по VIN, госномеру или Frame.'
                      : 'Ничего не найдено'}
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => (
                  <tr
                    key={v.id}
                    className={autoserviceListTrClickableClass}
                    onClick={() => openVehicle(v)}
                  >
                    <td className={autoserviceListTdClass}>
                      <div className="truncate font-medium text-ink" title={vehicleTitle(v)}>
                        {vehicleTitle(v)}
                      </div>
                      {v.notes ? (
                        <div className="mt-0.5 truncate text-ink-faint" title={v.notes}>
                          {v.notes}
                        </div>
                      ) : null}
                    </td>
                    <td className={`truncate font-mono text-ink-soft ${autoserviceListTdClass}`} title={v.vin || ''}>
                      {v.vin || '—'}
                    </td>
                    <td className={`whitespace-nowrap text-ink-soft ${autoserviceListTdClass}`}>{v.plate || '—'}</td>
                    <td className={`hidden text-ink-muted lg:table-cell ${autoserviceListTdClass}`}>{v.color || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={autoserviceListMobileWrapClass}>
        {vehiclesLoading ? (
          <p className="py-10 text-center text-sm text-ink-muted">Загрузка…</p>
        ) : filteredVehicles.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            {vehicles.length === 0
              ? 'Пока нет автомобилей. Добавьте первый по VIN, госномеру или Frame.'
              : 'Ничего не найдено'}
          </p>
        ) : (
          filteredVehicles.map((v) => (
            <VehicleMobileCard
              key={v.id}
              vehicle={v}
              onOpen={() => openVehicle(v)}
            />
          ))
        )}
      </div>

      <Modal
        open={addOpen && addStep === 'vin'}
        onClose={() => setAddOpen(false)}
        title="Добавление авто в гараж"
        size="sm"
        draggable
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
        draggable
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
        draggable
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

      <Modal
        open={Boolean(viewVehicle)}
        onClose={closeVehicle}
        title={
          viewEditing
            ? 'Изменить автомобиль'
            : (viewVehicle ? vehicleTitle(viewVehicle) : '') || 'Автомобиль'
        }
        size="md"
        draggable
        footer={
          viewVehicle && !viewEditing ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={Boolean(deletingId)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              >
                Удалить
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={closeVehicle} className={btnGhost}>
                  Закрыть
                </button>
                <button type="button" onClick={() => setViewEditing(true)} className={btnPrimary}>
                  Редактировать
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {viewVehicle && !viewEditing ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">VIN</dt>
              <dd className="mt-1 font-mono text-sm text-gray-900">{viewVehicle.vin || '—'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Госномер</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{viewVehicle.plate || '—'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Год</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{viewVehicle.year || '—'}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Цвет</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{viewVehicle.color || '—'}</dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Заметка</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm font-medium text-gray-900">
                {viewVehicle.notes?.trim() || '—'}
              </dd>
            </div>
          </dl>
        ) : viewVehicle ? (
          <VehicleForm
            initial={{
              vin: viewVehicle.vin || '',
              make: viewVehicle.make || '',
              model: viewVehicle.model || '',
              year: viewVehicle.year ? String(viewVehicle.year) : '',
              color: viewVehicle.color || '',
              plate: viewVehicle.plate || '',
              notes: viewVehicle.notes || '',
            }}
            saving={editSaving}
            submitLabel="Сохранить"
            onCancel={() => setViewEditing(false)}
            onSubmit={handleUpdateVehicle}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleteConfirmOpen && Boolean(viewVehicle)}
        onClose={() => {
          if (!deletingId) setDeleteConfirmOpen(false);
        }}
        onConfirm={handleDeleteVehicle}
        title="Удалить автомобиль?"
        message={viewVehicle ? `${vehicleTitle(viewVehicle)} будет удалён из гаража.` : 'Автомобиль будет удалён из гаража.'}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        danger
        loading={Boolean(deletingId)}
      />
    </div>
  );
}
