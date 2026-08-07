import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import SoftServiceNotice from '../../components/SoftServiceNotice/SoftServiceNotice';
import GarageQuickAddModal from '../../components/Garage/GarageQuickAddModal';
import { apiAxios, apiRequest } from '../../utils/apiClient';
import { formatPhoneInput, validatePhone } from '../../utils/contactValidation';
import { parseServerDate } from '../../utils/serverDate';
import {
  candidateLabel,
  mapCandidateToGarageCreatePayload,
  mapCandidateToGarageForm,
  softNoticeVariantFromReason,
} from '../../utils/laximoVinCandidate';
import { normalizeVinOrNull, sanitizeVinInput, VIN_INPUT_MAX_LENGTH } from '../../utils/laximoVin';
import { getRosskoMinPrice, getRosskoParts } from '../AutoParts/NewParts/rosskoHelpers';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

const inputSmClass =
  'block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineSum(qty, unitPrice) {
  const q = Number(qty) || 0;
  const p = Number(unitPrice) || 0;
  return Math.round(q * p * 100) / 100;
}

function priceWithMarkup(unitPrice, markupPercent) {
  const p = Number(unitPrice) || 0;
  const m = Number(markupPercent) || 0;
  return Math.round(p * (1 + m / 100) * 100) / 100;
}

function shopLineSum(qty, unitPrice, markupPercent) {
  return Math.round((Number(qty) || 0) * priceWithMarkup(unitPrice, markupPercent) * 100) / 100;
}

function vehicleLabel(v) {
  if (!v) return '—';
  const parts = [v.make, v.model, v.year].filter(Boolean);
  const base = parts.join(' ') || 'Авто';
  if (v.plate) return `${base} (${v.plate})`;
  return base;
}

