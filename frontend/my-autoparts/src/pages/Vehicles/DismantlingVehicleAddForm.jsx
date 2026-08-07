import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/apiClient';
import {
  createVehicle,
  fetchVehicles,
  uploadPhotos,
} from '../../redux/slices/ProductSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import {
  candidateLabel,
  mapCandidateToDismantlingPrefill,
  sanitizeResolvedVin,
  softNoticeVariantFromReason,
} from '../../utils/laximoVinCandidate';
import { sanitizeVinInput } from '../../utils/laximoVin';
import { normalizePlate } from '../../utils/laximoPlate';
import { detectVehicleLookupKind, formatVehicleLookupInput } from '../../utils/vehicleLookupKind';
import SoftServiceNotice from '../../components/SoftServiceNotice/SoftServiceNotice';
import {
  warehousePageClass,
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseSecondaryButtonClass,
} from '../../utils/warehouseListUi';

const LOOKUP_MAX_LENGTH = 32;

const emptyForm = {
  storageLocationId: '',
  brand: '',
  model: '',
  generation: '',
  engine: '',
  transmission: '',
  vin: '',
  mileage: '',
  price: '',
  description: '',
};

function LookupStep({ onResolved, onManual }) {
  const [lookupInput, setLookupInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [resolvedVin, setResolvedVin] = useState('');

  const selectCandidate = (candidate) => onResolved(candidate, resolvedVin);

  const handleLookup = async () => {
    setError('');
    setNotice(null);
    setCandidates([]);

    const kind = detectVehicleLookupKind(lookupInput);
    if (!kind) {
      setError('Введите VIN, госномер или Frame');
      return;
    }

    const raw = lookupInput.trim();
    const value = kind === 'frame'
      ? raw.toUpperCase().replace(/\s+/g, '')
      : kind === 'vin'
        ? sanitizeVinInput(raw)
        : normalizePlate(raw);
    const path = `/laximo/vehicles/by-${kind}`;
    const body = kind === 'plate'
      ? { plate: value, country_code: 'ru' }
      : { [kind]: value };

    setLoading(true);
    try {
      const result = await apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
      const list = Array.isArray(result?.candidates) ? result.candidates : [];
      const vin = kind === 'vin'
        ? value
        : sanitizeResolvedVin(result?.vin || '');
      setResolvedVin(vin);

      if (result?.ok && list.length === 1) {
        onResolved(list[0], vin);
        return;
      }
      if (result?.ok && list.length > 1) {
        setCandidates(list);
        return;
      }
      setNotice(softNoticeVariantFromReason(result?.reason));
      onManual({
        vin: kind === 'vin' ? value : vin,
      });
    } catch (requestError) {
      setError(requestError?.message || 'Не удалось найти автомобиль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 sm:p-5">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Автомобиль на разбор</h1>
      <p className="mt-2 text-sm text-gray-600">
        Введите госномер, VIN или Frame — заполним данные автоматически.
      </p>
      <div className="mt-5 space-y-3">
        <input
          className={warehousePillControlClass}
          value={lookupInput}
          onChange={(event) => {
            setLookupInput(formatVehicleLookupInput(event.target.value));
            setError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleLookup();
            }
          }}
          maxLength={LOOKUP_MAX_LENGTH}
          disabled={loading}
          placeholder="М460УН154, WVWZZZ1JZYW123456 или SGL5-400683"
          autoComplete="off"
          autoFocus
        />
        {error ? <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p> : null}
        {notice ? <SoftServiceNotice variant={notice} onRetry={handleLookup} /> : null}
        {candidates.length ? (
          <ul className="space-y-2">
            {candidates.map((candidate, index) => (
              <li key={`${candidate.vehicle_id || 'vehicle'}-${index}`}>
                <button
                  type="button"
                  onClick={() => selectCandidate(candidate)}
                  className="w-full rounded-xl bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-900 ring-1 ring-gray-200 hover:bg-white"
                >
                  {candidateLabel(candidate)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button type="button" onClick={() => onManual({})} className={warehouseSecondaryButtonClass}>
            Добавить вручную
          </button>
          <button type="button" onClick={handleLookup} disabled={loading} className={warehousePrimaryButtonClass}>
            {loading ? 'Поиск…' : 'Продолжить'}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function DismantlingVehicleAddForm() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const storageLocations = useSelector((state) => state.organization.storageLocations);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [formStarted, setFormStarted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.organization_id) {
      dispatch(fetchStorageLocations(user.organization_id));
    }
  }, [dispatch, user?.organization_id]);

  const openForm = (candidate, vin) => {
    const prefill = mapCandidateToDismantlingPrefill(candidate, vin);
    setSelectedCandidate(candidate || null);
    setFormStarted(true);
    setForm((previous) => ({
      ...previous,
      brand: prefill.brandInput || previous.brand,
      model: prefill.modelInput || previous.model,
      generation: prefill.generationInput || previous.generation,
      engine: prefill.engineText || previous.engine,
      transmission: prefill.transmissionText || previous.transmission,
      vin: prefill.vin || previous.vin,
    }));
  };

  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.storageLocationId || !form.brand.trim() || !form.model.trim()) {
      setError('Выберите склад, укажите марку и модель');
      return;
    }

    const mileage = form.mileage === '' ? null : Number(form.mileage);
    const price = form.price === '' ? null : Number(String(form.price).replace(',', '.'));
    if ((mileage != null && (!Number.isInteger(mileage) || mileage < 0)) || (price != null && (!Number.isFinite(price) || price < 0))) {
      setError('Проверьте пробег и цену');
      return;
    }

    setSaving(true);
    try {
      const photos = files.length ? await dispatch(uploadPhotos(files)).unwrap() : [];
      const result = await dispatch(createVehicle({
        brand: form.brand.trim(),
        model: form.model.trim(),
        generation: form.generation.trim() || null,
        engine: form.engine.trim() || null,
        transmission: form.transmission.trim() || null,
        vin: form.vin.trim() || null,
        mileage,
        price,
        description: form.description.trim() || null,
        photos: photos.filter(Boolean),
        storage_location_id: Number(form.storageLocationId),
      })).unwrap();
      dispatch(fetchVehicles());
      navigate(`/vehicles/edit/${result.id}`, { replace: true });
    } catch (saveError) {
      setError(typeof saveError === 'string' ? saveError : 'Не удалось сохранить автомобиль');
    } finally {
      setSaving(false);
    }
  };

  if (!formStarted) {
    return (
      <div className={warehousePageClass}>
        <LookupStep onResolved={openForm} onManual={({ vin = '' }) => openForm(null, vin)} />
      </div>
    );
  }

  return (
    <div className={`${warehousePageClass} max-w-3xl space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Автомобиль на разбор</h1>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm);
            setSelectedCandidate(null);
            setFormStarted(false);
            setFiles([]);
            setError('');
          }}
          className={warehouseSecondaryButtonClass}
        >
          Новый поиск
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-gray-500">Склад</span>
            <select value={form.storageLocationId} onChange={(event) => update('storageLocationId', event.target.value)} className={warehousePillControlClass} required>
              <option value="">Выберите склад</option>
              {storageLocations.map((location) => (
                <option key={location.id} value={location.id}>{location.address || `Склад #${location.id}`}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-gray-500">Марка</span>
            <input value={form.brand} onChange={(event) => update('brand', event.target.value)} className={warehousePillControlClass} required />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-gray-500">Модель</span>
            <input value={form.model} onChange={(event) => update('model', event.target.value)} className={warehousePillControlClass} required />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-gray-500">VIN</span>
            <input value={form.vin} onChange={(event) => update('vin', sanitizeVinInput(event.target.value))} className={warehousePillControlClass} />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-gray-500">Пробег, км</span>
            <input type="number" min="0" value={form.mileage} onChange={(event) => update('mileage', event.target.value)} className={warehousePillControlClass} />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-gray-500">Цена, ₽</span>
            <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => update('price', event.target.value)} className={warehousePillControlClass} />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-gray-500">Фото</span>
            <input type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 10))} className={warehousePillControlClass} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-gray-500">Описание</span>
          <textarea value={form.description} onChange={(event) => update('description', event.target.value)} className={`${warehousePillControlClass.replace('rounded-full', 'rounded-xl')} min-h-24 py-3`} />
        </label>
        <details open={showDetails} onToggle={(event) => setShowDetails(event.currentTarget.open)} className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">Уточнить данные</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label><span className="mb-1.5 block text-xs text-gray-500">Поколение</span><input value={form.generation} onChange={(event) => update('generation', event.target.value)} className={warehousePillControlClass} /></label>
            <label><span className="mb-1.5 block text-xs text-gray-500">Двигатель</span><input value={form.engine} onChange={(event) => update('engine', event.target.value)} className={warehousePillControlClass} /></label>
            <label><span className="mb-1.5 block text-xs text-gray-500">КПП</span><input value={form.transmission} onChange={(event) => update('transmission', event.target.value)} className={warehousePillControlClass} /></label>
          </div>
        </details>
        {error ? <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button type="button" onClick={() => navigate('/vehicles')} className={warehouseSecondaryButtonClass}>Отмена</button>
          <button type="submit" disabled={saving} className={warehousePrimaryButtonClass}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
        </div>
      </form>
    </div>
  );
}
