import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthReady } from '../../hooks/useAuthReady';
import { useDebouncedValue } from '../../hooks/useDebouncedCallback';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';
import Modal from '../../components/UI/Modal';
import InspectionBookingAddModal from '../../components/Autoservice/InspectionBookingAddModal';
import { UnderlineTabs } from '../../components/UI';
import { apiRequest } from '../../utils/apiClient';
import { formatServerDate, formatServerDateTime } from '../../utils/serverDate';
import { buildActionsDropdownMenuClassName } from '../../utils/actionsDropdownPlacement';

const STATUS_LABELS = {
  new: 'В ожидании',
  processed: 'Обработано',
  cancelled: 'Отменена',
};

const STATUS_STYLES = {
  new: 'bg-amber-50 text-amber-800 ring-amber-200',
  processed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-200',
};

const SOURCE_LABELS = {
  site: 'Сайт',
  staff: 'Сотрудник',
  client: 'Клиент',
};

const STATUS_OPTIONS = [
  { value: 'new', label: 'В ожидании' },
  { value: 'processed', label: 'Обработано' },
  { value: 'cancelled', label: 'Отменена' },
];

function formatVehicleBrief(vehicle) {
  if (!vehicle) return '—';
  const parts = [vehicle.make, vehicle.model].filter(Boolean);
  let label = parts.join(' ').trim();
  if (vehicle.plate) {
    label = label ? `${label} (${vehicle.plate})` : vehicle.plate;
  }
  return label || '—';
}