function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = parseServerDate(iso);
  if (!d || Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local) {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function emptyWork() {
  return { title: '', qty: 1, unit_price: '0', executor_user_id: '' };
}

function emptyClientPart() {
  return { title: '', qty: 1 };
}

function emptyShopPart(overrides = {}) {
  return {
    title: '',
    qty: 1,
    unit_price: '0',
    markup_percent: '5',
    source: 'manual',
    product_id: null,
    rossko_brand: '',
    rossko_partnumber: '',
    ...overrides,
  };
}

function moveItem(list, index, delta) {
  const next = index + delta;
  if (next < 0 || next >= list.length) return list;
  const copy = [...list];
  const tmp = copy[index];
  copy[index] = copy[next];
  copy[next] = tmp;
  return copy;
}

function vehicleSearchText(v) {
  return [v.make, v.model, v.year, v.plate, v.vin].filter(Boolean).join(' ').toLowerCase();
}

function SectionCard({ title, children, action }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      {title ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

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

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Выберите…',
  disabled = false,
  loading = false,
  emptyMessage = 'Ничего не найдено',
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selected = options.find((o) => String(o.value) === String(value));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => (o.searchText || o.label).toLowerCase().includes(q));
  }, [options, query]);

  const displayValue = open ? query : selected?.label || '';

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        className={inputClass}
        disabled={disabled || loading}
        placeholder={loading ? 'Загрузка…' : placeholder}
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        autoComplete="off"
      />
      {open && !disabled && !loading ? (
        <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</li>
          ) : (
            filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
                    String(o.value) === String(value) ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-gray-800'
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(String(o.value));
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function AddClientModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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
    setSaving(true);
    try {
      const row = await apiRequest('/autoservice/clients', {
        method: 'POST',
        body: JSON.stringify({ name: trimmedName, phone }),
      });
      onCreated(row);
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось добавить клиента');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Добавить клиента" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
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
              setPhone(formatPhoneInput(e.target.value));
              setPhoneError('');
            }}
            placeholder="+7 (___) ___-__-__"
            disabled={saving}
            required
          />
          {phoneError ? <p className="mt-1 text-sm text-red-600">{phoneError}</p> : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
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
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddVehicleModal({ clientId, onClose, onCreated }) {
  const [form, setForm] = useState({
    make: '',
    model: '',
    year: '',
    vin: '',
    plate: '',
    color: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [vinDecoding, setVinDecoding] = useState(false);
  const [notice, setNotice] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const applyCandidate = (candidate, vin) => {
    const mapped = mapCandidateToGarageForm(candidate, vin);
    setSelectedCandidate(candidate);
    setForm((p) => ({
      ...p,
      vin: mapped.vin,
      make: mapped.make,
      model: mapped.model,
      year: mapped.year,
      color: mapped.color || p.color,
    }));
    setCandidates([]);
    setNotice(null);
  };

  const handleDecodeVin = async () => {
    setError('');
    const vin = normalizeVinOrNull(form.vin);
    if (!vin) {
      setError('VIN должен содержать от 11 до 17 символов');
      return;
    }
    setForm((prev) => ({ ...prev, vin }));
    setVinDecoding(true);
    try {
      const result = await apiRequest('/laximo/vehicles/by-vin', {
        method: 'POST',
        body: JSON.stringify({ vin }),
      });
      const list = Array.isArray(result?.candidates) ? result.candidates : [];
      if (result?.ok && list.length === 1) {
        applyCandidate(list[0], vin);
        return;
      }
      if (result?.ok && list.length > 1) {
        setCandidates(list);
        setSelectedCandidate(null);
        setNotice(null);
        return;
      }
      setSelectedCandidate(null);
      setCandidates([]);
      setNotice(softNoticeVariantFromReason(result?.reason));
    } catch (err) {
      setError(err?.message || 'Не удалось распознать VIN');
    } finally {
      setVinDecoding(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    setSaving(true);
    try {
      const payload = mapCandidateToGarageCreatePayload(selectedCandidate, {
        vin: form.vin.trim() || '',
        make,
        model,
        year: form.year,
        color: form.color,
        plate: form.plate,
        notes: form.notes,
      });
      payload.year = year;
      payload.client_id = Number(clientId);
      const row = await apiRequest('/autoservice/garage/vehicles/staff', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onCreated(row);
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось добавить автомобиль');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Добавить автомобиль" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {notice ? (
          <SoftServiceNotice
            variant={notice}
            onRetry={() => {
              setNotice(null);
              handleDecodeVin();
            }}
          />
        ) : null}
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3">
          <label className="block text-sm font-medium text-gray-700">Найти по VIN</label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <input
              className={inputClass}
              value={form.vin}
              onChange={(e) => {
                setForm((p) => ({ ...p, vin: sanitizeVinInput(e.target.value) }));
                setError('');
                setNotice(null);
              }}
              disabled={saving || vinDecoding}
              maxLength={VIN_INPUT_MAX_LENGTH}
              placeholder="11–17 символов"
            />
            <button
              type="button"
              onClick={handleDecodeVin}
              disabled={saving || vinDecoding}
              className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {vinDecoding ? 'Проверка…' : 'Распознать'}
            </button>
          </div>
          {candidates.length > 1 ? (
            <ul className="mt-3 space-y-2">
              {candidates.map((c, idx) => (
                <li key={`${c.vehicle_id || 'v'}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => applyCandidate(c, form.vin.trim().toUpperCase())}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50/40"
                  >
                    {candidateLabel(c)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Марка</label>
            <input
              className={inputClass}
              value={form.make}
              onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))}
              disabled={saving}
              required
              maxLength={80}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Модель</label>
            <input
              className={inputClass}
              value={form.model}
              onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
              disabled={saving}
              required
              maxLength={80}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Год</label>
            <input
              type="number"
              min={1900}
              max={2100}
              className={inputClass}
              value={form.year}
              onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
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
              maxLength={20}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Цвет</label>
            <input
              className={inputClass}
              value={form.color}
              onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
              disabled={saving}
              maxLength={40}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Заметки</label>
            <textarea
              className={inputClass}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              disabled={saving}
              maxLength={2000}
            />
          </div>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
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
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function mapOrderToFormState(order) {
  return {
    clientId: order?.client_id ? String(order.client_id) : '',
    vehicleId: order?.vehicle_id ? String(order.vehicle_id) : '',
    scheduledAt: order?.scheduled_at
      ? toLocalInputValue(order.scheduled_at)
      : toLocalInputValue(new Date().toISOString()),
    comment: order?.client_comment || '',
    staffComment: order?.staff_comment || '',
    liftNumber: order?.lift_number != null ? String(order.lift_number) : '',
    works: (order?.works || []).length
      ? order.works.map((w) => ({
          title: w.title || '',
          qty: w.qty || 1,
          unit_price: String(w.unit_price ?? '0'),
          executor_user_id: w.executor_user_id ? String(w.executor_user_id) : '',
        }))
      : [],
    clientParts: (order?.client_parts || []).length
      ? order.client_parts.map((p) => ({
          title: p.title || '',
          qty: p.qty || 1,
        }))
      : [],
    shopParts: (order?.shop_parts || []).length
      ? order.shop_parts.map((p) => ({
          title: p.title || '',
          qty: p.qty || 1,
          unit_price: String(p.unit_price ?? '0'),
          markup_percent: String(p.markup_percent ?? '5'),
          source: p.source || 'manual',
          product_id: p.product_id || null,
          rossko_brand: p.rossko_brand || '',
          rossko_partnumber: p.rossko_partnumber || '',
        }))
      : [],
  };
}

function emptyFormState() {
  return mapOrderToFormState(null);
}

export default function AutoserviceOrderFormPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isReady, isAuthenticated, user } = useAuthReady();

  const isCreate = location.pathname.endsWith('/new');
  const isEdit = !isCreate && Boolean(orderId);

  const [clients, setClients] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [liftsCount, setLiftsCount] = useState(0);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState('');

  const [orderLoading, setOrderLoading] = useState(isEdit);
  const [orderError, setOrderError] = useState('');
  const [orderNumber, setOrderNumber] = useState(null);
  const [formInitialized, setFormInitialized] = useState(isCreate);

  const [clientId, setClientId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInputValue(new Date().toISOString()));
  const [comment, setComment] = useState('');
  const [staffComment, setStaffComment] = useState('');
  const [liftNumber, setLiftNumber] = useState('');
  const [works, setWorks] = useState([]);
  const [clientParts, setClientParts] = useState([]);
  const [shopParts, setShopParts] = useState([]);

  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);

  const [bulkMarkup, setBulkMarkup] = useState('');
  const [picker, setPicker] = useState(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');

  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const plannerPrefillRef = useRef(location.state);

  const applyFormState = useCallback((state) => {
    setClientId(state.clientId);
    setVehicleId(state.vehicleId);
    setScheduledAt(state.scheduledAt);
    setComment(state.comment);
    setStaffComment(state.staffComment);
    setLiftNumber(state.liftNumber);
    setWorks(state.works);
    setClientParts(state.clientParts);
    setShopParts(state.shopParts);
  }, []);

  const loadClients = useCallback(async () => {
    const data = await apiRequest('/autoservice/clients');
    setClients(Array.isArray(data) ? data : []);
  }, []);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    setMetaError('');
    try {
      const [clientsData, staffData, liftsData] = await Promise.all([
        apiRequest('/autoservice/clients'),
        apiRequest('/autoservice/repair-orders/staff-options'),
        apiRequest('/autoservice/repair-orders/lifts-meta'),
      ]);
      setClients(Array.isArray(clientsData) ? clientsData : []);
      setStaffOptions(Array.isArray(staffData) ? staffData : []);
      setLiftsCount(typeof liftsData?.lifts_count === 'number' ? liftsData.lifts_count : 0);
    } catch (err) {
      setMetaError(err?.message || 'Не удалось загрузить справочники');
    } finally {
      setMetaLoading(false);
    }
  }, []);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setOrderLoading(true);
    setOrderError('');
    try {
      const order = await apiRequest(`/autoservice/repair-orders/${orderId}`);
      setOrderNumber(order?.order_number ?? null);
      applyFormState(mapOrderToFormState(order));
      setFormInitialized(true);
    } catch (err) {
      setOrderError(err?.message || 'Не удалось загрузить запись');
    } finally {
      setOrderLoading(false);
    }
  }, [orderId, applyFormState]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      loadMeta();
      if (isEdit) {
        loadOrder();
      } else if (isCreate) {
        const prefill = plannerPrefillRef.current || {};
        const initial = emptyFormState();
        if (prefill.scheduledAtLocal) {
          initial.scheduledAt = prefill.scheduledAtLocal;
        } else if (prefill.scheduledAt) {
          initial.scheduledAt = toLocalInputValue(prefill.scheduledAt);
        }
        applyFormState(initial);
        setFormInitialized(true);
      }
    }
  }, [isReady, isAuthenticated, isEdit, isCreate, loadMeta, loadOrder, applyFormState]);

  useEffect(() => {
    if (!isCreate || !formInitialized || metaLoading || clients.length === 0) return;
    const prefill = plannerPrefillRef.current;
    if (!prefill?.clientPhone) return;
    const digits = String(prefill.clientPhone).replace(/\D/g, '');
    if (!digits) return;
    const match = clients.find((client) => {
      const clientDigits = String(client.phone || '').replace(/\D/g, '');
      return clientDigits && clientDigits === digits;
    });
    if (match) {
      setClientId(String(match.id));
    }
    plannerPrefillRef.current = null;
  }, [isCreate, formInitialized, metaLoading, clients]);

  useEffect(() => {
    if (!clientId) {
      setVehicles([]);
      if (formInitialized) {
        setVehicleId('');
      }
      return;
    }
    let cancelled = false;
    (async () => {
      setVehiclesLoading(true);
      try {
        const data = await apiRequest(`/autoservice/garage/vehicles?client_id=${clientId}`);
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setVehicles(list);
        setVehicleId((prev) => {
          if (prev && list.some((v) => String(v.id) === prev)) return prev;
          return list[0] ? String(list[0].id) : '';
        });
      } catch {
        if (!cancelled) {
          setVehicles([]);
          setVehicleId('');
        }
      } finally {
        if (!cancelled) setVehiclesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, formInitialized]);

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: c.id,
        label: `${c.name} · ${c.phone}`,
        searchText: `${c.name} ${c.phone}`.toLowerCase(),
      })),
    [clients],
  );

  const vehicleOptions = useMemo(
    () =>
      vehicles.map((v) => ({
        value: v.id,
        label: vehicleLabel(v),
        searchText: vehicleSearchText(v),
      })),
    [vehicles],
  );

  const worksTotal = useMemo(
    () => works.reduce((sum, w) => sum + lineSum(w.qty, w.unit_price), 0),
    [works],
  );

  const shopPartsTotal = useMemo(
    () => shopParts.reduce((sum, p) => sum + shopLineSum(p.qty, p.unit_price, p.markup_percent), 0),
    [shopParts],
  );

  const grandTotal = worksTotal + shopPartsTotal;

  const bulkMarkupDisplay = useMemo(() => {
    if (shopParts.length === 0) return '';
    const values = shopParts.map((p) => String(Number(p.markup_percent)));
    const unique = [...new Set(values)];
    return unique.length === 1 ? unique[0] : '';
  }, [shopParts]);

  const handleClientCreated = async (row) => {
    await loadClients();
    if (row?.id) setClientId(String(row.id));
  };

  const handleVehicleCreated = (row) => {
    if (!row?.id) return;
    setVehicles((prev) => {
      const exists = prev.some((v) => v.id === row.id);
      return exists ? prev : [row, ...prev];
    });
    setVehicleId(String(row.id));
  };

  const updateWork = (index, patch) => {
    setWorks((prev) => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  };

  const updatePart = (index, patch) => {
    setClientParts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const updateShopPart = (index, patch) => {
    setShopParts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const applyBulkMarkup = (value) => {
    setBulkMarkup(value);
    if (value === '' || Number.isNaN(Number(value)) || Number(value) < 0) return;
    setShopParts((prev) => prev.map((p) => ({ ...p, markup_percent: String(value) })));
  };

  const openPicker = (kind) => {
    setPicker(kind);
    setPickerQuery('');
    setPickerResults([]);
    setPickerError('');
  };

  const runWarehouseSearch = async () => {
    setPickerLoading(true);
    setPickerError('');
    try {
      const data = await apiRequest(
        `/autoservice/repair-orders/warehouse-products?q=${encodeURIComponent(pickerQuery.trim())}`,
      );
      setPickerResults(Array.isArray(data) ? data : []);
    } catch (err) {
      setPickerError(err?.message || 'Ошибка поиска склада');
      setPickerResults([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const runRosskoSearch = async () => {
    const text = pickerQuery.trim();
    if (!text) {
      setPickerError('Введите артикул или название');
      return;
    }
    setPickerLoading(true);
    setPickerError('');
    try {
      const response = await apiAxios.post('/rossko/GetSearch', {
        text,
        delivery_id: '000000001',
        address_id: 176458,
      });
      const parts = getRosskoParts(response.data).slice(0, 20).map((part) => ({
        brand: part.brand || '',
        partnumber: part.partnumber || '',
        name: part.name || part.guid || '',
        price: getRosskoMinPrice(part),
      }));
      setPickerResults(parts);
    } catch (err) {
      setPickerError(err?.response?.data?.detail || err?.message || 'Ошибка поиска Rossko');
      setPickerResults([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const pickWarehouse = (item) => {
    setShopParts((prev) => [
      ...prev,
      emptyShopPart({
        title: item.title || '',
        unit_price: String(item.price ?? 0),
        source: 'warehouse',
        product_id: item.id,
      }),
    ]);
    setPicker(null);
  };

  const pickRossko = (item) => {
    const title = [item.brand, item.partnumber, item.name].filter(Boolean).join(' ').trim()
      || item.partnumber
      || 'Rossko';
    setShopParts((prev) => [
      ...prev,
      emptyShopPart({
        title: title.slice(0, 255),
        unit_price: String(item.price ?? 0),
        source: 'rossko',
        rossko_brand: item.brand || '',
        rossko_partnumber: item.partnumber || '',
      }),
    ]);
    setPicker(null);
  };

  const goBack = () => {
    navigate('/autoservice/orders');
  };

  const buildPayload = () => ({
    client_id: Number(clientId),
    vehicle_id: Number(vehicleId),
    scheduled_at: fromLocalInputValue(scheduledAt),
    client_comment: comment.trim() || null,
    staff_comment: staffComment.trim() || null,
    lift_number: liftNumber ? Number(liftNumber) : null,
    assignee_user_ids: [],
    works: works.map((w) => ({
      title: w.title.trim(),
      qty: Number(w.qty),
      unit_price: Number(w.unit_price),
      executor_user_id: w.executor_user_id ? Number(w.executor_user_id) : null,
    })),
    client_parts: clientParts.map((p) => ({
      title: p.title.trim(),
      qty: Number(p.qty),
    })),
    shop_parts: shopParts.map((p) => ({
      title: p.title.trim(),
      qty: Number(p.qty),
      unit_price: Number(p.unit_price),
      markup_percent: Number(p.markup_percent),
      source: p.source || 'manual',
      product_id: p.source === 'warehouse' ? p.product_id : null,
      rossko_brand: p.source === 'rossko' ? (p.rossko_brand || null) : null,
      rossko_partnumber: p.source === 'rossko' ? (p.rossko_partnumber || null) : null,
    })),
  });

  const validateForm = () => {
    if (!clientId || !vehicleId || !scheduledAt) {
      return 'Выберите клиента, автомобиль и дату записи';
    }
    const iso = fromLocalInputValue(scheduledAt);
    if (!iso) return 'Некорректная дата записи';
    for (const w of works) {
      if (!String(w.title || '').trim()) return 'У каждой работы должно быть название';
      if (!Number.isInteger(Number(w.qty)) || Number(w.qty) < 1) {
        return 'Количество работы должно быть целым числом ≥ 1';
      }
      if (Number.isNaN(Number(w.unit_price)) || Number(w.unit_price) < 0) {
        return 'Цена работы должна быть ≥ 0';
      }
    }
    for (const p of clientParts) {
      if (!String(p.title || '').trim()) return 'У каждой запчасти клиента должно быть название';
      if (!Number.isInteger(Number(p.qty)) || Number(p.qty) < 1) {
        return 'Количество запчасти должно быть целым числом ≥ 1';
      }
    }
    for (const p of shopParts) {
      if (!String(p.title || '').trim()) return 'У каждой запчасти исполнителя должно быть название';
      if (!Number.isInteger(Number(p.qty)) || Number(p.qty) < 1) {
        return 'Количество ЗЧ исполнителя должно быть целым числом ≥ 1';
      }
      if (Number.isNaN(Number(p.unit_price)) || Number(p.unit_price) < 0) {
        return 'Цена ЗЧ исполнителя должна быть ≥ 0';
      }
      if (Number.isNaN(Number(p.markup_percent)) || Number(p.markup_percent) < 0) {
        return 'Наценка должна быть ≥ 0';
      }
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const body = buildPayload();
      if (isEdit) {
        await apiRequest(`/autoservice/repair-orders/${orderId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiRequest('/autoservice/repair-orders', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      navigate('/autoservice/orders');
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  const pageTitle = isEdit
    ? `Редактирование записи №${orderNumber ?? orderId}`
    : 'Новая запись';

  if (orderLoading || metaLoading || !formInitialized) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/autoservice/orders" className="text-sm text-indigo-600 hover:underline">
          ← К записям
        </Link>
        <p className="mt-6 text-sm text-gray-500">Загрузка…</p>
      </div>
    );
  }

  if (orderError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/autoservice/orders" className="text-sm text-indigo-600 hover:underline">
          ← К записям
        </Link>
        <p className="mt-6 text-sm text-red-600" role="alert">
          {orderError}
        </p>
        <button
          type="button"
          onClick={goBack}
          className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Вернуться к списку
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 pb-28">
      <header className="mb-6">
        <Link to="/autoservice/orders" className="text-sm text-indigo-600 hover:underline">
          ← К записям
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{pageTitle}</h1>
      </header>

      {metaError ? (
        <p className="mb-4 text-sm text-amber-700" role="status">
          {metaError}
        </p>
      ) : null}

      <form id="repair-order-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <SectionCard title="Клиент и автомобиль">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-end justify-between gap-2">
                <label className="block text-sm font-medium text-gray-700">Клиент</label>
                <button
                  type="button"
                  onClick={() => setAddClientOpen(true)}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Добавить
                </button>
              </div>
              <SearchableSelect
                value={clientId}
                onChange={setClientId}
                options={clientOptions}
                placeholder="Поиск по имени или телефону"
                loading={metaLoading}
              />
            </div>
            <div>
              <div className="flex items-end justify-between gap-2">
                <label className="block text-sm font-medium text-gray-700">Автомобиль</label>
                <button
                  type="button"
                  onClick={() => setAddVehicleOpen(true)}
                  disabled={!clientId}
                  className="text-sm text-indigo-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  Добавить
                </button>
              </div>
              <SearchableSelect
                value={vehicleId}
                onChange={setVehicleId}
                options={vehicleOptions}
                placeholder={clientId ? 'Поиск по марке, модели, VIN…' : 'Сначала выберите клиента'}
                disabled={!clientId}
                loading={vehiclesLoading}
                emptyMessage={clientId ? 'Нет автомобилей' : 'Сначала выберите клиента'}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Запись">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Дата записи</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Подъёмник</label>
              <select
                className={inputClass}
                value={liftNumber}
                onChange={(e) => setLiftNumber(e.target.value)}
                disabled={liftsCount <= 0}
              >
                <option value="">{liftsCount > 0 ? 'Не назначен' : 'Нет подъёмников'}</option>
                {Array.from({ length: liftsCount }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    №{n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Комментарий клиента</label>
              <textarea
                className={inputClass}
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Комментарий сотрудника</label>
              <textarea
                className={inputClass}
                rows={2}
                value={staffComment}
                onChange={(e) => setStaffComment(e.target.value)}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Работы"
          action={(
            <button
              type="button"
              onClick={() => setWorks((prev) => [...prev, emptyWork()])}
              className="text-sm text-indigo-600 hover:underline"
            >
              + Добавить
            </button>
          )}
        >
          {works.length === 0 ? (
            <p className="text-sm text-gray-500">Пока нет работ</p>
          ) : (
            <div className="space-y-3">
              {works.map((w, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                    <span>№ {index + 1}</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setWorks((p) => moveItem(p, index, -1))}>
                        ↑
                      </button>
                      <button type="button" onClick={() => setWorks((p) => moveItem(p, index, 1))}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="text-red-600"
                        onClick={() => setWorks((p) => p.filter((_, i) => i !== index))}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <input
                        className={inputSmClass}
                        placeholder="Название"
                        value={w.title}
                        onChange={(e) => updateWork(index, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Кол-во</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className={inputSmClass}
                        value={w.qty}
                        onChange={(e) => updateWork(index, { qty: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Цена</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={inputSmClass}
                        value={w.unit_price}
                        onChange={(e) => updateWork(index, { unit_price: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Сумма</label>
                      <p className="mt-1 text-sm text-gray-800">{formatMoney(lineSum(w.qty, w.unit_price))} ₽</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Исполнитель работы</label>
                      <select
                        className={inputSmClass}
                        value={w.executor_user_id}
                        onChange={(e) => updateWork(index, { executor_user_id: e.target.value })}
                      >
                        <option value="">Не указан</option>
                        {staffOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm font-medium text-gray-900">Итого работ: {formatMoney(worksTotal)} ₽</p>
        </SectionCard>

        <SectionCard
          title="Запчасти клиента"
          action={(
            <button
              type="button"
              onClick={() => setClientParts((prev) => [...prev, emptyClientPart()])}
              className="text-sm text-indigo-600 hover:underline"
            >
              + Добавить
            </button>
          )}
        >
          {clientParts.length === 0 ? (
            <p className="text-sm text-gray-500">Пока нет запчастей клиента</p>
          ) : (
            <div className="space-y-3">
              {clientParts.map((p, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                    <span>№ {index + 1}</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setClientParts((prev) => moveItem(prev, index, -1))}>
                        ↑
                      </button>
                      <button type="button" onClick={() => setClientParts((prev) => moveItem(prev, index, 1))}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="text-red-600"
                        onClick={() => setClientParts((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <input
                        className={inputSmClass}
                        placeholder="Название"
                        value={p.title}
                        onChange={(e) => updatePart(index, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Кол-во</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className={inputSmClass}
                        value={p.qty}
                        onChange={(e) => updatePart(index, { qty: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Запчасти исполнителя">
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              onClick={() => setShopParts((prev) => [...prev, emptyShopPart()])}
              className="text-indigo-600 hover:underline"
            >
              Вручную
            </button>
            <button type="button" onClick={() => openPicker('warehouse')} className="text-indigo-600 hover:underline">
              Со склада
            </button>
            <button type="button" onClick={() => openPicker('rossko')} className="text-indigo-600 hover:underline">
              Из Rossko
            </button>
          </div>
          <div className="mb-4 flex items-end gap-2">
            <div>
              <label className="text-xs text-gray-500">Наценка для всех %</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputSmClass}
                placeholder={shopParts.length && bulkMarkupDisplay === '' ? '—' : ''}
                value={bulkMarkup !== '' ? bulkMarkup : bulkMarkupDisplay}
                onChange={(e) => applyBulkMarkup(e.target.value)}
              />
            </div>
          </div>
          {picker ? (
            <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  {picker === 'warehouse' ? 'Поиск по складу' : 'Поиск Rossko'}
                </p>
                <button type="button" className="text-xs text-gray-500" onClick={() => setPicker(null)}>
                  Закрыть
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  className={inputSmClass}
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder={picker === 'warehouse' ? 'Название / артикул' : 'Артикул'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (picker === 'warehouse') runWarehouseSearch();
                      else runRosskoSearch();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={pickerLoading}
                  onClick={() => (picker === 'warehouse' ? runWarehouseSearch() : runRosskoSearch())}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
                >
                  {pickerLoading ? '…' : 'Найти'}
                </button>
              </div>
              {pickerError ? <p className="mt-2 text-xs text-red-600">{pickerError}</p> : null}
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {pickerResults.length === 0 && !pickerLoading ? (
                  <p className="text-xs text-gray-500">Нет результатов</p>
                ) : (
                  pickerResults.map((item, idx) => (
                    <button
                      key={item.id || `${item.brand}-${item.partnumber}-${idx}`}
                      type="button"
                      className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-left text-xs hover:bg-gray-50"
                      onClick={() => (picker === 'warehouse' ? pickWarehouse(item) : pickRossko(item))}
                    >
                      {picker === 'warehouse' ? (
                        <>
                          <span className="font-medium">{item.title}</span>
                          {' · '}
                          {formatMoney(item.price)} ₽
                          {item.article ? ` · ${item.article}` : ''}
                        </>
                      ) : (
                        <>
                          <span className="font-medium">
                            {item.brand} {item.partnumber}
                          </span>
                          {item.name ? ` — ${item.name}` : ''}
                          {' · '}
                          {formatMoney(item.price)} ₽
                        </>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
          {shopParts.length === 0 ? (
            <p className="text-sm text-gray-500">Пока нет запчастей исполнителя</p>
          ) : (
            <div className="space-y-3">
              {shopParts.map((p, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      № {index + 1}
                      {p.source && p.source !== 'manual' ? ` · ${p.source}` : ''}
                    </span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShopParts((prev) => moveItem(prev, index, -1))}>
                        ↑
                      </button>
                      <button type="button" onClick={() => setShopParts((prev) => moveItem(prev, index, 1))}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="text-red-600"
                        onClick={() => setShopParts((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <input
                        className={inputSmClass}
                        placeholder="Название"
                        value={p.title}
                        onChange={(e) => updateShopPart(index, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Кол-во</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className={inputSmClass}
                        value={p.qty}
                        onChange={(e) => updateShopPart(index, { qty: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Цена</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={inputSmClass}
                        value={p.unit_price}
                        onChange={(e) => updateShopPart(index, { unit_price: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Наценка %</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={inputSmClass}
                        value={p.markup_percent}
                        onChange={(e) => updateShopPart(index, { markup_percent: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Цена с наценкой / сумма</label>
                      <p className="mt-1 text-sm text-gray-800">
                        {formatMoney(priceWithMarkup(p.unit_price, p.markup_percent))} ₽ ·{' '}
                        {formatMoney(shopLineSum(p.qty, p.unit_price, p.markup_percent))} ₽
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm font-medium text-gray-900">
            Итого ЗЧ исполнителя: {formatMoney(shopPartsTotal)} ₽
          </p>
        </SectionCard>

      </form>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              Итого {formatMoney(grandTotal)} ₽
            </p>
            <p className="truncate text-xs text-gray-500">
              работы {formatMoney(worksTotal)} · ЗЧ {formatMoney(shopPartsTotal)}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              form="repair-order-form"
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>

      {addClientOpen ? (
        <AddClientModal onClose={() => setAddClientOpen(false)} onCreated={handleClientCreated} />
      ) : null}

      {addVehicleOpen && clientId ? (
        <GarageQuickAddModal
          clientId={clientId}
          onClose={() => setAddVehicleOpen(false)}
          onCreated={handleVehicleCreated}
        />
      ) : null}
    </div>
  );
}
