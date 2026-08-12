import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
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
import WorkCatalogInput from '../../components/Autoservice/WorkCatalogInput';
import { getRosskoMinPrice, getRosskoParts } from '../AutoParts/NewParts/rosskoHelpers';
import {
  DEFAULT_AUTOSERVICE_MARKUP_PERCENT,
  fetchPublicSiteConfig,
} from '../../redux/slices/PublicInfoSlice';

const pillInputClass =
  'mt-1 block h-10 w-full rounded-full border border-transparent bg-gray-100 px-4 text-sm text-ink shadow-none transition hover:bg-gray-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

const pillInputSmClass =
  'block h-8 w-full rounded-full border border-transparent bg-gray-100 px-3 text-sm text-ink shadow-none transition hover:bg-gray-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

const pillTextareaClass =
  'mt-1 block w-full rounded-sg border border-transparent bg-gray-100 px-4 py-2.5 text-sm text-ink shadow-none transition hover:bg-gray-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0';

const linkActionClass = 'text-sm font-medium text-brand-600 hover:text-brand-700';

const btnPrimaryClass =
  'inline-flex h-10 items-center justify-center rounded-full bg-brand-600 px-5 text-sm font-semibold text-white shadow-sg-sm transition hover:bg-brand-700 disabled:opacity-60';

const btnSecondaryClass =
  'inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-medium text-ink-soft transition hover:bg-surface-subtle';

const lineItemClass = 'rounded-sg border border-line bg-white p-3';

const pillSelectSmClass =
  'min-w-0 flex-1 rounded-full border border-transparent bg-gray-100 px-3 py-1.5 text-sm text-ink focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0';

const rowActionBtnClass =
  'inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs text-ink-muted transition hover:bg-gray-200 hover:text-ink-soft';

function FieldLabel({ children, action }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="text-sg-caption font-medium text-ink-muted">{children}</span>
      {action}
    </div>
  );
}

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
  return { title: '', catalog_work_id: '', qty: 1, unit_price: '0', executors: [] };
}

function emptyExecutor(employeeId = '', percent = '') {
  return { employee_id: employeeId, percent };
}

function workPayAmount(qty, unitPrice, percent) {
  return lineSum(qty, unitPrice) * (Number(percent) || 0) / 100;
}

function emptyClientPart() {
  return { title: '', qty: 1 };
}

