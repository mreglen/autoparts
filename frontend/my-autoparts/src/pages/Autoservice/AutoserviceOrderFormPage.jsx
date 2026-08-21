import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import useHistoryBack from '../../hooks/useHistoryBack';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import SoftServiceNotice from '../../components/SoftServiceNotice/SoftServiceNotice';
import GarageQuickAddModal from '../../components/Garage/GarageQuickAddModal';
import { apiRequest } from '../../utils/apiClient';
import { formatPhoneInput, handlePhoneInputChange, validatePhoneOptional } from '../../utils/contactValidation';
import { parseServerDate } from '../../utils/serverDate';
import {
  candidateLabel,
  mapCandidateToGarageCreatePayload,
  mapCandidateToGarageForm,
  softNoticeVariantFromReason,
} from '../../utils/laximoVinCandidate';
import { normalizeVinForLookupOrNull, sanitizeVinInput, VIN_INPUT_MAX_LENGTH } from '../../utils/laximoVin';
import { canUseClientMarkup } from '../../utils/clientMarkupUtils';
import { canReviewRepairOrders } from '../../utils/autoservicePermissions';
import { repairOrderNumberLabel } from '../../utils/autoserviceOrderDisplay';
import WorkCatalogInput from '../../components/Autoservice/WorkCatalogInput';
import PurchaseItemsPickerModal from '../../components/Autoservice/PurchaseItemsPickerModal';
import RepairOrderStockPickerModal from '../../components/Autoservice/RepairOrderStockPickerModal';
import AutoserviceWarehouseAddModal from '../../components/Autoservice/AutoserviceWarehouseAddModal';
import ClientMarkupPopover from '../../components/NewParts/ClientMarkupPopover';
import {
  clearRepairOrderPurchaseDraft,
  importPurchaseGroupsToRepairOrder,
  mapPurchaseItemsToShopParts,
  readRepairOrderPurchaseDraft,
  saveLinkedRepairOrder,
} from '../../utils/repairOrderPurchaseDraft';
import {
  applyManualShopPartFormValues,
  clampWarehouseShopPartQty,
  isManualEditableShopPart,
  isValidShopPartQty,
  isWarehouseLinkedShopPart,
  manualShopPartFormValues,
  priceWithMarkup,
  shopLineSum,
  shopPartDisplayName,
  shopPartPricingOptions,
  formatShopPartUnit,
  warehouseStockKey,
} from '../../utils/repairOrderShopPartUtils';

const pillInputClass =
  'mt-1 block h-10 w-full rounded-full border border-transparent bg-gray-100 px-4 text-sm text-ink shadow-none transition hover:bg-gray-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

const pillInputSmClass =
  'block h-8 w-full rounded-full border border-transparent bg-gray-100 px-3 text-sm text-ink shadow-none transition hover:bg-gray-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

const pillTextareaClass =
  'mt-1 block w-full rounded-sg border border-transparent bg-gray-100 px-4 py-2.5 text-sm text-ink shadow-none transition hover:bg-gray-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0';

const linkActionClass = 'text-sm font-medium text-brand-600 hover:text-brand-700';

function SectionAddLink({ onClick, label = '+ Добавить' }) {
  return (
    <button type="button" onClick={onClick} className={linkActionClass}>
      {label}
    </button>
  );
}

const btnPrimaryClass =
  'inline-flex h-10 items-center justify-center rounded-full bg-brand-600 px-5 text-sm font-semibold text-white shadow-sg-sm transition hover:bg-brand-700 disabled:opacity-60';

const btnSecondaryClass =
  'inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-medium text-ink-soft transition hover:bg-surface-subtle';

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

function formatRubles(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0';
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}