function StatusBadge({ status, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_STYLES[status] || STATUS_STYLES.new
      } ${className}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function StatusPicker({ status, disabled, saving, onChange, isOpen, onOpenChange }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const rootRef = useRef(null);
  const available = STATUS_OPTIONS.filter((option) => option.value !== status);
  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;

  const setOpen = (next) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (available.length === 0) {
    return <StatusBadge status={status} />;
  }

  return (
    <div ref={rootRef} className="status-picker relative inline-block">
      <button
        type="button"
        disabled={disabled || saving}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="rounded-full transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-wait disabled:opacity-60"
        title="Сменить статус"
      >
        <StatusBadge status={status} className={saving ? 'opacity-70' : ''} />
      </button>
      {open ? (
        <div className={buildActionsDropdownMenuClassName(false, 'w-44 z-50')}>
          {available.map((option) => (
            <ActionsDropdownItem
              key={option.value}
              onClick={() => {
                setOpen(false);
                onChange(option.value);
              }}
            >
              {option.label}
            </ActionsDropdownItem>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BookingMobileCard({ row, updatingId, onStatusChange, onView, openMenuKey, onOpenMenu }) {
  const statusOpen = openMenuKey === `status:${row.id}`;
  const actionsOpen = openMenuKey === `actions:${row.id}`;
  return (
    <div className={`border-b border-gray-100 py-3 last:border-b-0 ${statusOpen || actionsOpen ? 'relative z-30' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onView} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{row.name}</span>
            <StatusPicker
              status={row.status}
              saving={updatingId === row.id}
              disabled={updatingId === row.id}
              isOpen={statusOpen}
              onOpenChange={(next) => onOpenMenu(next ? `status:${row.id}` : null)}
              onChange={(nextStatus) => onStatusChange(row.id, nextStatus)}
            />
          </div>
          <p className="mt-1 text-sm text-gray-600">{row.phone || '—'}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Дата: {formatServerDate(row.preferred_date) || '—'}
            {row.vehicle ? ` · ${formatVehicleBrief(row.vehicle)}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {SOURCE_LABELS[row.source] || row.source || '—'} · {formatServerDateTime(row.created_at)}
          </p>
        </button>
        <div className="shrink-0">
          <ActionsDropdown
            isOpen={actionsOpen}
            onOpenChange={(next) => onOpenMenu(next ? `actions:${row.id}` : null)}
            menuClassName="w-40 z-50"
            estimatedMenuHeight={80}
            showLabel={false}
            buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          >
            <ActionsDropdownItem onClick={onView}>Подробнее</ActionsDropdownItem>
          </ActionsDropdown>
        </div>
      </div>
    </div>
  );
}

function BookingViewModal({ booking, onClose, updatingId, onStatusChange }) {
  if (!booking) return null;

  return (
    <Modal
      open={Boolean(booking)}
      onClose={onClose}
      title={`Заявка · ${booking.name || 'Без имени'}`}
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusPicker
            status={booking.status}
            saving={updatingId === booking.id}
            disabled={updatingId === booking.id}
            onChange={(nextStatus) => onStatusChange(booking.id, nextStatus)}
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Закрыть
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-gray-700">
        <div className="grid gap-3 sm:grid-cols-2">
          <p>
            <span className="font-medium text-gray-900">Телефон:</span> {booking.phone || '—'}
          </p>
          <p>
            <span className="font-medium text-gray-900">Желаемая дата:</span>{' '}
            {formatServerDate(booking.preferred_date) || '—'}
          </p>
          <p>
            <span className="font-medium text-gray-900">Создана:</span>{' '}
            {formatServerDateTime(booking.created_at) || '—'}
          </p>
          <p>
            <span className="font-medium text-gray-900">Источник:</span>{' '}
            {SOURCE_LABELS[booking.source] || booking.source || '—'}
          </p>
          <p className="sm:col-span-2">
            <span className="font-medium text-gray-900">Автомобиль:</span> {formatVehicleBrief(booking.vehicle)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3">
          <p>
            <span className="font-medium text-gray-900">Комментарий:</span>{' '}
            <span className="whitespace-pre-wrap text-gray-700">{booking.notes?.trim() || '—'}</span>
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default function AutoserviceInspectionsPage() {
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');
  const qApplied = useDebouncedValue(q);
  const [addOpen, setAddOpen] = useState(false);
  const [viewBooking, setViewBooking] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [openMenuKey, setOpenMenuKey] = useState(null);
  const menuOpen = Boolean(openMenuKey);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = statusFilter !== 'all' ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const data = await apiRequest(`/autoservice/inspection-bookings${qs}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить заявки');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      load();
    }
  }, [isReady, isAuthenticated, load]);

  const filteredRows = useMemo(() => {
    const query = qApplied.trim().toLowerCase();
    if (!query) return rows;
    const digits = query.replace(/\D/g, '');
    return rows.filter((row) => {
      const name = String(row.name || '').toLowerCase();
      const phone = String(row.phone || '').toLowerCase();
      const phoneDigits = phone.replace(/\D/g, '');
      const notes = String(row.notes || '').toLowerCase();
      const vehicle = formatVehicleBrief(row.vehicle).toLowerCase();
      return (
        name.includes(query) ||
        phone.includes(query) ||
        notes.includes(query) ||
        vehicle.includes(query) ||
        (digits && phoneDigits.includes(digits))
      );
    });
  }, [rows, qApplied]);

  const handleStatusChange = async (id, nextStatus) => {
    setUpdatingId(id);
    setError(null);
    try {
      const updated = await apiRequest(`/autoservice/inspection-bookings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setRows((prev) => prev.map((row) => (row.id === id ? updated : row)));
      setViewBooking((prev) => (prev?.id === id ? updated : prev));
    } catch (err) {
      setError(err?.message || 'Не удалось обновить статус');
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Записи</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading
              ? 'Загрузка…'
              : qApplied.trim()
                ? `${filteredRows.length} из ${rows.length}`
                : `${rows.length} заявок`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Добавить
        </button>
      </div>

      <UnderlineTabs
        className="mb-4"
        ariaLabel="Фильтр записей по статусу"
        gapClassName="gap-4"
        tabs={[
          { id: 'all', label: 'Все' },
          { id: 'new', label: 'В ожидании' },
          { id: 'processed', label: 'Обработано' },
          { id: 'cancelled', label: 'Отменена' },
        ]}
        value={statusFilter}
        onChange={(id) => {
          setStatusFilter(id);
          setOpenMenuKey(null);
          setViewBooking(null);
        }}
      />

      <div className="mb-4 flex items-center gap-2">
        <AutoserviceLiveSearchField
          value={q}
          onChange={setQ}
          placeholder="Имя, телефон, авто или комментарий"
          ariaLabel="Поиск записей"
        />
        <button
          type="button"
          onClick={load}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
          title="Обновить"
          aria-label="Обновить"
        >
          <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className={`hidden w-full md:block ${menuOpen ? 'overflow-visible' : 'overflow-x-auto'}`}>
        <table className="min-w-full table-fixed divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="w-40 py-3 pr-3">Создана</th>
              <th className="py-3 pr-3">Клиент</th>
              <th className="w-36 py-3 pr-3">Дата</th>
              <th className="hidden py-3 pr-3 lg:table-cell">Автомобиль</th>
              <th className="hidden w-28 py-3 pr-3 xl:table-cell">Источник</th>
              <th className="w-36 py-3 pr-3">Статус</th>
              <th className="w-28 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-500">
                  Загрузка…
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-500">
                  {rows.length === 0 ? 'Заявок пока нет' : 'Ничего не найдено'}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const statusOpen = openMenuKey === `status:${row.id}`;
                const actionsOpen = openMenuKey === `actions:${row.id}`;
                const rowMenuOpen = statusOpen || actionsOpen;
                return (
                  <tr
                    key={row.id}
                    className={`cursor-pointer transition-colors hover:bg-gray-50/70 ${rowMenuOpen ? 'relative z-30' : ''}`}
                    onDoubleClick={(e) => {
                      if (e.target.closest('.status-picker') || e.target.closest('.actions-dropdown')) {
                        return;
                      }
                      setViewBooking(row);
                    }}
                  >
                    <td className="whitespace-nowrap py-3 pr-3 align-middle text-gray-600">
                      {formatServerDateTime(row.created_at)}
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <div className="font-medium text-gray-900">{row.name}</div>
                      {row.phone ? <div className="mt-0.5 text-xs text-gray-500">{row.phone}</div> : null}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 align-middle text-gray-700">
                      {formatServerDate(row.preferred_date) || '—'}
                    </td>
                    <td
                      className="hidden max-w-[12rem] truncate py-3 pr-3 align-middle text-gray-700 lg:table-cell"
                      title={formatVehicleBrief(row.vehicle)}
                    >
                      {formatVehicleBrief(row.vehicle)}
                    </td>
                    <td className="hidden py-3 pr-3 align-middle text-gray-600 xl:table-cell">
                      {SOURCE_LABELS[row.source] || row.source || '—'}
                    </td>
                    <td className={`py-3 pr-3 align-middle ${statusOpen ? 'relative z-30' : ''}`}>
                      <StatusPicker
                        status={row.status}
                        saving={updatingId === row.id}
                        disabled={updatingId === row.id}
                        isOpen={statusOpen}
                        onOpenChange={(next) => setOpenMenuKey(next ? `status:${row.id}` : null)}
                        onChange={(nextStatus) => handleStatusChange(row.id, nextStatus)}
                      />
                    </td>
                    <td className={`py-3 text-right align-middle ${actionsOpen ? 'relative z-30' : ''}`}>
                      <ActionsDropdown
                        isOpen={actionsOpen}
                        onOpenChange={(next) => setOpenMenuKey(next ? `actions:${row.id}` : null)}
                        menuClassName="w-40 z-50"
                        estimatedMenuHeight={80}
                        showLabel
                        buttonClassName="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                      >
                        <ActionsDropdownItem onClick={() => setViewBooking(row)}>Подробнее</ActionsDropdownItem>
                      </ActionsDropdown>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className={`md:hidden ${menuOpen ? 'overflow-visible' : ''}`}>
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-500">Загрузка…</p>
        ) : filteredRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            {rows.length === 0 ? 'Заявок пока нет' : 'Ничего не найдено'}
          </p>
        ) : (
          filteredRows.map((row) => (
            <BookingMobileCard
              key={row.id}
              row={row}
              updatingId={updatingId}
              onStatusChange={handleStatusChange}
              onView={() => setViewBooking(row)}
              openMenuKey={openMenuKey}
              onOpenMenu={setOpenMenuKey}
            />
          ))
        )}
      </div>

      <InspectionBookingAddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Добавить заявку"
        onCreated={(row) => {
          setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
        }}
      />

      <BookingViewModal
        booking={viewBooking}
        onClose={() => setViewBooking(null)}
        updatingId={updatingId}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
