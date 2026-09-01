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
import { canEditClientMarkupSettings } from '../../utils/autoservicePermissions';
import { canReviewRepairOrders } from '../../utils/autoservicePermissions';
import { repairOrderNumberLabel } from '../../utils/autoserviceOrderDisplay';
import WorkCatalogInput from '../../components/Autoservice/WorkCatalogInput';
import PurchaseItemsPickerModal from '../../components/Autoservice/PurchaseItemsPickerModal';
import RepairOrderStockPickerModal from '../../components/Autoservice/RepairOrderStockPickerModal';
import AutoserviceWarehouseAddModal from '../../components/Autoservice/AutoserviceWarehouseAddModal';
import ClientMarkupPopover from '../../components/NewParts/ClientMarkupPopover';
import Modal, { ConfirmDialog } from '../../components/UI/Modal';
import { Z_MOBILE_STICKY_FOOTER } from '../../constants/mobileTokens';
import {
  clearRepairOrderFormDraft,
  readRepairOrderFormDraft,
  repairOrderFormSnapshotHasContent,
  writeRepairOrderFormDraft,
} from '../../utils/repairOrderFormDraft';
import {
  clearRepairOrderCartDraft,
  importCartItemsToRepairOrder,
  mapCartItemsToShopParts,
  readRepairOrderCartDraft,
  saveRepairOrderCartDraft,
} from '../../utils/repairOrderCartDraft';
import {
  clearRepairOrderPurchaseDraft,
  importPurchaseGroupsToRepairOrder,
  mapPurchaseItemsToShopParts,
  persistPurchaseDraftGroups,
  readRepairOrderPurchaseDraft,
  removeItemFromPurchaseDraftGroups,
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
import { splitVatInclusive } from '../../utils/updDocument';

const pillInputClass =
  'mt-1 box-border block h-9 w-full min-w-0 max-w-full rounded-full border border-transparent bg-gray-100 px-3 text-sm max-md:text-base text-ink shadow-none transition hover:bg-gray-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 lg:h-8';

const pillInputSmClass =
  'box-border block h-9 w-full min-w-0 max-w-full rounded-full border border-transparent bg-gray-100 px-3 text-sm max-md:text-base text-ink shadow-none transition hover:bg-gray-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 lg:h-8';

const pillTextareaClass =
  'mt-1 box-border block w-full min-w-0 max-w-full rounded-2xl border border-transparent bg-gray-100 px-3 py-2 text-sm max-md:text-base text-ink shadow-none transition hover:bg-gray-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 md:rounded-sg';

const pillDateInputClass =
  'mt-1 box-border block h-9 w-full min-w-0 max-w-full rounded-full border border-transparent bg-gray-100 px-3 text-base text-ink shadow-none transition hover:bg-gray-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 lg:px-4 lg:text-sm sg-native-date-input';

const linkActionClass = 'text-sm font-medium text-brand-600 hover:text-brand-700';

function SectionAddLink({ onClick, label = '+ Добавить' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${linkActionClass} max-lg:inline-flex max-lg:min-h-11 max-lg:items-center`}
    >
      {label}
    </button>
  );
}

const btnPrimaryClass =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-brand-600 px-5 text-sm font-semibold text-white shadow-sg-sm transition hover:bg-brand-700 disabled:opacity-60';

const btnSecondaryClass =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-medium text-ink-soft transition hover:bg-surface-subtle';

const orderFormPageClass =
  'w-full min-w-0 pt-0 pb-28 max-lg:pb-[calc(var(--sg-mobile-sticky-bottom-offset)+8.5rem)] lg:pb-24';

const lineItemRowClass =
  'flex min-w-0 flex-col gap-1 lg:flex-row lg:flex-nowrap lg:items-center lg:gap-1';

const lineItemIdentityClass = 'flex min-w-0 items-center gap-1 lg:contents';

const lineItemControlsClass =
  'flex min-w-0 flex-wrap items-center gap-1 max-lg:pl-[1.125rem] lg:contents';

const lineIndexClass = 'w-3.5 shrink-0 text-center text-[11px] tabular-nums text-ink-muted';

const lineDeleteBtnCompactClass =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs leading-none text-danger-600 transition hover:bg-danger-50 hover:text-danger-700';

const lineDeleteBtnClass =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base leading-none text-danger-600 transition hover:bg-danger-50 hover:text-danger-700 lg:h-6 lg:w-6 lg:text-xs';

function FieldLabel({ children, optional = false, action }) {
  return (
    <div className="flex items-end justify-between gap-2">
      <span className="block min-w-0 text-sg-caption font-medium text-ink-muted">
        {children}
        {optional ? <span className="font-normal text-gray-400"> (необязательно)</span> : null}
      </span>
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

function workUnitPriceFromApi(value) {
  if (value == null || value === '') return '';
  const amount = Number(value);
  if (Number.isNaN(amount) || amount === 0) return '';
  return String(value);
}

function workUnitPriceToPayload(value) {
  if (value == null || value === '') return 0;
  const amount = Number(value);
  return Number.isNaN(amount) ? 0 : amount;
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

function sanitizePositiveIntegerInput(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/^0+/, '') || '';
}

function isEmptyWorkRow(w) {
  if (String(w?.title || '').trim()) return false;
  if (w?.catalog_work_id) return false;
  if ((w?.executors || []).some((ex) => ex.employee_id)) return false;
  if (String(w?.unit_price ?? '') !== '') return false;
  return Number(w?.qty) === 1;
}

function isEmptyClientPartRow(p) {
  return !String(p?.title || '').trim() && (p?.qty === '' || p?.qty == null);
}

function isEmptyShopPartRow(p) {
  if (p?.pending_import || p?.pending_cart_import) return false;
  if (p?.id) return false;
  if (p?.source && p.source !== 'manual') return false;
  if (String(p?.title || '').trim()) return false;
  if (String(p?.brand || '').trim() || String(p?.partnumber || '').trim()) return false;
  return Number(p?.qty) === 1 && Number(p?.unit_price) === 0;
}

function mergeShopPartIdsFromServer(localParts, serverOrder) {
  const serverParts = serverOrder?.shop_parts || [];
  const serverById = new Map(
    serverParts.filter((part) => part.id != null).map((part) => [part.id, part]),
  );
  const serverUnmatched = serverParts.filter(
    (part) => !localParts.some((local) => local.id && String(local.id) === String(part.id)),
  );
  let unmatchedIdx = 0;

  return localParts.map((local) => {
    if (local.id) {
      const serverPart = serverById.get(local.id);
      if (!serverPart) return local;
      return {
        ...local,
        is_imported: Boolean(serverPart.is_imported),
        is_in_cart: Boolean(serverPart.is_in_cart),
        is_manual_editable: Boolean(serverPart.is_manual_editable),
      };
    }
    if (local.pending_import || local.pending_cart_import) return local;
    const serverPart = serverUnmatched[unmatchedIdx];
    if (!serverPart?.id) return local;
    unmatchedIdx += 1;
    return {
      ...local,
      id: serverPart.id,
      is_imported: Boolean(serverPart.is_imported),
      is_in_cart: Boolean(serverPart.is_in_cart),
      is_manual_editable: Boolean(serverPart.is_manual_editable),
    };
  });
}

const AUTO_SAVE_DELAY_MS = 1200;

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
  'flex min-h-9 min-w-0 w-full items-center rounded-full border border-transparent bg-gray-100 px-2.5 py-1 text-sm text-ink max-lg:items-start lg:h-8 lg:min-h-8 lg:py-0';

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
        <span className="block min-w-0 font-medium max-lg:whitespace-normal max-lg:break-words max-lg:line-clamp-2 lg:truncate">{label}</span>
      </button>
    );
  }

  if (isNameLocked) {
    return (
      <div
        className={`${shopPartNameBoxClass} cursor-default bg-surface-muted/80 opacity-90`}
        title={label}
      >
        <span className="block min-w-0 font-medium max-lg:whitespace-normal max-lg:break-words max-lg:line-clamp-2 lg:truncate">{label}</span>
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

const compactControlInputClass =
  'h-9 shrink-0 rounded-full border border-transparent bg-gray-100 px-2 text-sm tabular-nums text-ink focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 max-md:text-base disabled:cursor-not-allowed disabled:opacity-60 lg:h-8';

const compactControlSelectClass =
  'h-9 shrink-0 rounded-full border border-transparent bg-gray-100 px-1.5 text-sm text-ink focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 max-md:text-base disabled:cursor-not-allowed disabled:opacity-60 lg:h-8';

const shopPartControlInputClass = compactControlInputClass;
const shopPartControlSelectClass = compactControlSelectClass;

const clientPartTitleInputClass =
  'box-border h-9 min-w-0 flex-1 rounded-full border border-transparent bg-gray-100 px-2.5 text-sm text-ink transition hover:bg-gray-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 max-md:text-base lg:h-8';

const clientPartControlInputClass = `${compactControlInputClass} w-12 px-1.5 text-center`;

const clientPartControlSelectClass = `${compactControlSelectClass} w-[3.75rem]`;

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

function SectionCard({ title, children, action, compact = false }) {
  return (
    <section className={`min-w-0 rounded-sg-lg border border-line bg-surface ${compact ? 'px-2.5 py-2.5 sm:p-4' : 'px-2.5 py-3 sm:p-5'}`}>
      {title ? (
        <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-line-soft ${compact ? 'mb-2.5 pb-2' : 'mb-4 pb-3'}`}>
          <h2 className={`min-w-0 font-semibold text-ink ${compact ? 'text-sm lg:text-base' : 'text-lg lg:text-sg-subtitle'}`}>{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
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
                  className={`block w-full min-h-11 px-4 py-2.5 text-left text-sm hover:bg-brand-50 lg:min-h-0 ${
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
                className="flex w-full min-h-11 items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-brand-600 hover:bg-brand-50 lg:min-h-0"
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
  const nameInputRef = useRef(null);

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
    <Modal open title="Добавить клиента" onClose={onClose} initialFocusRef={nameInputRef}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sg-caption font-medium text-ink-muted">ФИО</label>
          <input
            ref={nameInputRef}
            className={pillInputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Иванов Иван Иванович"
            disabled={saving}
            required
            maxLength={120}
            autoComplete="name"
          />
        </div>
        <div>
          <label className="block text-sg-caption font-medium text-ink-muted">Телефон (необязательно)</label>
          <input
            type="tel"
            inputMode="tel"
            className={`${pillInputClass} ${phoneError ? '!border-danger-600 !bg-danger-50 focus:!border-danger-600' : ''}`}
            value={phone}
            onChange={(e) => {
              handlePhoneInputChange(e, setPhone);
              setPhoneError('');
            }}
            placeholder="+7 (___) ___-__-__"
            disabled={saving}
            autoComplete="tel"
          />
          {phoneError ? <p className="mt-1 text-sm text-red-600">{phoneError}</p> : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2 max-md:flex-col">
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
    <Modal open title="Добавить сотрудника" onClose={onClose}>
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
        <div className="flex justify-end gap-2 pt-2 max-md:flex-col">
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
    <Modal open title="Добавить автомобиль" onClose={onClose}>
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
        <div className="flex justify-end gap-2 pt-2 max-md:flex-col">
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

function shopPartRowKey(part, index) {
  if (part?.id) return `shop-part-${part.id}`;
  if (part?.pending_import && part.purchase_item_id != null) {
    return `shop-part-pending-${part.purchase_order_type}-${part.purchase_item_id}`;
  }
  if (part?.pending_cart_import && part.cart_item_id != null) {
    return `shop-part-cart-pending-${part.cart_item_type}-${part.cart_item_id}`;
  }
  return `shop-part-draft-${index}`;
}

function shopPartRemoveMessage(part) {
  if (part?.is_imported || part?.pending_import) {
    return 'Убрать позицию из заказ-наряда? Товар останется на складе автосервиса, резерв будет снят.';
  }
  return 'Удалить запчасть из заказ-наряда?';
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
          unit_price: workUnitPriceFromApi(w.unit_price),
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
          is_in_cart: Boolean(p.is_in_cart),
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
  const canEditMarkupSettings = canEditClientMarkupSettings(user, permissionCodes || []);
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
  const [pendingCartItems, setPendingCartItems] = useState([]);
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
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [detachingShopPartId, setDetachingShopPartId] = useState(null);
  const [shopPartRemoveConfirm, setShopPartRemoveConfirm] = useState(null);
  const [lineDeleteConfirm, setLineDeleteConfirm] = useState(null);
  const plannerPrefillRef = useRef(location.state);
  const createInitRef = useRef(false);
  const autoSaveTimerRef = useRef(null);
  const autoSaveResumeTimerRef = useRef(null);
  const skipAutoSaveRef = useRef(true);
  const lastSavedSnapshotRef = useRef('');
  const justAutoCreatedOrderIdRef = useRef(null);
  const persistInFlightRef = useRef(false);
  const mileageTouchedRef = useRef(false);

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
    mileageTouchedRef.current = Boolean(state.mileageKm);
    setWorks((state.works || []).map((w) => ({
      ...w,
      unit_price: workUnitPriceFromApi(w.unit_price),
    })));
    setClientParts(state.clientParts);
    setShopParts(state.shopParts);
  }, []);

  const captureFormSnapshot = useCallback(() => ({
    clientId,
    vehicleId,
    scheduledAt,
    comment,
    staffComment,
    workZoneId,
    scheduledEndAt,
    shippingDate,
    mileageKm,
    works,
    clientParts,
    shopParts,
  }), [
    clientId,
    vehicleId,
    scheduledAt,
    comment,
    staffComment,
    workZoneId,
    scheduledEndAt,
    shippingDate,
    mileageKm,
    works,
    clientParts,
    shopParts,
  ]);

  const captureFormSnapshotRef = useRef(captureFormSnapshot);
  captureFormSnapshotRef.current = captureFormSnapshot;

  const pauseAutoSave = useCallback((snapshotOverride = null) => {
    skipAutoSaveRef.current = true;
    if (autoSaveResumeTimerRef.current) {
      clearTimeout(autoSaveResumeTimerRef.current);
    }
    autoSaveResumeTimerRef.current = setTimeout(() => {
      skipAutoSaveRef.current = false;
      lastSavedSnapshotRef.current = snapshotOverride ?? JSON.stringify(captureFormSnapshotRef.current());
      autoSaveResumeTimerRef.current = null;
    }, 150);
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
      pauseAutoSave();
      setFormInitialized(true);
    } catch (err) {
      setOrderError(err?.message || 'Не удалось загрузить заказ-наряд');
    } finally {
      setOrderLoading(false);
    }
  }, [orderId, applyFormState, pauseAutoSave]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    loadMeta();
  }, [isReady, isAuthenticated, loadMeta]);

  useEffect(() => {
    if (!isReady || !isAuthenticated || !isEdit) return;
    if (String(justAutoCreatedOrderIdRef.current ?? '') === String(orderId ?? '')) {
      justAutoCreatedOrderIdRef.current = null;
      pauseAutoSave();
      return;
    }
    loadOrder();
  }, [isReady, isAuthenticated, isEdit, orderId, loadOrder, pauseAutoSave]);

  useEffect(() => {
    if (!isReady || !isAuthenticated || !isCreate || createInitRef.current) return;
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
    } else {
      const cartDraft = readRepairOrderCartDraft();
      if (cartDraft?.items?.length) {
        setPendingCartItems(cartDraft.items);
        initial.shopParts = mapCartItemsToShopParts(cartDraft.items, clientMarkupPercent);
      }
    }
    const formDraft = readRepairOrderFormDraft('create');
    if (formDraft?.form && repairOrderFormSnapshotHasContent(formDraft.form)) {
      const { shopParts: draftShopParts, ...restDraft } = formDraft.form;
      Object.assign(initial, restDraft);
      const hasImportShopParts = Boolean(draft?.groups?.length)
        || Boolean(readRepairOrderCartDraft()?.items?.length);
      if (!hasImportShopParts && draftShopParts?.length) {
        initial.shopParts = draftShopParts;
      }
    }
    applyFormState(initial);
    pauseAutoSave();
    setFormInitialized(true);
  }, [isReady, isAuthenticated, isCreate, applyFormState, clientMarkupPercent, pauseAutoSave]);

  useEffect(() => {
    if (!formInitialized || (!isCreate && !isEdit)) return undefined;
    const mode = isEdit ? 'edit' : 'create';
    const draftOrderId = isEdit ? orderId : null;
    const timer = setTimeout(() => {
      writeRepairOrderFormDraft(mode, draftOrderId, captureFormSnapshot());
    }, 400);
    const flushDraft = () => {
      writeRepairOrderFormDraft(mode, draftOrderId, captureFormSnapshot());
    };
    window.addEventListener('pagehide', flushDraft);
    document.addEventListener('visibilitychange', flushDraft);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pagehide', flushDraft);
      document.removeEventListener('visibilitychange', flushDraft);
    };
  }, [formInitialized, isCreate, isEdit, orderId, captureFormSnapshot]);

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

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => String(v.id) === String(vehicleId)) || null,
    [vehicles, vehicleId],
  );

  const handleVehicleSelect = useCallback((nextVehicleId) => {
    const nextId = String(nextVehicleId);
    setVehicleId(nextId);
    const vehicle = vehicles.find((v) => String(v.id) === nextId);
    if (vehicle?.mileage_km != null && vehicle?.mileage_km !== '') {
      setMileageKm(String(vehicle.mileage_km));
      mileageTouchedRef.current = false;
      return;
    }
    if (String(vehicleId) !== nextId) {
      setMileageKm('');
      mileageTouchedRef.current = false;
    }
  }, [vehicleId, vehicles]);

  useEffect(() => {
    if (!formInitialized || !vehicleId || mileageTouchedRef.current) return;
    const vehicle = vehicles.find((v) => String(v.id) === String(vehicleId));
    if (!vehicle || vehicle.mileage_km == null || vehicle.mileage_km === '') return;
    setMileageKm(String(vehicle.mileage_km));
  }, [formInitialized, vehicleId, vehicles]);

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
  const grandVat = splitVatInclusive(grandTotal).vat;

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

  const removeShopPartLocally = useCallback((index, part) => {
    setShopParts((prev) => prev.filter((_, i) => i !== index));
    if (part?.pending_import) {
      setPendingPurchaseGroups((prev) => {
        const next = removeItemFromPurchaseDraftGroups(prev, part);
        if (isCreate) {
          persistPurchaseDraftGroups(next);
        }
        return next;
      });
    }
    if (part?.pending_cart_import) {
      setPendingCartItems((prev) => {
        const next = prev.filter(
          (item) => !(item.id === part.cart_item_id && item.itemType === part.cart_item_type),
        );
        if (isCreate) {
          if (next.length) {
            saveRepairOrderCartDraft({ items: next });
          } else {
            clearRepairOrderCartDraft();
          }
        }
        return next;
      });
    }
  }, [isCreate]);

  const requestRemoveShopPart = useCallback((index) => {
    const part = shopParts[index];
    if (!part) return;
    setShopPartRemoveConfirm({ index, part });
  }, [shopParts]);

  const confirmRemoveShopPart = useCallback(async () => {
    const pending = shopPartRemoveConfirm;
    if (!pending) return;

    const { index, part } = pending;
    const isImportedSaved = Boolean(part.is_imported && part.id && !part.pending_import);

    if (isImportedSaved) {
      if (!isEdit || !orderId) {
        setShopPartRemoveConfirm(null);
        return;
      }

      const previousShopParts = shopParts;
      removeShopPartLocally(index, part);
      setShopPartRemoveConfirm(null);
      setDetachingShopPartId(part.id);
      setError('');
      try {
        const order = await apiRequest(
          `/autoservice/repair-orders/${orderId}/shop-parts/${part.id}/imported`,
          { method: 'DELETE' },
        );
        applyFormState(mapOrderToFormState(order));
      } catch (err) {
        setShopParts(previousShopParts);
        setError(err?.message || 'Не удалось убрать позицию из заказ-наряда');
      } finally {
        setDetachingShopPartId(null);
      }
      return;
    }

    removeShopPartLocally(index, part);
    setShopPartRemoveConfirm(null);
  }, [
    shopPartRemoveConfirm,
    shopParts,
    isEdit,
    orderId,
    removeShopPartLocally,
    applyFormState,
  ]);

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
        pauseAutoSave();
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

  const buildPayload = ({ forAutoSave = false } = {}) => {
    const worksSource = forAutoSave ? works.filter((w) => !isEmptyWorkRow(w)) : works;
    const clientPartsSource = forAutoSave
      ? clientParts.filter((p) => !isEmptyClientPartRow(p))
      : clientParts;
    const shopPartsSource = ownMode
      ? []
      : (forAutoSave
        ? shopParts.filter((p) => !isEmptyShopPartRow(p))
        : shopParts);

    return {
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
      works: worksSource.map((w) => ({
        title: w.title.trim(),
        catalog_work_id: w.catalog_work_id ? Number(w.catalog_work_id) : null,
        qty: Number(w.qty),
        unit_price: workUnitPriceToPayload(w.unit_price),
        executors: (w.executors || [])
          .filter((ex) => ex.employee_id)
          .map((ex) => ({
            employee_id: Number(ex.employee_id),
            percent: Number(ex.percent) || 0,
          })),
      })),
      client_parts: clientPartsSource.map((p) => ({
        title: p.title.trim(),
        qty: Number(p.qty),
        unit: p.unit || 'pcs',
      })),
      shop_parts: shopPartsSource
        .filter((p) => !p.pending_import && !p.pending_cart_import)
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
    };
  };

  const validateLineItems = ({ allowEmptyRows = false } = {}) => {
    for (const w of works) {
      if (allowEmptyRows && isEmptyWorkRow(w)) continue;
      if (!String(w.title || '').trim()) return 'У каждой работы должно быть название';
      if (!Number.isInteger(Number(w.qty)) || Number(w.qty) < 1) {
        return 'Количество работы должно быть целым числом ≥ 1';
      }
      if (Number.isNaN(Number(w.unit_price)) || Number(w.unit_price) < 0) {
        return 'Цена работы должна быть ≥ 0';
      }
    }
    for (const p of clientParts) {
      if (allowEmptyRows && isEmptyClientPartRow(p)) continue;
      if (!String(p.title || '').trim()) return 'У каждой запчасти клиента должно быть название';
      if (!Number.isInteger(Number(p.qty)) || Number(p.qty) < 1) {
        return 'Количество запчасти должно быть целым числом ≥ 1';
      }
    }
    for (const p of ownMode ? [] : shopParts) {
      if (allowEmptyRows && isEmptyShopPartRow(p)) continue;
      if (
        p.client_unit_price_override !== ''
        && p.client_unit_price_override != null
        && (Number.isNaN(Number(p.client_unit_price_override))
          || Number(p.client_unit_price_override) < 0)
      ) {
        return 'Итоговая цена запчастей исполнителя должна быть ≥ 0';
      }
      if (p.pending_import || p.pending_cart_import) continue;
      if (!String(p.title || '').trim()) {
        return 'У каждой запчасти исполнителя должно быть наименование';
      }
      if (!isValidShopPartQty(p.qty, p.unit || 'pcs')) {
        return p.unit === 'pcs'
          ? 'Количество запчастей исполнителя должно быть целым числом ≥ 1'
          : 'Количество запчастей исполнителя должно быть ≥ 0,001';
      }
      if (
        isWarehouseLinkedShopPart(p)
        && p.stock_max_qty != null
        && Number(p.qty) > Number(p.stock_max_qty)
      ) {
        return `Количество «${shopPartDisplayName(p)}» не может превышать ${p.stock_max_qty} ${formatShopPartUnit(p.unit || 'pcs')}`;
      }
      if (Number.isNaN(Number(p.unit_price)) || Number(p.unit_price) < 0) {
        return 'Цена запчастей исполнителя должна быть ≥ 0';
      }
      if (Number.isNaN(Number(p.markup_percent)) || Number(p.markup_percent) < 0) {
        return 'Наценка должна быть ≥ 0';
      }
    }
    return '';
  };

  const validateCommonFields = () => {
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
    return '';
  };

  const canAttemptAutoSave = () => (
    Boolean(clientId && vehicleId && (ownMode || scheduledAt))
  );

  const validateForAutoSave = () => {
    if (!canAttemptAutoSave()) return null;
    const commonError = validateCommonFields();
    if (commonError) return commonError;
    return validateLineItems({ allowEmptyRows: true }) || null;
  };

  const getPendingImports = () => {
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
    const cartItemsToImport = isCreate
      ? pendingCartItems.filter((item) => shopParts.some(
        (part) => part.pending_cart_import
          && part.cart_item_id === item.id
          && part.cart_item_type === item.itemType,
      ))
      : [];
    return { groupsToImport, cartItemsToImport };
  };

  const persistRepairOrder = async ({ afterCreate = 'edit' } = {}) => {
    if (persistInFlightRef.current) return null;
    const validationError = validateForAutoSave();
    if (validationError) return validationError;
    if (!canAttemptAutoSave()) return null;

    persistInFlightRef.current = true;
    const snapshotAtSaveStart = JSON.stringify(captureFormSnapshot());
    const targetOrderId = isEdit ? orderId : justAutoCreatedOrderIdRef.current;

    try {
      const body = buildPayload({ forAutoSave: true });

      if (targetOrderId) {
        const updated = await apiRequest(`/autoservice/repair-orders/${targetOrderId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setShopParts((prev) => mergeShopPartIdsFromServer(prev, updated));
        const snapshotNow = JSON.stringify(captureFormSnapshot());
        if (snapshotAtSaveStart === snapshotNow) {
          pauseAutoSave(snapshotNow);
        } else {
          lastSavedSnapshotRef.current = snapshotNow;
        }
        return null;
      }

      skipAutoSaveRef.current = true;
      const { groupsToImport, cartItemsToImport } = getPendingImports();
      const created = await apiRequest('/autoservice/repair-orders', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      justAutoCreatedOrderIdRef.current = created?.id ?? null;
      let saved = created;
      if (created?.id && (groupsToImport.length || cartItemsToImport.length)) {
        saveLinkedRepairOrder(created);
        try {
          if (groupsToImport.length) {
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
          }
          if (cartItemsToImport.length) {
            const updated = await importCartItemsToRepairOrder(
              apiRequest,
              created.id,
              cartItemsToImport.map((item) => ({
                id: item.id,
                type: item.itemType,
              })),
              clientMarkupPercent,
            );
            saved = updated || saved;
          }
          saveLinkedRepairOrder(saved);
        } catch (importErr) {
          clearRepairOrderPurchaseDraft();
          clearRepairOrderCartDraft();
          if (afterCreate === 'edit') {
            justAutoCreatedOrderIdRef.current = created.id;
            navigate(`/autoservice/orders/${created.id}/edit`, { replace: true });
          }
          return importErr?.message || 'Заказ-наряд создан, но импорт позиций не удался';
        }
        clearRepairOrderPurchaseDraft();
        clearRepairOrderCartDraft();
      }

      clearRepairOrderFormDraft('create', null);
      if (afterCreate === 'edit') {
        setOrderNumber(saved?.order_number ?? null);
        applyFormState(mapOrderToFormState(saved));
        justAutoCreatedOrderIdRef.current = saved?.id ?? null;
        pauseAutoSave();
        navigate(`/autoservice/orders/${saved.id}/edit`, { replace: true });
      }
      return null;
    } catch (err) {
      return err?.message || 'Не удалось сохранить';
    } finally {
      persistInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!formInitialized || skipAutoSaveRef.current) return undefined;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      if (skipAutoSaveRef.current || persistInFlightRef.current) return;

      const snapshot = JSON.stringify(captureFormSnapshot());
      if (snapshot === lastSavedSnapshotRef.current) return;

      const validationError = validateForAutoSave();
      if (!canAttemptAutoSave()) return;
      if (validationError) {
        setAutoSaveStatus('error');
        setError(validationError);
        return;
      }

      setAutoSaveStatus('saving');
      setError('');
      const err = await persistRepairOrder();
      if (err) {
        setAutoSaveStatus('error');
        setError(err);
        return;
      }
      lastSavedSnapshotRef.current = snapshot;
      setAutoSaveStatus('saved');
      window.setTimeout(() => {
        setAutoSaveStatus((status) => (status === 'saved' ? 'idle' : status));
      }, 2000);
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [
    formInitialized,
    captureFormSnapshot,
    clientId,
    vehicleId,
    scheduledAt,
    comment,
    staffComment,
    workZoneId,
    scheduledEndAt,
    shippingDate,
    mileageKm,
    works,
    clientParts,
    shopParts,
    isCreate,
    isEdit,
    orderId,
  ]);

  const handleClose = async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (canAttemptAutoSave()) {
      const validationError = validateForAutoSave();
      if (validationError) {
        setError(validationError);
        return;
      }

      const snapshot = JSON.stringify(captureFormSnapshot());
      if (snapshot !== lastSavedSnapshotRef.current || isCreate) {
        setSaving(true);
        setAutoSaveStatus('saving');
        const err = await persistRepairOrder({ afterCreate: isCreate ? 'none' : 'edit' });
        setSaving(false);
        if (err) {
          setAutoSaveStatus('error');
          setError(err);
          return;
        }
        lastSavedSnapshotRef.current = snapshot;
      }
    }

    clearRepairOrderFormDraft(isEdit ? 'edit' : 'create', isEdit ? orderId : null);
    goBack();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  const pageTitle = isEdit
    ? ownMode
      ? `Заказ-наряд ${repairOrderNumberLabel({ id: orderId, order_number: orderNumber })}`
      : `Редактирование заказ-наряда №${orderNumber ?? orderId}`
    : ownMode
      ? 'Новый заказ-наряд'
      : 'Новый заказ-наряд';

  if (orderLoading || metaLoading || !formInitialized) {
    return (
      <div className={orderFormPageClass}>
        <button type="button" onClick={goBack} className={`${linkActionClass} max-lg:hidden`}>
          ← Закрыть
        </button>
        <p className="mt-6 text-sm text-ink-muted max-lg:mt-0">Загрузка…</p>
      </div>
    );
  }

  if (orderError) {
    return (
      <div className={orderFormPageClass}>
        <button type="button" onClick={goBack} className={`${linkActionClass} max-lg:hidden`}>
          ← Закрыть
        </button>
        <p className="mt-6 text-sm text-red-600 max-lg:mt-0" role="alert">
          {orderError}
        </p>
      </div>
    );
  }

  return (
    <div className={orderFormPageClass}>
      <header className="mb-3 max-lg:hidden">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" onClick={handleClose} className={linkActionClass}>
            ← Закрыть
          </button>
          <h1 className="min-w-0 flex-1 break-words text-lg font-semibold leading-snug text-ink lg:text-xl">
            {pageTitle}
          </h1>
        </div>
      </header>

      {metaError ? (
        <p className="mb-4 text-sm text-warning-700" role="status">
          {metaError}
        </p>
      ) : null}

      <form id="repair-order-form" onSubmit={handleSubmit} className="min-w-0 space-y-3">
        {error ? (
          <p className="rounded-sg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700" role="alert">
            {error}
          </p>
        ) : null}

        <SectionCard title="Клиент и заказ-наряд" compact>
          <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="min-w-0">
              <FieldLabel
                action={ownMode ? null : (
                  <button
                    type="button"
                    onClick={() => setAddClientOpen(true)}
                    className={`${linkActionClass} max-lg:inline-flex max-lg:min-h-11 max-lg:items-center`}
                  >
                    Добавить
                  </button>
                )}
              >
                Клиент
              </FieldLabel>
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
            <div className="min-w-0">
              <FieldLabel
                action={ownMode ? null : (
                  <button
                    type="button"
                    onClick={() => setAddVehicleOpen(true)}
                    disabled={!clientId}
                    className={`${linkActionClass} disabled:cursor-not-allowed disabled:text-ink-faint max-lg:inline-flex max-lg:min-h-11 max-lg:items-center`}
                  >
                    Добавить
                  </button>
                )}
              >
                Автомобиль
              </FieldLabel>
              <SearchableSelect
                value={vehicleId}
                onChange={handleVehicleSelect}
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
            <div className="min-w-0 lg:col-span-2">
              <FieldLabel optional>Пробег, км</FieldLabel>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                className={pillInputClass}
                value={mileageKm}
                onChange={(e) => {
                  mileageTouchedRef.current = true;
                  setMileageKm(e.target.value);
                }}
                placeholder="Например, 85000"
                disabled={!vehicleId}
              />
              {selectedVehicle?.mileage_km != null && selectedVehicle.mileage_km !== '' && !mileageKm ? (
                <p className="mt-1 text-xs text-gray-500">
                  Последний пробег по автомобилю:{' '}
                  {Number(selectedVehicle.mileage_km).toLocaleString('ru-RU')} км
                </p>
              ) : null}
            </div>
            {ownMode ? null : (
              <>
                <div className="min-w-0">
                  <FieldLabel>Дата записи</FieldLabel>
                  <input
                    type="datetime-local"
                    step={60}
                    className={pillDateInputClass}
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                  />
                </div>
                <div className="min-w-0">
                  <FieldLabel optional>Окончание</FieldLabel>
                  <input
                    type="datetime-local"
                    step={60}
                    className={pillDateInputClass}
                    value={scheduledEndAt}
                    onChange={(e) => setScheduledEndAt(e.target.value)}
                  />
                </div>
                <div className="min-w-0">
                  <FieldLabel>Рабочая зона</FieldLabel>
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
                <div className="min-w-0">
                  <FieldLabel>Дата поступления запчастей</FieldLabel>
                  <input
                    type="date"
                    className={pillDateInputClass}
                    value={shippingDate}
                    onChange={(e) => setShippingDate(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="min-w-0">
              <FieldLabel>Комментарий клиента</FieldLabel>
              <textarea
                className={pillTextareaClass}
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <FieldLabel>Комментарий сотрудника</FieldLabel>
              <textarea
                className={pillTextareaClass}
                rows={2}
                value={staffComment}
                onChange={(e) => setStaffComment(e.target.value)}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Работы" compact>
          {works.length === 0 ? (
            <p className="text-sm text-ink-muted">Пока нет работ</p>
          ) : (
            <div className="space-y-1">
              {works.map((w, index) => (
                <div key={index} className="min-w-0">
                  <div className={lineItemRowClass}>
                    <div className={lineItemIdentityClass}>
                      <span className={lineIndexClass}>{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <WorkCatalogInput
                          value={w.title}
                          catalogWorkId={w.catalog_work_id}
                          options={workCatalog}
                          onChange={(patch) => updateWork(index, patch)}
                          onCreate={ownMode ? undefined : (name) => createCatalogWork(name, index)}
                        />
                      </div>
                      <button
                        type="button"
                        className={`${lineDeleteBtnCompactClass} lg:order-last`}
                        aria-label="Удалить работу"
                        onClick={() => setLineDeleteConfirm({ type: 'work', index })}
                      >
                        ×
                      </button>
                    </div>
                    <div className={lineItemControlsClass}>
                    <input
                      type="number"
                      min={1}
                      className={`w-12 ${compactControlInputClass} px-1.5 text-center`}
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
                      className={`w-[4.75rem] ${compactControlInputClass}`}
                      placeholder="0 ₽"
                      value={w.unit_price ?? ''}
                      onChange={(e) => updateWork(index, { unit_price: e.target.value })}
                    />
                    <span className="ml-auto shrink-0 text-right text-sm font-medium tabular-nums text-ink lg:ml-0 lg:w-[4.75rem]">
                      {formatMoney(lineSum(w.qty, w.unit_price))} ₽
                    </span>
                    <button
                      type="button"
                      className="shrink-0 whitespace-nowrap py-0.5 text-xs font-medium text-brand-600 hover:text-brand-700"
                      onClick={() => addWorkExecutor(index)}
                    >
                      + сотрудник
                    </button>
                    </>
                    )}
                    </div>
                  </div>
                  {(ownMode ? [] : (w.executors || [])).length > 0 ? (
                    <div className="mt-1 min-w-0 space-y-1 pl-[1.125rem]">
                      {(w.executors || []).map((ex, execIndex) => (
                        <div key={execIndex} className="flex min-w-0 flex-wrap items-center gap-1">
                          <SearchableSelect
                            className="min-w-0 flex-1"
                            inputClassName="block h-9 w-full rounded-full border border-transparent bg-gray-100 px-2.5 text-sm max-md:text-base text-ink shadow-none transition hover:bg-gray-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-0 lg:h-8"
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
                            className={`w-12 ${compactControlInputClass} px-1.5 text-center`}
                            value={ex.percent}
                            onChange={(e) => updateWorkExecutor(index, execIndex, { percent: e.target.value })}
                          />
                          <span className="text-xs text-ink-muted">%</span>
                          <span className="text-xs font-medium tabular-nums text-ink">
                            {formatMoney(workPayAmount(w.qty, w.unit_price, ex.percent))} ₽
                          </span>
                          <button
                            type="button"
                            className={lineDeleteBtnCompactClass}
                            aria-label="Удалить сотрудника"
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
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-2">
            <p className="text-sm font-medium text-ink">Итого: {formatMoney(worksTotal)} ₽</p>
            <SectionAddLink onClick={() => setWorks((prev) => [...prev, emptyWork()])} />
          </div>
        </SectionCard>

        <SectionCard title="Запчасти клиента" compact>
          {clientParts.length === 0 ? (
            <p className="text-sm text-ink-muted">Пока нет запчастей клиента</p>
          ) : (
            <div className="space-y-1">
              {clientParts.map((p, index) => (
                <div key={index} className="flex min-w-0 items-center gap-1">
                  <span className={lineIndexClass}>
                    {index + 1}
                  </span>
                  <input
                    className={clientPartTitleInputClass}
                    placeholder="Название"
                    value={p.title}
                    onChange={(e) => updatePart(index, { title: e.target.value })}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={clientPartControlInputClass}
                    placeholder="Кол-во"
                    aria-label="Количество"
                    value={p.qty}
                    onChange={(e) => updatePart(index, { qty: sanitizePositiveIntegerInput(e.target.value) })}
                    onPaste={(e) => {
                      e.preventDefault();
                      updatePart(index, {
                        qty: sanitizePositiveIntegerInput(e.clipboardData.getData('text')),
                      });
                    }}
                  />
                  <select
                    className={clientPartControlSelectClass}
                    value={p.unit || 'pcs'}
                    aria-label="Единица измерения"
                    onChange={(e) => updatePart(index, { unit: e.target.value })}
                  >
                    <option value="pcs">шт.</option>
                    <option value="l">л</option>
                    <option value="kg">кг</option>
                  </select>
                  <button
                    type="button"
                    className={`${lineDeleteBtnCompactClass} shrink-0`}
                    aria-label="Удалить"
                    onClick={() => setLineDeleteConfirm({ type: 'clientPart', index })}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex justify-end border-t border-line-soft pt-2">
            <SectionAddLink onClick={() => setClientParts((prev) => [...prev, emptyClientPart()])} />
          </div>
        </SectionCard>

        {!ownMode ? (
        <SectionCard
          title="Запчасти исполнителя"
          compact
          action={(
            <div className="flex flex-wrap items-center justify-end gap-2">
              {clientMarkupEnabled ? (
                <div className="flex items-center gap-1.5 text-sm text-ink-muted">
                  <span>Наценка</span>
                  <ClientMarkupPopover
                    onApply={applyShopPartsMarkup}
                    bottomInset={72}
                    readOnly={!canEditMarkupSettings}
                  />
                </div>
              ) : null}
              <SectionAddLink
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShopPartAddMenuOpen(true);
                }}
              />
            </div>
          )}
        >
          {shopParts.length === 0 ? (
            <p className="text-sm text-ink-muted">Пока нет запчастей исполнителя</p>
          ) : (
            <div className="space-y-1">
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
                  <div key={shopPartRowKey(p, index)} className="min-w-0">
                    <div className={lineItemRowClass}>
                      <div className={lineItemIdentityClass}>
                        <span className={lineIndexClass}>
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
                          {p.is_in_cart || p.pending_cart_import ? (
                            <span className="mt-0.5 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                              В корзине
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className={`${lineDeleteBtnCompactClass} disabled:cursor-not-allowed disabled:opacity-50 lg:order-last`}
                          aria-label={isImported ? 'Убрать из заказ-наряда' : 'Удалить'}
                          disabled={detachingShopPartId === p.id}
                          onClick={() => requestRemoveShopPart(index)}
                        >
                          ×
                        </button>
                      </div>
                      <div className={lineItemControlsClass}>
                      <input
                        type="number"
                        min={qtyMin}
                        max={isWarehouseLinked && p.stock_max_qty != null ? p.stock_max_qty : undefined}
                        step={qtyStep}
                        className={`w-12 px-1.5 text-center ${shopPartControlInputClass}${isQtyLocked ? ' cursor-not-allowed bg-surface-muted/80 opacity-80' : ''}`}
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
                        className={`w-[3.75rem] ${shopPartControlSelectClass}${isUnitLocked ? ' cursor-not-allowed bg-surface-muted/80 opacity-80' : ''}`}
                        value={p.unit || 'pcs'}
                        disabled={isUnitLocked}
                        aria-label="Единица измерения"
                        onChange={(e) => updateShopPart(index, { unit: e.target.value })}
                      >
                        <option value="pcs">шт.</option>
                        <option value="l">л</option>
                        <option value="kg">кг</option>
                      </select>
                      <div className="inline-flex shrink-0 items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className={`w-[4.75rem] ${shopPartControlInputClass}`}
                          value={p.client_unit_price_override ?? ''}
                          placeholder={formatRubles(automaticClientUnit)}
                          aria-label="Клиентская цена"
                          onChange={(e) => updateShopPart(index, {
                            client_unit_price_override: e.target.value,
                          })}
                        />
                        <span className="shrink-0 text-xs tabular-nums text-ink-muted">₽</span>
                      </div>
                      <span className="ml-auto w-auto shrink-0 text-right text-sm font-medium tabular-nums text-ink lg:ml-0 lg:w-[4.75rem]">
                        {formatRubles(lineTotal)} ₽
                      </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line-soft pt-2">
            <p className="text-sm font-medium text-ink">
              Итого: {formatRubles(shopPartsTotal)} ₽
            </p>
          </div>
        </SectionCard>
        ) : null}

      </form>

      <div
        className="pointer-events-none mt-4 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(var(--sg-mobile-sticky-bottom-offset)+0.75rem)] max-lg:mt-0 lg:sticky lg:bottom-4"
        style={{ zIndex: Z_MOBILE_STICKY_FOOTER }}
      >
        <div className="pointer-events-auto min-w-0 rounded-sg-lg border border-line bg-surface px-2.5 py-3 sm:p-5">
          <div className="flex w-full min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
            <div className="min-w-0 lg:flex-1">
              <p className="text-sm font-semibold text-ink">
                {ownMode ? 'Заказ-наряд' : `Итого: ${formatMoney(grandTotal)} ₽`}
              </p>
              {ownMode ? null : (
                <p className="text-[11px] leading-snug text-ink-muted sm:text-xs">
                  работы {formatMoney(worksTotal)} · ЗЧ {formatRubles(shopPartsTotal)} · НДС{' '}
                  {formatMoney(grandVat)}
                </p>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
              {autoSaveStatus === 'saving' || saving ? (
                <p className="text-xs text-ink-muted sm:mr-auto" role="status">
                  Сохранение…
                </p>
              ) : null}
              {autoSaveStatus === 'saved' ? (
                <p className="text-xs text-success-700 sm:mr-auto" role="status">
                  Сохранено
                </p>
              ) : null}
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className={`${btnSecondaryClass} max-lg:w-full max-lg:px-3`}
              >
                {saving ? 'Сохранение…' : 'Закрыть'}
              </button>
            </div>
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

      <Modal
        open={shopPartAddMenuOpen}
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

      <ConfirmDialog
        open={Boolean(shopPartRemoveConfirm)}
        onClose={() => {
          if (!detachingShopPartId) setShopPartRemoveConfirm(null);
        }}
        onConfirm={confirmRemoveShopPart}
        title={shopPartRemoveConfirm?.part?.is_imported || shopPartRemoveConfirm?.part?.pending_import
          ? 'Убрать из заказ-наряда'
          : 'Удалить запчасть'}
        message={shopPartRemoveConfirm ? shopPartRemoveMessage(shopPartRemoveConfirm.part) : ''}
        confirmLabel={shopPartRemoveConfirm?.part?.is_imported || shopPartRemoveConfirm?.part?.pending_import
          ? 'Убрать'
          : 'Удалить'}
        cancelLabel="Отмена"
        danger
        loading={Boolean(detachingShopPartId)}
      />

      <ConfirmDialog
        open={Boolean(lineDeleteConfirm)}
        onClose={() => setLineDeleteConfirm(null)}
        onConfirm={() => {
          if (!lineDeleteConfirm) return;
          if (lineDeleteConfirm.type === 'work') {
            setWorks((prev) => prev.filter((_, i) => i !== lineDeleteConfirm.index));
          } else {
            setClientParts((prev) => prev.filter((_, i) => i !== lineDeleteConfirm.index));
          }
          setLineDeleteConfirm(null);
        }}
        title="Удалить позицию?"
        message="Строка будет удалена из заказ-наряда."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        danger
      />
    </div>
  );
}