function lineSum(qty, unitPrice) {
  const q = Number(qty) || 0;
  const p = Number(unitPrice) || 0;
  return Math.round(q * p * 100) / 100;
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

function toDateInputValue(iso) {
  if (!iso) return '';
  const d = parseServerDate(iso);
  if (!d || Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayDateInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyWork() {
  return { title: '', catalog_work_id: '', qty: 1, unit_price: '', executors: [] };
}

function emptyExecutor(employeeId = '', percent = '') {
  return { employee_id: employeeId, percent };
}

function workPayAmount(qty, unitPrice, percent) {
  return lineSum(qty, unitPrice) * (Number(percent) || 0) / 100;
}

function emptyClientPart() {
  return { title: '', qty: '', unit: 'pcs' };
}
function emptyShopPart(overrides = {}, defaultMarkupPercent = 0) {
  return {
    title: '',
    brand: '',
    partnumber: '',
    qty: 1,
    unit: 'pcs',
    unit_price: '0',
    markup_percent: String(defaultMarkupPercent),
    client_unit_price_override: '',
    source: 'manual',
    product_id: null,
    autoservice_stock_item_id: null,
    stock_max_qty: null,
    rossko_brand: '',
    rossko_partnumber: '',
    ...overrides,
  };
}

function shopPartLineValue(part) {
  const hasBrandOrArticle = Boolean(
    part?.brand || part?.partnumber || part?.rossko_brand || part?.rossko_partnumber,
  );
  if (!hasBrandOrArticle) return part?.title ?? '';
  return shopPartDisplayName(part) === '—' ? (part?.title || '') : shopPartDisplayName(part);
}

function shopPartNameParts(part) {
  const brand = String(part?.brand || part?.rossko_brand || '').trim();
  const article = String(part?.partnumber || part?.rossko_partnumber || '').trim();
  const title = String(part?.title || '').trim();
  const codeLine = [brand, article].filter(Boolean).join(' ');

  if (codeLine && title) {
    const titleLower = title.toLowerCase();
    const codeLower = codeLine.toLowerCase();
    if (titleLower === codeLower || titleLower.startsWith(`${codeLower} `)) {
      return { primary: title, secondary: '' };
    }
    return { primary: codeLine, secondary: title };
  }
  if (codeLine) return { primary: codeLine, secondary: '' };
  return { primary: title || '—', secondary: '' };
}

const shopPartNameBoxClass =
  'flex h-8 min-w-0 w-full items-center rounded-sg border border-transparent bg-gray-100 px-3 text-sm text-ink';

function ShopPartNameField({
  part,
  isManualEditable,
  isNameLocked,
  onEdit,
  onChange,
}) {
  const { primary, secondary } = shopPartNameParts(part);
  const label = [primary, secondary].filter(Boolean).join(' ') || shopPartDisplayName(part) || '—';

  if (isManualEditable) {
    return (
      <button
        type="button"
        className={`${shopPartNameBoxClass} text-left hover:bg-surface-muted/80`}
        onClick={onEdit}
        title={label}
      >
        <span className="block min-w-0 truncate font-medium">{label}</span>
      </button>
    );
  }

  if (isNameLocked) {
    return (
      <div
        className={`${shopPartNameBoxClass} cursor-default bg-surface-muted/80 opacity-90`}
        title={label}
      >
        <span className="block min-w-0 truncate font-medium">{label}</span>
      </div>
    );
  }

  return (
    <input
      className={`${shopPartNameBoxClass} focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0`}
      placeholder="Бренд, артикул, наименование"
      value={shopPartLineValue(part)}
      onChange={onChange}
      title={shopPartLineValue(part)}
    />
  );
}

const shopPartControlInputClass =
  'h-8 shrink-0 rounded-full border border-transparent bg-gray-100 px-2.5 text-sm text-ink focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

const shopPartControlSelectClass =
  'h-8 shrink-0 rounded-full border border-transparent bg-gray-100 px-2.5 text-sm text-ink focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

function mapShopPartFromApiView(p, defaultMarkupPercent = 0) {
  return {
    id: p.id,
    title: p.title || '',
    brand: p.brand || p.rossko_brand || '',
    partnumber: p.partnumber || p.rossko_partnumber || '',
    qty: (() => {
      const n = Number(p.qty ?? 1);
      if (Number.isNaN(n)) return 1;
      return (p.unit || 'pcs') === 'pcs' ? Math.round(n) : Number(n);
    })(),
    unit: p.unit || 'pcs',
    unit_price: String(p.unit_price ?? '0'),
    markup_percent: String(p.markup_percent ?? defaultMarkupPercent),
    client_unit_price_override: p.client_unit_price_override == null
      ? ''
      : String(p.client_unit_price_override),
    source: p.source || 'manual',
    product_id: p.product_id || null,
    autoservice_stock_item_id: p.autoservice_stock_item_id || null,
    stock_max_qty: p.stock_max_qty ?? null,
    rossko_brand: p.rossko_brand || '',
    rossko_partnumber: p.rossko_partnumber || '',
    is_imported: Boolean(p.is_imported),
    is_manual_editable: Boolean(p.is_manual_editable),
  };
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
  addOptionLabel = 'Добавить',
  onAddClick,
  className = '',
  inputClassName = pillInputClass,
  remoteSearch = false,
  onQueryChange,
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
    if (remoteSearch) return options;
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => (o.searchText || o.label).toLowerCase().includes(q));
  }, [options, query, remoteSearch]);

  useEffect(() => {
    if (!remoteSearch || !onQueryChange || !open) return undefined;
    const timer = setTimeout(() => {
      onQueryChange(query);
    }, 220);
    return () => clearTimeout(timer);
  }, [query, remoteSearch, onQueryChange, open]);

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
          if (!remoteSearch) {
            setQuery('');
          }
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
                  <span className="block font-medium">{o.label}</span>
                  {o.hint ? (
                    <span className="mt-0.5 block text-xs text-brand-600">{o.hint}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
          {onAddClick ? (
            <li className="sticky bottom-0 border-t border-line-soft bg-surface">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-brand-600 hover:bg-brand-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                  onAddClick();
                }}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {addOptionLabel}
              </button>
            </li>
          ) : null}
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
    const phoneErr = validatePhoneOptional(phone);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }
    setSaving(true);
    try {
      const payload = { name: trimmedName };
      if (phone.trim()) payload.phone = phone;
      const row = await apiRequest('/autoservice/clients', {
        method: 'POST',
        body: JSON.stringify(payload),
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
          <label className="block text-sg-caption font-medium text-ink-muted">ФИО</label>
          <input
            className={pillInputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Иванов Иван Иванович"
            disabled={saving}
            required
            maxLength={120}
          />
        </div>
        <div>
          <label className="block text-sg-caption font-medium text-ink-muted">Телефон (необязательно)</label>
          <input
            type="tel"
            className={`${pillInputClass} ${phoneError ? '!border-danger-600 !bg-danger-50 focus:!border-danger-600' : ''}`}
            value={phone}
            onChange={(e) => {
              handlePhoneInputChange(e, setPhone);
              setPhoneError('');
            }}
            placeholder="+7 (___) ___-__-__"
            disabled={saving}
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

function AddEmployeeModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [workPercent, setWorkPercent] = useState('30');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError('Укажите имя');
      return;
    }
    const percent = Number(workPercent);
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      setError('Укажите корректный процент');
      return;
    }
    setSaving(true);
    try {
      const row = await apiRequest('/autoservice/service-employees', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          salary_type: 'percent_work',
          salary_amount: 0,
          work_percent: percent,
        }),
      });
      onCreated(row);
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось добавить сотрудника');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Добавить сотрудника" onClose={onClose}>
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
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sg-caption font-medium text-ink-muted">% от работ</label>
          <input
            type="number"
            min={0}
            max={100}
            className={pillInputClass}
            value={workPercent}
            onChange={(e) => setWorkPercent(e.target.value)}
            disabled={saving}
          />
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
    const vin = normalizeVinForLookupOrNull(form.vin);
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
    shippingDate: order?.shipping_date
      ? toDateInputValue(order.shipping_date)
      : todayDateInputValue(),
    mileageKm: order?.mileage_km != null && order?.mileage_km !== ''
      ? String(order.mileage_km)
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
          unit: p.unit || 'pcs',
        }))
      : [],
    shopParts: (order?.shop_parts || []).length
      ? order.shop_parts.map((p) => ({
          id: p.id,
          title: p.title || '',
          brand: p.brand || p.rossko_brand || '',
          partnumber: p.partnumber || p.rossko_partnumber || '',
          qty: (() => {
            const n = Number(p.qty ?? 1);
            if (Number.isNaN(n)) return 1;
            return (p.unit || 'pcs') === 'pcs' ? Math.round(n) : Number(n);
          })(),
          unit: p.unit || 'pcs',
          unit_price: String(p.unit_price ?? '0'),
          markup_percent: String(p.markup_percent ?? 0),
          client_unit_price_override: p.client_unit_price_override == null
            ? ''
            : String(p.client_unit_price_override),
          source: p.source || 'manual',
          product_id: p.product_id || null,
          autoservice_stock_item_id: p.autoservice_stock_item_id || null,
          stock_max_qty: p.stock_max_qty ?? null,
          rossko_brand: p.rossko_brand || '',
          rossko_partnumber: p.rossko_partnumber || '',
          is_imported: Boolean(p.is_imported),
          is_manual_editable: Boolean(p.is_manual_editable),
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
  const permissionCodes = useSelector((state) => state.auth.permissionCodes);
  const canReviewOrders = canReviewRepairOrders(user, permissionCodes || []);
  const ownMode = Boolean(user?.is_employee) && !canReviewOrders;
  const storedClientMarkupPercent = useSelector(
    (state) => Number(state.clientMarkup.percent) || 0,
  );
  const clientMarkupEnabled = canUseClientMarkup(user);
  const clientMarkupPercent = clientMarkupEnabled ? storedClientMarkupPercent : 0;
  const makeEmptyShopPart = useCallback(
    (overrides = {}) => emptyShopPart(overrides, clientMarkupPercent),
    [clientMarkupPercent]
  );

  const isCreate = location.pathname.endsWith('/new');
  const isEdit = !isCreate && Boolean(orderId);

  const [clients, setClients] = useState([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
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
  const [shippingDate, setShippingDate] = useState(todayDateInputValue);
  const [mileageKm, setMileageKm] = useState('');
  const [workZoneId, setWorkZoneId] = useState('');
  const [works, setWorks] = useState([]);
  const [clientParts, setClientParts] = useState([]);
  const [shopParts, setShopParts] = useState([]);
  const [pendingPurchaseGroups, setPendingPurchaseGroups] = useState([]);
  const [shopPartAddMenuOpen, setShopPartAddMenuOpen] = useState(false);
  const [purchasePickerOpen, setPurchasePickerOpen] = useState(false);
  const [myPartsPickerOpen, setMyPartsPickerOpen] = useState(false);
  const [autoserviceStockPickerOpen, setAutoserviceStockPickerOpen] = useState(false);
  const [shopPartManualOpen, setShopPartManualOpen] = useState(false);
  const [shopPartManualDraft, setShopPartManualDraft] = useState(null);
  const [shopPartEditIndex, setShopPartEditIndex] = useState(null);
  const [shopPartEditSubmitting, setShopPartEditSubmitting] = useState(false);

  useEffect(() => {
    setShopPartManualDraft(null);
  }, [orderId, isCreate]);

  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehiclesError, setVehiclesError] = useState('');

  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [addEmployeeTarget, setAddEmployeeTarget] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [detachingShopPartId, setDetachingShopPartId] = useState(null);
  const plannerPrefillRef = useRef(location.state);
  const createInitRef = useRef(false);

  const applyFormState = useCallback((state) => {
    setClientId(state.clientId);
    setVehicleId(state.vehicleId);
    setScheduledAt(state.scheduledAt);
    setComment(state.comment);
    setStaffComment(state.staffComment);
    setWorkZoneId(state.workZoneId);
    setScheduledEndAt(state.scheduledEndAt);
    setShippingDate(state.shippingDate || todayDateInputValue());
    setMileageKm(state.mileageKm || '');
    setWorks(state.works);
    setClientParts(state.clientParts);
    setShopParts(state.shopParts);
  }, []);

  const loadClients = useCallback(async (query = '') => {
    const q = String(query || '').trim();
    const suffix = q ? `?q=${encodeURIComponent(q)}` : '';
    const data = await apiRequest(`/autoservice/clients${suffix}`);
    setClients(Array.isArray(data) ? data : []);
  }, []);

  const handleClientSearchQuery = useCallback(async (query) => {
    setClientSearchLoading(true);
    try {
      await loadClients(query);
    } catch {
      /* metaError handled elsewhere when needed */
    } finally {
      setClientSearchLoading(false);
    }
  }, [loadClients]);

  const loadServiceEmployees = useCallback(async () => {
    const data = await apiRequest('/autoservice/repair-orders/service-employees-options');
    setServiceEmployees(Array.isArray(data) ? data : []);
  }, []);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    setMetaError('');
    try {
      const [worksData, employeesData, zonesData] = await Promise.all([
        apiRequest('/autoservice/works'),
        apiRequest('/autoservice/repair-orders/service-employees-options'),
        apiRequest('/autoservice/repair-orders/work-zones-meta'),
      ]);
      await loadClients();
      setWorkCatalog(Array.isArray(worksData) ? worksData : []);
      setServiceEmployees(Array.isArray(employeesData) ? employeesData : []);
      setWorkZones(Array.isArray(zonesData?.work_zones) ? zonesData.work_zones : []);
    } catch (err) {
      setMetaError(err?.message || 'Не удалось загрузить справочники');
    } finally {
      setMetaLoading(false);
    }
  }, [loadClients]);

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
      } else if (isCreate && !createInitRef.current) {
        createInitRef.current = true;
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
        const draft = readRepairOrderPurchaseDraft();
        if (draft?.groups?.length) {
          setPendingPurchaseGroups(draft.groups);
          initial.shopParts = draft.groups.flatMap((group) => (
            mapPurchaseItemsToShopParts(group.items, clientMarkupPercent)
          ));
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
        hint: c.matched_vehicle_label || null,
        matchedVehicleId: c.matched_vehicle_id || null,
        searchText: `${c.name} ${c.phone} ${c.matched_vehicle_label || ''}`.toLowerCase(),
      })),
    [clients],
  );

  const handleClientSelect = useCallback((nextClientId) => {
    const option = clientOptions.find((item) => item.value === String(nextClientId));
    setClientId(String(nextClientId));
    if (option?.matchedVehicleId) {
      setVehicleId(String(option.matchedVehicleId));
    }
  }, [clientOptions]);

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
    () => shopParts.reduce(
      (sum, p) => sum + shopLineSum(p.qty, p.unit_price, p.markup_percent, shopPartPricingOptions(p)),
      0,
    ),
    [shopParts],
  );

  const grandTotal = worksTotal + shopPartsTotal;

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

  const handleEmployeeCreated = async (row) => {
    await loadServiceEmployees();
    if (!row?.id || !addEmployeeTarget) return;
    const { workIndex, execIndex } = addEmployeeTarget;
    updateWorkExecutor(workIndex, execIndex, {
      employee_id: String(row.id),
      percent: String(row.work_percent ?? 0),
    });
    setAddEmployeeTarget(null);
  };

  const openAddEmployeeModal = (workIndex, execIndex) => {
    setAddEmployeeTarget({ workIndex, execIndex });
    setAddEmployeeOpen(true);
  };

  const updatePart = (index, patch) => {
    setClientParts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const updateShopPart = (index, patch) => {
    setShopParts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const removeShopPart = useCallback(async (index) => {
    const part = shopParts[index];
    if (!part) return;

    const isImportedSaved = Boolean(part.is_imported && part.id);
    const isPendingImport = Boolean(part.pending_import);

    if (isImportedSaved) {
      const confirmed = window.confirm(
        'Убрать позицию из заказ-наряда? Товар останется на складе автосервиса, резерв будет снят.',
      );
      if (!confirmed || !isEdit || !orderId) return;

      setDetachingShopPartId(part.id);
      setError('');
      try {
        const order = await apiRequest(
          `/autoservice/repair-orders/${orderId}/shop-parts/${part.id}/imported`,
          { method: 'DELETE' },
        );
        applyFormState(mapOrderToFormState(order));
      } catch (err) {
        setError(err?.message || 'Не удалось убрать позицию из заказ-наряда');
      } finally {
        setDetachingShopPartId(null);
      }
      return;
    }

    if (isPendingImport) {
      const confirmed = window.confirm(
        'Убрать позицию из заказ-наряда? Товар останётся на складе автосервиса.',
      );
      if (!confirmed) return;
    }

    setShopParts((prev) => prev.filter((_, i) => i !== index));
  }, [shopParts, isEdit, orderId, applyFormState]);

  const handleManualShopPartAdd = (values) => {
    const isRossko = values.source === 'rossko';
    setShopParts((prev) => [...prev, makeEmptyShopPart({
      title: values.name,
      brand: values.brand || '',
      partnumber: values.article || '',
      qty: values.quantity,
      unit: values.unit || 'pcs',
      unit_price: String(values.unit_price ?? 0),
      source: isRossko ? 'rossko' : 'manual',
      rossko_brand: isRossko ? (values.brand || '') : '',
      rossko_partnumber: isRossko ? (values.article || '') : '',
      is_manual_editable: true,
    })]);
    setShopPartManualDraft(null);
    setShopPartManualOpen(false);
  };

  const handleManualShopPartEdit = async (values) => {
    if (shopPartEditIndex == null) return;
    const part = shopParts[shopPartEditIndex];
    const shouldSyncWarehouse = Boolean(
      isEdit && orderId && part?.id && part?.source === 'autoservice_stock',
    );
    if (shouldSyncWarehouse) {
      setShopPartEditSubmitting(true);
      setError('');
      try {
        const updated = await apiRequest(
          `/autoservice/repair-orders/${orderId}/shop-parts/${part.id}/manual`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              brand: values.brand?.trim() || '',
              article: values.article?.trim() || '',
              name: values.name?.trim(),
              quantity: values.quantity,
              unit: values.unit || 'pcs',
              unit_price: Number(values.unit_price),
            }),
          },
        );
        setShopParts((prev) => prev.map((p, i) => (
          i === shopPartEditIndex
            ? mapShopPartFromApiView(updated, clientMarkupPercent)
            : p
        )));
        setShopPartEditIndex(null);
      } catch (err) {
        setError(err?.message || 'Не удалось сохранить запчасть');
        throw err;
      } finally {
        setShopPartEditSubmitting(false);
      }
      return;
    }
    setShopParts((prev) => prev.map((p, i) => (
      i === shopPartEditIndex ? applyManualShopPartFormValues(p, values) : p
    )));
    setShopPartEditIndex(null);
  };

  const handleMyPartsStockSelect = (item, quantity) => {
    setShopParts((prev) => {
      const stockKey = `warehouse:${item.id}`;
      const usedQty = prev
        .filter((p) => warehouseStockKey(p) === stockKey)
        .reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
      const available = Math.max(0, (Number(item.available_qty) || 0) - usedQty);
      const qty = Math.min(quantity, available);
      if (qty < 1) return prev;
      return [...prev, makeEmptyShopPart({
        title: item.title || item.name || item.article || 'Запчасть',
        brand: item.brand || '',
        partnumber: item.article || item.internal_code || '',
        qty,
        unit: 'pcs',
        unit_price: String(item.price ?? 0),
        source: 'warehouse',
        product_id: item.id,
        stock_max_qty: available,
      })];
    });
  };

  const handleAutoserviceStockSelect = (item, quantity) => {
    setShopParts((prev) => {
      const stockKey = `autoservice:${item.id}`;
      const usedQty = prev
        .filter((p) => warehouseStockKey(p) === stockKey)
        .reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
      const available = Math.max(0, (Number(item.available_qty) || 0) - usedQty);
      const unit = item.unit === 'l' || item.unit === 'kg' ? item.unit : 'pcs';
      const qty = Math.min(quantity, available);
      if (unit === 'pcs' ? qty < 1 : qty < 0.001) return prev;
      return [...prev, makeEmptyShopPart({
        title: item.name || item.article || 'Запчасть',
        brand: item.brand || '',
        partnumber: item.article || '',
        qty,
        unit,
        unit_price: String(item.unit_price ?? 0),
        source: 'autoservice_stock',
        autoservice_stock_item_id: item.id,
        stock_max_qty: available,
      })];
    });
  };

  const applyShopPartsMarkup = (percent) => {
    setShopParts((prev) => prev.map((part) => ({
      ...part,
      markup_percent: String(percent),
    })));
  };

  const handlePurchaseGroupsConfirm = async (groups) => {
    if (!groups?.length) return;
    if (isEdit && orderId) {
      setError('');
      try {
        const updated = await importPurchaseGroupsToRepairOrder(
          apiRequest,
          orderId,
          groups,
          clientMarkupPercent,
        );
        applyFormState(mapOrderToFormState(updated));
        saveLinkedRepairOrder(updated);
      } catch (err) {
        setError(err?.message || 'Не удалось импортировать позиции из заказов');
      }
      return;
    }
    setPendingPurchaseGroups((prev) => {
      const merged = [...prev];
      groups.forEach((group) => {
        const existing = merged.find((entry) => entry.orderType === group.orderType);
        if (existing) {
          group.itemIds.forEach((itemId, index) => {
            if (!existing.itemIds.includes(itemId)) {
              existing.itemIds.push(itemId);
              existing.items.push(group.items[index]);
            }
          });
        } else {
          merged.push({
            orderType: group.orderType,
            itemIds: [...group.itemIds],
            items: [...group.items],
          });
        }
      });
      return merged;
    });
    const previewParts = groups.flatMap((group) => (
      mapPurchaseItemsToShopParts(group.items, clientMarkupPercent)
    ));
    setShopParts((prev) => [...prev, ...previewParts]);
  };

  const goBack = useHistoryBack('/autoservice/orders');

  const buildPayload = () => ({
    client_id: Number(clientId),
    vehicle_id: Number(vehicleId),
    scheduled_at: fromLocalInputValue(scheduledAt),
    scheduled_end_at: scheduledEndAt ? fromLocalInputValue(scheduledEndAt) : null,
    shipping_date: shippingDate || null,
    mileage_km: mileageKm === '' || mileageKm == null ? null : Number(mileageKm),
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
      unit: p.unit || 'pcs',
    })),
    shop_parts: ownMode
      ? []
      : shopParts
      .filter((p) => !p.pending_import)
      .map((p) => ({
        ...(p.id ? { id: p.id } : {}),
        title: p.title.trim(),
        brand: (p.brand || p.rossko_brand || '').trim() || null,
        partnumber: (p.partnumber || p.rossko_partnumber || '').trim() || null,
        qty: Number(p.qty),
        unit: p.unit || 'pcs',
        unit_price: Number(p.unit_price),
        markup_percent: Number(p.markup_percent),
        client_unit_price_override: p.client_unit_price_override === ''
          || p.client_unit_price_override == null
          ? null
          : Number(p.client_unit_price_override),
        source: p.source || 'manual',
        product_id: p.source === 'warehouse' ? p.product_id : null,
        autoservice_stock_item_id: p.source === 'autoservice_stock'
          ? p.autoservice_stock_item_id
          : null,
        rossko_brand: p.source === 'rossko' ? (p.rossko_brand || p.brand || null) : null,
        rossko_partnumber: p.source === 'rossko' ? (p.rossko_partnumber || p.partnumber || null) : null,
      })),
  });

  const validateForm = () => {
    if (!clientId || !vehicleId || (!ownMode && !scheduledAt)) {
      return ownMode
        ? 'Выберите клиента и автомобиль'
        : 'Выберите клиента, автомобиль и дату записи';
    }
    const iso = fromLocalInputValue(scheduledAt);
    if (!ownMode && !iso) return 'Некорректная дата записи';
    const endIso = scheduledEndAt ? fromLocalInputValue(scheduledEndAt) : null;
    if (endIso && iso && new Date(endIso) <= new Date(iso)) {
      return 'Время окончания должно быть позже времени начала';
    }
    if (mileageKm !== '' && mileageKm != null) {
      const mileage = Number(mileageKm);
      if (!Number.isInteger(mileage) || mileage < 0) {
        return 'Пробег должен быть целым числом ≥ 0';
      }
      if (mileage > 9999999) {
        return 'Пробег слишком большой';
      }
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
    for (const p of ownMode ? [] : shopParts) {
      if (
        p.client_unit_price_override !== ''
        && p.client_unit_price_override != null
        && (Number.isNaN(Number(p.client_unit_price_override))
          || Number(p.client_unit_price_override) < 0)
      ) {
        return 'Итоговая цена ЗЧ исполнителя должна быть ≥ 0';
      }
      if (p.pending_import) continue;
      if (!String(p.title || '').trim()) {
        return 'У каждой запчасти исполнителя должно быть наименование';
      }
      if (!isValidShopPartQty(p.qty, p.unit || 'pcs')) {
        return p.unit === 'pcs'
          ? 'Количество ЗЧ исполнителя должно быть целым числом ≥ 1'
          : 'Количество ЗЧ исполнителя должно быть ≥ 0,001';
      }
      if (
        isWarehouseLinkedShopPart(p)
        && p.stock_max_qty != null
        && Number(p.qty) > Number(p.stock_max_qty)
      ) {
        return `Количество «${shopPartDisplayName(p)}» не может превышать ${p.stock_max_qty} ${formatShopPartUnit(p.unit || 'pcs')}`;
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
      const groupsToImport = isCreate
        ? pendingPurchaseGroups
          .map((group) => {
            const itemIds = group.itemIds.filter((itemId) => shopParts.some(
              (part) => part.pending_import
                && part.purchase_item_id === itemId
                && part.purchase_order_type === group.orderType,
            ));
            const items = group.items.filter((item) => itemIds.includes(item.id));
            return { ...group, itemIds, items };
          })
          .filter((group) => group.itemIds.length > 0)
        : [];
      const goToSavedOrder = () => {
        navigate('/autoservice/orders');
      };

      if (isEdit) {
        await apiRequest(`/autoservice/repair-orders/${orderId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        goToSavedOrder();
      } else {
        const created = await apiRequest('/autoservice/repair-orders', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        let saved = created;
        if (created?.id && groupsToImport.length) {
          saveLinkedRepairOrder(created);
          try {
            const itemPriceOverrides = Object.fromEntries(
              shopParts
                .filter((part) => (
                  part.pending_import
                  && part.purchase_item_id
                  && part.client_unit_price_override !== ''
                  && part.client_unit_price_override != null
                ))
                .map((part) => [
                  part.purchase_item_id,
                  Number(part.client_unit_price_override),
                ]),
            );
            const updated = await importPurchaseGroupsToRepairOrder(
              apiRequest,
              created.id,
              groupsToImport,
              clientMarkupPercent,
              itemPriceOverrides,
            );
            saved = updated || created;
            saveLinkedRepairOrder(saved);
          } catch (importErr) {
            setError(importErr?.message || 'Заказ-наряд создан, но импорт из заказов не удался');
            clearRepairOrderPurchaseDraft();
            navigate(`/autoservice/orders/${created.id}/edit`);
            return;
          }
          clearRepairOrderPurchaseDraft();
        }
        goToSavedOrder();
      }
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  const pageTitle = isEdit
    ? ownMode
      ? `Заявка ${repairOrderNumberLabel({ id: orderId, order_number: orderNumber })}`
      : `Редактирование записи №${orderNumber ?? orderId}`
    : ownMode
      ? 'Новая заявка'
      : 'Новая запись';

  if (orderLoading || metaLoading || !formInitialized) {
    return (
      <div className="mx-auto w-full px-1 py-8 sm:px-2 lg:-mx-4 lg:px-2">
        <button type="button" onClick={goBack} className={linkActionClass}>
          ← Назад
        </button>
        <p className="mt-6 text-sm text-ink-muted">Загрузка…</p>
      </div>
    );
  }

  if (orderError) {
    return (
      <div className="mx-auto w-full px-1 py-8 sm:px-2 lg:-mx-4 lg:px-2">
        <button type="button" onClick={goBack} className={linkActionClass}>
          ← Назад
        </button>
        <p className="mt-6 text-sm text-red-600" role="alert">
          {orderError}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
    <div className="mx-auto w-full px-1 py-6 pb-28 sm:px-2 lg:-mx-4 lg:px-2">
      <header className="mb-6">
        <button type="button" onClick={goBack} className={linkActionClass}>
          ← Назад
        </button>
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
                {ownMode ? null : (
                <button
                  type="button"
                  onClick={() => setAddClientOpen(true)}
                  className={linkActionClass}
                >
                  Добавить
                </button>
                )}
              </div>
              <SearchableSelect
                value={clientId}
                onChange={handleClientSelect}
                options={clientOptions}
                placeholder="Поиск по имени, телефону или авто"
                loading={metaLoading || clientSearchLoading}
                remoteSearch
                onQueryChange={handleClientSearchQuery}
              />
            </div>
            <div>
              <div className="flex items-end justify-between gap-2">
                <label className="block text-sg-caption font-medium text-ink-muted">Автомобиль</label>
                {ownMode ? null : (
                <button
                  type="button"
                  onClick={() => setAddVehicleOpen(true)}
                  disabled={!clientId}
                  className={`${linkActionClass} disabled:cursor-not-allowed disabled:text-ink-faint`}
                >
                  Добавить
                </button>
                )}
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

        <SectionCard title={ownMode ? 'Заявка' : 'Запись'}>
          {ownMode ? null : (
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
            <div>
              <label className="block text-sg-caption font-medium text-ink-muted">Дата поступления запчастей</label>
              <input
                type="date"
                className={pillInputClass}
                value={shippingDate}
                onChange={(e) => setShippingDate(e.target.value)}
              />
            </div>
          </div>
          )}
          <div className={`${ownMode ? '' : 'mt-4 '}grid gap-4 sm:grid-cols-2`}>
            <div>
              <label className="block text-sg-caption font-medium text-ink-muted">
                Пробег, км <span className="font-normal text-gray-400">необязательно</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                className={pillInputClass}
                value={mileageKm}
                onChange={(e) => setMileageKm(e.target.value)}
                placeholder="Например, 85000"
              />
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

        <SectionCard title="Работы">
          {works.length === 0 ? (
            <p className="text-sm text-ink-muted">Пока нет работ</p>
          ) : (
            <div className="space-y-2">
              {works.map((w, index) => (
                <div key={index} className="min-w-0 rounded-sg border border-line bg-white px-2 py-1.5">
                  <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                    <span className="w-4 shrink-0 text-center text-xs tabular-nums text-ink-muted">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <WorkCatalogInput
                        value={w.title}
                        catalogWorkId={w.catalog_work_id}
                        options={workCatalog}
                        onChange={(patch) => updateWork(index, patch)}
                        onCreate={ownMode ? undefined : (name) => createCatalogWork(name, index)}
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      className="h-8 w-14 shrink-0 rounded-full border border-transparent bg-gray-100 px-2.5 text-sm text-ink focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0"
                      placeholder={ownMode ? 'Н/ч' : 'Кол-во'}
                      value={w.qty}
                      onChange={(e) => updateWork(index, { qty: e.target.value })}
                    />
                    {ownMode ? null : (
                    <>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-8 w-[5.25rem] shrink-0 rounded-full border border-transparent bg-gray-100 px-2.5 text-sm text-ink focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0"
                      placeholder="0"
                      value={w.unit_price}
                      onChange={(e) => updateWork(index, { unit_price: e.target.value })}
                    />
                    <span className="w-[5.75rem] shrink-0 text-right text-sm font-medium tabular-nums text-ink">
                      {formatMoney(lineSum(w.qty, w.unit_price))} ₽
                    </span>
                    <button
                      type="button"
                      className="shrink-0 whitespace-nowrap text-xs font-medium text-brand-600 hover:text-brand-700"
                      onClick={() => addWorkExecutor(index)}
                    >
                      + сотрудник
                    </button>
                    </>
                    )}
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        className={`${rowActionBtnClass} text-danger-600 hover:bg-danger-50 hover:text-danger-700`}
                        onClick={() => setWorks((p) => p.filter((_, i) => i !== index))}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {(ownMode ? [] : (w.executors || [])).length > 0 ? (
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
                            addOptionLabel="Добавить сотрудника"
                            onAddClick={() => openAddEmployeeModal(index, execIndex)}
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
            <p className="text-sm font-medium text-ink">Итого работ: {formatMoney(worksTotal)} ₽</p>
            <SectionAddLink onClick={() => setWorks((prev) => [...prev, emptyWork()])} />
          </div>
        </SectionCard>

        <SectionCard title="Запчасти клиента">
          {clientParts.length === 0 ? (
            <p className="text-sm text-ink-muted">Пока нет запчастей клиента</p>
          ) : (
            <div className="space-y-2">
              {clientParts.map((p, index) => (
                <div key={index} className="min-w-0 rounded-sg border border-line bg-white px-2 py-1.5">
                  <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                    <span className="w-4 shrink-0 text-center text-xs tabular-nums text-ink-muted">
                      {index + 1}
                    </span>
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
                      className="h-8 w-14 shrink-0 rounded-full border border-transparent bg-gray-100 px-2.5 text-sm text-ink focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0"
                      placeholder="Кол-во"
                      value={p.qty}
                      onChange={(e) => updatePart(index, { qty: e.target.value })}
                    />
                    <select
                      className="h-8 w-[4.25rem] shrink-0 rounded-full border border-transparent bg-gray-100 px-2.5 text-sm text-ink focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0"
                      value={p.unit || 'pcs'}
                      onChange={(e) => updatePart(index, { unit: e.target.value })}
                    >
                      <option value="pcs">шт.</option>
                      <option value="l">л</option>
                      <option value="kg">кг</option>
                    </select>
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        className={`${rowActionBtnClass} text-danger-600 hover:bg-danger-50 hover:text-danger-700`}
                        onClick={() => setClientParts((prev) => prev.filter((_, i) => i !== index))}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex justify-end border-t border-line-soft pt-3">
            <SectionAddLink onClick={() => setClientParts((prev) => [...prev, emptyClientPart()])} />
          </div>
        </SectionCard>

        {!ownMode ? (
        <SectionCard
          title="Запчасти исполнителя"
          action={clientMarkupEnabled ? (
            <div className="flex items-center gap-1.5 text-sm text-ink-muted">
              <span>Наценка</span>
              <ClientMarkupPopover onApply={applyShopPartsMarkup} bottomInset={72} />
            </div>
          ) : null}
        >
          {shopParts.length === 0 ? (
            <p className="text-sm text-ink-muted">Пока нет запчастей исполнителя</p>
          ) : (
            <div className="space-y-2">
              {shopParts.map((p, index) => {
                const pricingOptions = shopPartPricingOptions(p);
                const automaticClientUnit = priceWithMarkup(
                  p.unit_price,
                  p.markup_percent,
                  { ...pricingOptions, clientUnitPriceOverride: null },
                );
                const lineTotal = shopLineSum(p.qty, p.unit_price, p.markup_percent, pricingOptions);
                const qtyStep = p.unit === 'pcs' ? 1 : 0.001;
                const qtyMin = p.unit === 'pcs' ? 1 : 0.001;
                const isImported = Boolean(p.is_imported || p.pending_import);
                const isWarehouseLinked = isWarehouseLinkedShopPart(p);
                const isManualEditable = isManualEditableShopPart(p);
                const isNameLocked = isImported || (isWarehouseLinked && !isManualEditable);
                const isQtyLocked = isImported || (isManualEditable && p.source === 'autoservice_stock');
                const isUnitLocked = isImported || p.source === 'warehouse' || (isManualEditable && p.source === 'autoservice_stock');
                const qtyValue = (p.unit || 'pcs') === 'pcs'
                  ? (Number.isFinite(Number(p.qty)) ? Math.round(Number(p.qty)) : '')
                  : p.qty;

                return (
                  <div
                    key={p.id || `shop-part-${index}`}
                    className="min-w-0 rounded-sg border border-line bg-white px-2 py-1.5"
                  >
                    <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                      <span className="w-4 shrink-0 text-center text-xs tabular-nums text-ink-muted">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <ShopPartNameField
                          part={p}
                          isManualEditable={isManualEditable}
                          isNameLocked={isNameLocked}
                          onEdit={() => setShopPartEditIndex(index)}
                          onChange={(e) => updateShopPart(index, {
                            title: e.target.value,
                            brand: '',
                            partnumber: '',
                            rossko_brand: '',
                            rossko_partnumber: '',
                          })}
                        />
                      </div>
                      <input
                        type="number"
                        min={qtyMin}
                        max={isWarehouseLinked && p.stock_max_qty != null ? p.stock_max_qty : undefined}
                        step={qtyStep}
                        className={`w-14 ${shopPartControlInputClass}${isQtyLocked ? ' cursor-not-allowed bg-surface-muted/80 opacity-80' : ''}`}
                        value={qtyValue}
                        readOnly={isQtyLocked}
                        disabled={isQtyLocked}
                        aria-label="Количество"
                        title={
                          isWarehouseLinked && p.stock_max_qty != null
                            ? `Доступно не более ${p.stock_max_qty} ${formatShopPartUnit(p.unit || 'pcs')}`
                            : undefined
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (isQtyLocked) return;
                          if ((p.unit || 'pcs') === 'pcs') {
                            updateShopPart(index, {
                              qty: clampWarehouseShopPartQty(
                                raw === '' ? '' : Math.round(Number(raw) || 0),
                                p,
                              ),
                            });
                          } else {
                            updateShopPart(index, {
                              qty: clampWarehouseShopPartQty(raw, p),
                            });
                          }
                        }}
                      />
                      <select
                        className={`w-[4.25rem] ${shopPartControlSelectClass}${isUnitLocked ? ' cursor-not-allowed bg-surface-muted/80 opacity-80' : ''}`}
                        value={p.unit || 'pcs'}
                        disabled={isUnitLocked}
                        aria-label="Единица измерения"
                        onChange={(e) => updateShopPart(index, { unit: e.target.value })}
                      >
                        <option value="pcs">шт.</option>
                        <option value="l">л</option>
                        <option value="kg">кг</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={`w-[5.25rem] ${shopPartControlInputClass}`}
                        value={p.client_unit_price_override ?? ''}
                        placeholder={formatRubles(automaticClientUnit)}
                        aria-label="Клиентская цена"
                        onChange={(e) => updateShopPart(index, {
                          client_unit_price_override: e.target.value,
                        })}
                      />
                      <span className="shrink-0 text-xs tabular-nums text-ink-muted">₽</span>
                      <span className="w-[5.75rem] shrink-0 text-right text-sm font-medium tabular-nums text-ink">
                        {formatRubles(lineTotal)} ₽
                      </span>
                      <button
                        type="button"
                        className={`${rowActionBtnClass} shrink-0 text-danger-600 hover:bg-danger-50 hover:text-danger-700 disabled:cursor-not-allowed disabled:opacity-50`}
                        aria-label={isImported ? 'Убрать из заказ-наряда' : 'Удалить'}
                        disabled={detachingShopPartId === p.id}
                        onClick={() => removeShopPart(index)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
            <p className="text-sm font-medium text-ink">
              Итого ЗЧ исполнителя: {formatRubles(shopPartsTotal)} ₽
            </p>
            <SectionAddLink onClick={() => setShopPartAddMenuOpen(true)} />
          </div>
        </SectionCard>
        ) : null}

      </form>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-2 py-3 shadow-sg-md backdrop-blur supports-[backdrop-filter]:bg-surface/90 sm:px-3 lg:px-4">
        <div className="mx-auto flex w-full max-w-sg-content items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {ownMode ? 'Заявка на проверку' : `Итого ${formatMoney(grandTotal)} ₽`}
            </p>
            {ownMode ? (
              <p className="truncate text-xs text-ink-muted">
                После сохранения заявка появится у приёмщика во вкладке «На проверке»
              </p>
            ) : (
            <p className="truncate text-xs text-ink-muted">
              работы {formatMoney(worksTotal)} · ЗЧ {formatRubles(shopPartsTotal)}
            </p>
            )}
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
              {saving ? 'Сохранение…' : ownMode ? 'Отправить на проверку' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>

      {addClientOpen && !ownMode ? (
        <AddClientModal onClose={() => setAddClientOpen(false)} onCreated={handleClientCreated} />
      ) : null}

      {addVehicleOpen && clientId && !ownMode ? (
        <GarageQuickAddModal
          clientId={clientId}
          onClose={() => setAddVehicleOpen(false)}
          onCreated={handleVehicleCreated}
        />
      ) : null}

      {addEmployeeOpen ? (
        <AddEmployeeModal
          onClose={() => {
            setAddEmployeeOpen(false);
            setAddEmployeeTarget(null);
          }}
          onCreated={handleEmployeeCreated}
        />
      ) : null}

      {shopPartAddMenuOpen ? (
        <Modal
          title="Добавить запчасть исполнителя"
          onClose={() => setShopPartAddMenuOpen(false)}
        >
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={`${btnSecondaryClass} w-full`}
              onClick={() => {
                setShopPartAddMenuOpen(false);
                setPurchasePickerOpen(true);
              }}
            >
              Из оформленных заказов
            </button>
            <button
              type="button"
              className={`${btnSecondaryClass} w-full`}
              onClick={() => {
                setShopPartAddMenuOpen(false);
                setMyPartsPickerOpen(true);
              }}
            >
              Добавить из склада «Мои запчасти»
            </button>
            <button
              type="button"
              className={`${btnSecondaryClass} w-full`}
              onClick={() => {
                setShopPartAddMenuOpen(false);
                setAutoserviceStockPickerOpen(true);
              }}
            >
              Добавить со склада автосервиса
            </button>
            <button
              type="button"
              className={`${btnPrimaryClass} w-full`}
              onClick={() => {
                setShopPartAddMenuOpen(false);
                setShopPartManualOpen(true);
              }}
            >
              Добавить вручную
            </button>
          </div>
        </Modal>
      ) : null}

      <PurchaseItemsPickerModal
        open={purchasePickerOpen}
        onClose={() => setPurchasePickerOpen(false)}
        onConfirm={handlePurchaseGroupsConfirm}
      />

      <RepairOrderStockPickerModal
        open={myPartsPickerOpen}
        onClose={() => setMyPartsPickerOpen(false)}
        title="Добавить из склада «Мои запчасти»"
        endpoint="/autoservice/repair-orders/warehouse-products"
        mapSelection={(item, quantity) => ({ item, quantity })}
        onSelect={({ item, quantity }) => handleMyPartsStockSelect(item, quantity)}
      />

      <RepairOrderStockPickerModal
        open={autoserviceStockPickerOpen}
        onClose={() => setAutoserviceStockPickerOpen(false)}
        title="Добавить со склада автосервиса"
        endpoint="/autoservice/warehouse/items"
        mapSelection={(item, quantity) => ({ item, quantity })}
        onSelect={({ item, quantity }) => handleAutoserviceStockSelect(item, quantity)}
      />

      <AutoserviceWarehouseAddModal
        open={shopPartManualOpen}
        onClose={() => setShopPartManualOpen(false)}
        onSubmit={handleManualShopPartAdd}
        title="Добавить запчасть вручную"
        submitLabel="Добавить в заказ-наряд"
        showUnitSelector
        preserveDraftOnClose
        initialValues={shopPartManualDraft}
        onDraftPersist={setShopPartManualDraft}
      />

      <AutoserviceWarehouseAddModal
        open={shopPartEditIndex != null}
        onClose={() => setShopPartEditIndex(null)}
        onSubmit={handleManualShopPartEdit}
        submitting={shopPartEditSubmitting}
        mode="edit"
        initialValues={
          shopPartEditIndex == null
            ? null
            : manualShopPartFormValues(shopParts[shopPartEditIndex])
        }
      />
    </div>
    </div>
  );
}