function emptyShopPart(overrides = {}, defaultMarkupPercent = DEFAULT_AUTOSERVICE_MARKUP_PERCENT) {
  return {
    title: '',
    qty: 1,
    unit_price: '0',
    markup_percent: String(defaultMarkupPercent),
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
    <section className="rounded-sg-lg border border-line bg-surface p-4 sm:p-5">
      {title ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-3">
          <h2 className="text-sg-subtitle text-ink">{title}</h2>
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
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-sg-lg bg-surface shadow-sg-lg ring-1 ring-line">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <h3 className="text-sg-subtitle text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-faint hover:bg-surface-subtle hover:text-ink-soft"
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
  noResultsMessage = 'Ничего не найдено',
  className = '',
  inputClassName = pillInputClass,
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
  const listEmptyMessage = options.length === 0 ? emptyMessage : noResultsMessage;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <input
        type="text"
        className={inputClassName}
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
        <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-sg-lg border border-line bg-surface py-1 shadow-sg-md">
          {filtered.length === 0 ? (
            <li className="px-4 py-2.5 text-sm text-ink-muted">{listEmptyMessage}</li>
          ) : (
            filtered.map((o) => (
              <li key={String(o.value) || '__empty__'}>
                <button
                  type="button"
                  className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-brand-50 ${
                    String(o.value) === String(value) ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-soft'
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
          <label className="block text-sg-caption font-medium text-ink-muted">Имя</label>
          <input
            className={pillInputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            required
            maxLength={120}
          />
        </div>
        <div>
          <label className="block text-sg-caption font-medium text-ink-muted">Телефон</label>
          <input
            type="tel"
            className={`${pillInputClass} ${phoneError ? '!border-danger-600 !bg-danger-50 focus:!border-danger-600' : ''}`}
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
          <button type="button" onClick={onClose} className={btnSecondaryClass} disabled={saving}>
            Отмена
          </button>
          <button type="submit" disabled={saving} className={btnPrimaryClass}>
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
        <div className="rounded-sg border border-line bg-surface-muted p-4">
          <FieldLabel>Найти по VIN</FieldLabel>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <input
              className={`${pillInputClass} mt-0`}
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
              className={`${btnPrimaryClass} shrink-0`}
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
                    className="w-full rounded-full border border-line bg-surface px-4 py-2.5 text-left text-sm text-ink-soft transition hover:border-brand-300 hover:bg-brand-50"
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
            <label className="block text-sg-caption font-medium text-ink-muted">Марка</label>
            <input
              className={pillInputClass}
              value={form.make}
              onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))}
              disabled={saving}
              required
              maxLength={80}
            />
          </div>
          <div>
            <label className="block text-sg-caption font-medium text-ink-muted">Модель</label>
            <input
              className={pillInputClass}
              value={form.model}
              onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
              disabled={saving}
              required
              maxLength={80}
            />
          </div>
          <div>
            <label className="block text-sg-caption font-medium text-ink-muted">Год</label>
            <input
              type="number"
              min={1900}
              max={2100}
              className={pillInputClass}
              value={form.year}
              onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sg-caption font-medium text-ink-muted">Госномер</label>
            <input
              className={pillInputClass}
              value={form.plate}
              onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))}
              disabled={saving}
              maxLength={20}
            />
          </div>
          <div>
            <label className="block text-sg-caption font-medium text-ink-muted">Цвет</label>
            <input
              className={pillInputClass}
              value={form.color}
              onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
              disabled={saving}
              maxLength={40}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sg-caption font-medium text-ink-muted">Заметки</label>
            <textarea
              className={pillTextareaClass}
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
          <button type="button" onClick={onClose} className={btnSecondaryClass} disabled={saving}>
            Отмена
          </button>
          <button type="submit" disabled={saving} className={btnPrimaryClass}>
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
    workZoneId: order?.work_zone_id != null ? String(order.work_zone_id) : '',
    scheduledEndAt: order?.scheduled_end_at
      ? toLocalInputValue(order.scheduled_end_at)
      : '',
    works: (order?.works || []).length
      ? order.works.map((w) => ({
          title: w.title || '',
          catalog_work_id: w.catalog_work_id ? String(w.catalog_work_id) : '',
          qty: w.qty || 1,
          unit_price: String(w.unit_price ?? '0'),
          executors: (w.executors || []).map((ex) => ({
            employee_id: String(ex.employee_id),
            percent: String(ex.percent ?? '0'),
          })),
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
          markup_percent: String(p.markup_percent ?? DEFAULT_AUTOSERVICE_MARKUP_PERCENT),
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
  const dispatch = useDispatch();
  const { isReady, isAuthenticated, user } = useAuthReady();
  const autoserviceMarkupPercent = useSelector(
    (state) => state.publicInfo.autoserviceMarkupPercent ?? DEFAULT_AUTOSERVICE_MARKUP_PERCENT
  );
  const makeEmptyShopPart = useCallback(
    (overrides = {}) => emptyShopPart(overrides, autoserviceMarkupPercent),
    [autoserviceMarkupPercent]
  );

  const isCreate = location.pathname.endsWith('/new');
  const isEdit = !isCreate && Boolean(orderId);

  const [clients, setClients] = useState([]);
  const [workCatalog, setWorkCatalog] = useState([]);
  const [serviceEmployees, setServiceEmployees] = useState([]);
  const [workZones, setWorkZones] = useState([]);
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
  const [scheduledEndAt, setScheduledEndAt] = useState('');
  const [workZoneId, setWorkZoneId] = useState('');
  const [works, setWorks] = useState([]);
  const [clientParts, setClientParts] = useState([]);
  const [shopParts, setShopParts] = useState([]);

  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehiclesError, setVehiclesError] = useState('');

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
    setWorkZoneId(state.workZoneId);
    setScheduledEndAt(state.scheduledEndAt);
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
      const [clientsData, worksData, employeesData, zonesData] = await Promise.all([
        apiRequest('/autoservice/clients'),
        apiRequest('/autoservice/works'),
        apiRequest('/autoservice/repair-orders/service-employees-options'),
        apiRequest('/autoservice/repair-orders/work-zones-meta'),
      ]);
      setClients(Array.isArray(clientsData) ? clientsData : []);
      setWorkCatalog(Array.isArray(worksData) ? worksData : []);
      setServiceEmployees(Array.isArray(employeesData) ? employeesData : []);
      setWorkZones(Array.isArray(zonesData?.work_zones) ? zonesData.work_zones : []);
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
    dispatch(fetchPublicSiteConfig());
  }, [dispatch]);

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
        if (prefill.workZoneId != null) {
          initial.workZoneId = String(prefill.workZoneId);
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
      setVehiclesError('');
      if (formInitialized) {
        setVehicleId('');
      }
      return;
    }
    let cancelled = false;
    (async () => {
      setVehiclesLoading(true);
      setVehiclesError('');
      try {
        const data = await apiRequest(`/autoservice/garage/vehicles?client_id=${encodeURIComponent(clientId)}`);
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setVehicles(list);
        setVehicleId((prev) => {
          if (prev && list.some((v) => String(v.id) === String(prev))) return String(prev);
          return list[0] ? String(list[0].id) : '';
        });
      } catch (err) {
        if (!cancelled) {
          setVehicles([]);
          setVehicleId('');
          setVehiclesError(err?.message || 'Не удалось загрузить автомобили');
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
        value: String(c.id),
        label: `${c.name} · ${c.phone}`,
        searchText: `${c.name} ${c.phone}`.toLowerCase(),
      })),
    [clients],
  );

  const vehicleOptions = useMemo(
    () =>
      vehicles.map((v) => ({
        value: String(v.id),
        label: vehicleLabel(v),
        searchText: vehicleSearchText(v),
      })),
    [vehicles],
  );

  const employeeOptions = useMemo(
    () => [
      { value: '', label: '—', searchText: '' },
      ...serviceEmployees.map((emp) => ({
        value: String(emp.id),
        label: emp.name,
        searchText: emp.name,
      })),
    ],
    [serviceEmployees],
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

  const createCatalogWork = async (name, workIndex) => {
    try {
      const row = await apiRequest('/autoservice/works', {
        method: 'POST',
        body: JSON.stringify({ name, default_unit_price: 0 }),
      });
      setWorkCatalog((prev) => [...prev, row]);
      updateWork(workIndex, {
        title: row.name,
        catalog_work_id: String(row.id),
        unit_price: String(row.default_unit_price ?? 0),
      });
    } catch (err) {
      setError(err?.message || 'Не удалось добавить работу');
    }
  };

  const addWorkExecutor = (workIndex, employeeId = '') => {
    const emp = serviceEmployees.find((e) => String(e.id) === String(employeeId));
    const percent = emp ? String(emp.work_percent ?? 0) : '';
    setWorks((prev) => prev.map((w, i) => (
      i === workIndex
        ? { ...w, executors: [...(w.executors || []), emptyExecutor(employeeId, percent)] }
        : w
    )));
  };

  const updateWorkExecutor = (workIndex, execIndex, patch) => {
    setWorks((prev) => prev.map((w, i) => {
      if (i !== workIndex) return w;
      const next = (w.executors || []).map((ex, j) => (j === execIndex ? { ...ex, ...patch } : ex));
      if (patch.employee_id) {
        const emp = serviceEmployees.find((e) => String(e.id) === String(patch.employee_id));
        if (emp && !patch.percent) {
          next[execIndex] = { ...next[execIndex], percent: String(emp.work_percent ?? 0) };
        }
      }
      return { ...w, executors: next };
    }));
  };

  const removeWorkExecutor = (workIndex, execIndex) => {
    setWorks((prev) => prev.map((w, i) => (
      i === workIndex
        ? { ...w, executors: (w.executors || []).filter((_, j) => j !== execIndex) }
        : w
    )));
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
      makeEmptyShopPart({
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
      makeEmptyShopPart({
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
    scheduled_end_at: scheduledEndAt ? fromLocalInputValue(scheduledEndAt) : null,
    client_comment: comment.trim() || null,
    staff_comment: staffComment.trim() || null,
    work_zone_id: workZoneId ? Number(workZoneId) : null,
    assignee_user_ids: [],
    works: works.map((w) => ({
      title: w.title.trim(),
      catalog_work_id: w.catalog_work_id ? Number(w.catalog_work_id) : null,
      qty: Number(w.qty),
      unit_price: Number(w.unit_price),
      executors: (w.executors || [])
        .filter((ex) => ex.employee_id)
        .map((ex) => ({
          employee_id: Number(ex.employee_id),
          percent: Number(ex.percent) || 0,
        })),
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
    const endIso = scheduledEndAt ? fromLocalInputValue(scheduledEndAt) : null;
    if (endIso && iso && new Date(endIso) <= new Date(iso)) {
      return 'Время окончания должно быть позже времени начала';
    }
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
        <Link to="/autoservice/orders" className={linkActionClass}>
          ← К записям
        </Link>
        <p className="mt-6 text-sm text-ink-muted">Загрузка…</p>
      </div>
    );
  }

  if (orderError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/autoservice/orders" className={linkActionClass}>
          ← К записям
        </Link>
        <p className="mt-6 text-sm text-red-600" role="alert">
          {orderError}
        </p>
        <button type="button" onClick={goBack} className={`${btnSecondaryClass} mt-4`}>
          Вернуться к списку
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
    <div className="mx-auto max-w-4xl px-4 py-6 pb-28">
      <header className="mb-6">
        <Link to="/autoservice/orders" className={linkActionClass}>
          ← К записям
        </Link>
        <h1 className="mt-2 text-sg-title text-ink">{pageTitle}</h1>
      </header>

      {metaError ? (
        <p className="mb-4 text-sm text-warning-700" role="status">
          {metaError}
        </p>
      ) : null}

      <form id="repair-order-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-sg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700" role="alert">
            {error}
          </p>
        ) : null}

        <SectionCard title="Клиент и автомобиль">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-end justify-between gap-2">
                <label className="block text-sg-caption font-medium text-ink-muted">Клиент</label>
                <button
                  type="button"
                  onClick={() => setAddClientOpen(true)}
                  className={linkActionClass}
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
                <label className="block text-sg-caption font-medium text-ink-muted">Автомобиль</label>
                <button
                  type="button"
                  onClick={() => setAddVehicleOpen(true)}
                  disabled={!clientId}
                  className={`${linkActionClass} disabled:cursor-not-allowed disabled:text-ink-faint`}
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
                emptyMessage={vehiclesError || (clientId ? 'Нет автомобилей' : 'Сначала выберите клиента')}
                noResultsMessage="Нет совпадений"
              />
              {vehiclesError ? (
                <p className="mt-1 text-xs text-danger-600" role="alert">{vehiclesError}</p>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Запись">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sg-caption font-medium text-ink-muted">Дата записи</label>
              <input
                type="datetime-local"
                className={pillInputClass}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sg-caption font-medium text-ink-muted">Окончание (необязательно)</label>
              <input
                type="datetime-local"
                className={pillInputClass}
                value={scheduledEndAt}
                onChange={(e) => setScheduledEndAt(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sg-caption font-medium text-ink-muted">Рабочая зона</label>
              <select
                className={pillInputClass}
                value={workZoneId}
                onChange={(e) => setWorkZoneId(e.target.value)}
                disabled={workZones.length <= 0}
              >
                <option value="">{workZones.length > 0 ? 'Не назначена' : 'Нет рабочих зон'}</option>
                {workZones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            <div>
              <label className="block text-sg-caption font-medium text-ink-muted">Комментарий клиента</label>
              <textarea
                className={pillTextareaClass}
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sg-caption font-medium text-ink-muted">Комментарий сотрудника</label>
              <textarea
                className={pillTextareaClass}
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
              className={linkActionClass}
            >
              + Добавить
            </button>
          )}
        >
          {works.length === 0 ? (
            <p className="text-sm text-ink-muted">Пока нет работ</p>
          ) : (
            <div className="space-y-2">
              {works.map((w, index) => (
                <div key={index} className="min-w-0 rounded-sg border border-line bg-white px-2.5 py-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="w-4 shrink-0 text-center text-xs tabular-nums text-ink-muted">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <WorkCatalogInput
                        value={w.title}
                        catalogWorkId={w.catalog_work_id}
                        options={workCatalog}
                        onChange={(patch) => updateWork(index, patch)}
                        onCreate={(name) => createCatalogWork(name, index)}
                      />
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <button type="button" className={rowActionBtnClass} onClick={() => setWorks((p) => moveItem(p, index, -1))}>↑</button>
                      <button type="button" className={rowActionBtnClass} onClick={() => setWorks((p) => moveItem(p, index, 1))}>↓</button>
                      <button
                        type="button"
                        className={`${rowActionBtnClass} text-danger-600 hover:bg-danger-50 hover:text-danger-700`}
                        onClick={() => setWorks((p) => p.filter((_, i) => i !== index))}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 pl-5">
                    <input
                      type="number"
                      min={1}
                      className="h-8 w-16 shrink-0 rounded-full border border-transparent bg-gray-100 px-2.5 text-sm text-ink focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0"
                      placeholder="Кол-во"
                      value={w.qty}
                      onChange={(e) => updateWork(index, { qty: e.target.value })}
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-8 w-24 shrink-0 rounded-full border border-transparent bg-gray-100 px-2.5 text-sm text-ink focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0"
                      placeholder="Цена"
                      value={w.unit_price}
                      onChange={(e) => updateWork(index, { unit_price: e.target.value })}
                    />
                    <span className="text-xs tabular-nums text-ink-muted">
                      {formatMoney(lineSum(w.qty, w.unit_price))} ₽
                    </span>
                    <button
                      type="button"
                      className="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700"
                      onClick={() => addWorkExecutor(index)}
                    >
                      + сотрудник
                    </button>
                  </div>
                  {(w.executors || []).length > 0 ? (
                    <div className="mt-1.5 min-w-0 space-y-1 pl-5">
                      {(w.executors || []).map((ex, execIndex) => (
                        <div key={execIndex} className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 ring-1 ring-line">
                          <SearchableSelect
                            className="min-w-0 flex-1"
                            inputClassName="block h-8 w-full rounded-full border border-transparent bg-gray-100 px-3 text-sm text-ink shadow-none transition hover:bg-gray-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0"
                            value={ex.employee_id}
                            onChange={(next) => updateWorkExecutor(index, execIndex, { employee_id: next })}
                            options={employeeOptions}
                            placeholder="Сотрудник"
                            emptyMessage="Нет сотрудников"
                            noResultsMessage="Не найдено"
                          />
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className="h-7 w-16 shrink-0 rounded-full border border-transparent bg-gray-100 px-2 text-sm text-ink focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0"
                            value={ex.percent}
                            onChange={(e) => updateWorkExecutor(index, execIndex, { percent: e.target.value })}
                          />
                          <span className="text-xs text-ink-muted">%</span>
                          <span className="text-xs font-medium tabular-nums text-ink">
                            {formatMoney(workPayAmount(w.qty, w.unit_price, ex.percent))} ₽
                          </span>
                          <button
                            type="button"
                            className="text-xs text-danger-600 hover:text-danger-700"
                            onClick={() => removeWorkExecutor(index, execIndex)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm font-medium text-ink">Итого работ: {formatMoney(worksTotal)} ₽</p>
        </SectionCard>

        <SectionCard
          title="Запчасти клиента"
          action={(
            <button
              type="button"
              onClick={() => setClientParts((prev) => [...prev, emptyClientPart()])}
              className={linkActionClass}
            >
              + Добавить
            </button>
          )}
        >
          {clientParts.length === 0 ? (
            <p className="text-sm text-ink-muted">Пока нет запчастей клиента</p>
          ) : (
            <div className="space-y-3">
              {clientParts.map((p, index) => (
                <div key={index} className={lineItemClass}>
                  <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
                    <span>№ {index + 1}</span>
                    <div className="flex gap-1">
                      <button type="button" className={rowActionBtnClass} onClick={() => setClientParts((prev) => moveItem(prev, index, -1))}>
                        ↑
                      </button>
                      <button type="button" className={rowActionBtnClass} onClick={() => setClientParts((prev) => moveItem(prev, index, 1))}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-danger-600 hover:text-danger-700"
                        onClick={() => setClientParts((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className={`min-w-0 flex-1 ${pillInputSmClass}`}
                      placeholder="Название"
                      value={p.title}
                      onChange={(e) => updatePart(index, { title: e.target.value })}
                    />
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className={`w-24 shrink-0 ${pillInputSmClass}`}
                      placeholder="Кол-во"
                      value={p.qty}
                      onChange={(e) => updatePart(index, { qty: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Запчасти исполнителя">
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShopParts((prev) => [...prev, makeEmptyShopPart()])}
              className="inline-flex h-9 items-center rounded-full bg-gray-100 px-4 text-sm font-medium text-ink-soft transition hover:bg-gray-200"
            >
              Вручную
            </button>
            <button
              type="button"
              onClick={() => openPicker('warehouse')}
              className="inline-flex h-9 items-center rounded-full bg-gray-100 px-4 text-sm font-medium text-ink-soft transition hover:bg-gray-200"
            >
              Со склада
            </button>
            <button
              type="button"
              onClick={() => openPicker('rossko')}
              className="inline-flex h-9 items-center rounded-full bg-gray-100 px-4 text-sm font-medium text-ink-soft transition hover:bg-gray-200"
            >
              Из Rossko
            </button>
          </div>
          <div className="mb-4 flex items-end gap-2">
            <div>
              <label className="text-xs text-ink-muted">Наценка для всех %</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={pillInputSmClass}
                placeholder={shopParts.length && bulkMarkupDisplay === '' ? '—' : ''}
                value={bulkMarkup !== '' ? bulkMarkup : bulkMarkupDisplay}
                onChange={(e) => applyBulkMarkup(e.target.value)}
              />
            </div>
          </div>
          {picker ? (
            <div className="mb-4 rounded-sg border border-brand-100 bg-brand-50/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">
                  {picker === 'warehouse' ? 'Поиск по складу' : 'Поиск Rossko'}
                </p>
                <button type="button" className="text-xs text-ink-muted hover:text-ink-soft" onClick={() => setPicker(null)}>
                  Закрыть
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  className={`${pillInputSmClass} flex-1`}
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
                  className={`${btnPrimaryClass} h-9 px-4`}
                >
                  {pickerLoading ? '…' : 'Найти'}
                </button>
              </div>
              {pickerError ? <p className="mt-2 text-xs text-danger-600">{pickerError}</p> : null}
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {pickerResults.length === 0 && !pickerLoading ? (
                  <p className="text-xs text-ink-muted">Нет результатов</p>
                ) : (
                  pickerResults.map((item, idx) => (
                    <button
                      key={item.id || `${item.brand}-${item.partnumber}-${idx}`}
                      type="button"
                      className="block w-full rounded-full border border-line bg-surface px-3 py-2 text-left text-xs text-ink-soft transition hover:border-brand-300 hover:bg-brand-50"
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
            <p className="text-sm text-ink-muted">Пока нет запчастей исполнителя</p>
          ) : (
            <div className="space-y-3">
              {shopParts.map((p, index) => (
                <div key={index} className={lineItemClass}>
                  <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
                    <span>
                      № {index + 1}
                      {p.source && p.source !== 'manual' ? ` · ${p.source}` : ''}
                    </span>
                    <div className="flex gap-1">
                      <button type="button" className={rowActionBtnClass} onClick={() => setShopParts((prev) => moveItem(prev, index, -1))}>
                        ↑
                      </button>
                      <button type="button" className={rowActionBtnClass} onClick={() => setShopParts((prev) => moveItem(prev, index, 1))}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-danger-600 hover:text-danger-700"
                        onClick={() => setShopParts((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <input
                        className={pillInputSmClass}
                        placeholder="Название"
                        value={p.title}
                        onChange={(e) => updateShopPart(index, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink-muted">Кол-во</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className={pillInputSmClass}
                        value={p.qty}
                        onChange={(e) => updateShopPart(index, { qty: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink-muted">Цена</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={pillInputSmClass}
                        value={p.unit_price}
                        onChange={(e) => updateShopPart(index, { unit_price: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink-muted">Наценка %</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={pillInputSmClass}
                        value={p.markup_percent}
                        onChange={(e) => updateShopPart(index, { markup_percent: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink-muted">Цена с наценкой / сумма</label>
                      <p className="mt-1 text-sm text-ink-soft">
                        {formatMoney(priceWithMarkup(p.unit_price, p.markup_percent))} ₽ ·{' '}
                        {formatMoney(shopLineSum(p.qty, p.unit_price, p.markup_percent))} ₽
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm font-medium text-ink">
            Итого ЗЧ исполнителя: {formatMoney(shopPartsTotal)} ₽
          </p>
        </SectionCard>

      </form>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 py-3 shadow-sg-md backdrop-blur supports-[backdrop-filter]:bg-surface/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              Итого {formatMoney(grandTotal)} ₽
            </p>
            <p className="truncate text-xs text-ink-muted">
              работы {formatMoney(worksTotal)} · ЗЧ {formatMoney(shopPartsTotal)}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={goBack} className={btnSecondaryClass}>
              Отмена
            </button>
            <button
              type="submit"
              form="repair-order-form"
              disabled={saving}
              className={btnPrimaryClass}
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
    </div>
  );
}
