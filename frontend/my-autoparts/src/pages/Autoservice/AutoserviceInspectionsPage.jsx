import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import { useDebouncedValue } from '../../hooks/useDebouncedCallback';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import Modal from '../../components/UI/Modal';
import InspectionBookingAddModal from '../../components/Autoservice/InspectionBookingAddModal';
import { UnderlineTabs } from '../../components/UI';
import { apiRequest } from '../../utils/apiClient';
import { formatServerDate, formatServerDateTime } from '../../utils/serverDate';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import {
  autoserviceListTableClass,
  autoserviceListTheadRowClass,
  autoserviceListThClass,
  autoserviceListTbodyClass,
  autoserviceListTrClickableClass,
  autoserviceListTdClass,
} from '../../utils/warehouseListUi';

const SOURCE_LABELS = {
  site: 'Сайт',
  staff: 'Сотрудник',
  client: 'Клиент',
};

function formatPreferredDateTime(row) {
  const date = formatServerDate(row?.preferred_date) || '—';
  return row?.preferred_time ? `${date}, ${row.preferred_time.slice(0, 5)}` : date;
}

function formatVehicleBrief(vehicle) {
  if (!vehicle) return '—';
  const parts = [vehicle.make, vehicle.model].filter(Boolean);
  let label = parts.join(' ').trim();
  if (vehicle.plate) {
    label = label ? `${label} (${vehicle.plate})` : vehicle.plate;
  }
  return label || '—';
}

function BookingMobileCard({ row, onView }) {
  return (
    <div className="border-b border-line-soft py-3 last:border-b-0">
      <button type="button" onClick={onView} className="w-full text-left">
        <div className="text-sm font-semibold text-ink">{row.name}</div>
        <p className="mt-1 text-sm text-ink-muted">{row.phone || '—'}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Дата: {formatPreferredDateTime(row)}
          {row.vehicle ? ` · ${formatVehicleBrief(row.vehicle)}` : ''}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {SOURCE_LABELS[row.source] || row.source || '—'} · {formatServerDateTime(row.created_at)}
        </p>
      </button>
    </div>
  );
}

function BookingViewModal({ booking, onClose, onCreateOrder }) {
  if (!booking) return null;

  return (
    <Modal
      open={Boolean(booking)}
      onClose={onClose}
      title={`Запись · ${booking.name || 'Без имени'}`}
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onCreateOrder(booking)}
            className="rounded-sg-sm min-h-11 border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
          >
            Создать заказ-наряд
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sg-sm min-h-11 border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-muted"
          >
            Закрыть
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-ink-soft">
        <div className="grid gap-3 sm:grid-cols-2">
          <p>
            <span className="font-medium text-ink">Телефон:</span> {booking.phone || '—'}
          </p>
          <p>
            <span className="font-medium text-ink">Желаемая дата и время:</span>{' '}
            {formatPreferredDateTime(booking)}
          </p>
          <p>
            <span className="font-medium text-ink">Создана:</span>{' '}
            {formatServerDateTime(booking.created_at) || '—'}
          </p>
          <p>
            <span className="font-medium text-ink">Источник:</span>{' '}
            {SOURCE_LABELS[booking.source] || booking.source || '—'}
          </p>
          <p className="sm:col-span-2">
            <span className="font-medium text-ink">Автомобиль:</span>{' '}
            {booking.vehicle
              ? formatVehicleBrief(booking.vehicle)
              : [booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(' ') || '—'}
          </p>
        </div>
        <div className="rounded-sg border border-line-soft bg-surface-muted/80 px-3 py-3">
          <p>
            <span className="font-medium text-ink">Комментарий:</span>{' '}
            <span className="whitespace-pre-wrap text-ink-soft">{booking.notes?.trim() || '—'}</span>
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default function AutoserviceInspectionsPage() {
  const { isReady, user, isAuthenticated } = useAuthReady();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');
  const qApplied = useDebouncedValue(q);
  const [addOpen, setAddOpen] = useState(false);
  const [viewBooking, setViewBooking] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = statusFilter !== 'all' ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const data = await apiRequest(`/autoservice/inspection-bookings${qs}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить записи');
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

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/autoservice/inspections') {
        load();
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [load]);

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

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Записи</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {loading
              ? 'Загрузка…'
              : qApplied.trim()
                ? `${filteredRows.length} из ${rows.length}`
                : `${rows.length} записей`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex min-h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 sm:min-h-10"
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
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-ink-muted transition hover:bg-surface-muted hover:text-ink"
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
        <p className="mb-4 rounded-sg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="hidden w-full md:block overflow-x-auto">
        <table className={autoserviceListTableClass}>
          <thead>
            <tr className={autoserviceListTheadRowClass}>
              <th className={`w-36 ${autoserviceListThClass}`}>Дата</th>
              <th className={`min-w-0 ${autoserviceListThClass}`}>Клиент</th>
              <th className={`w-32 ${autoserviceListThClass}`}>Телефон</th>
              <th className={`w-44 ${autoserviceListThClass} hidden lg:table-cell`}>Автомобиль</th>
            </tr>
          </thead>
          <tbody className={autoserviceListTbodyClass}>
            {loading ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-ink-muted">
                  Загрузка…
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-ink-muted">
                  {rows.length === 0 ? 'Записей пока нет' : 'Ничего не найдено'}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className={autoserviceListTrClickableClass}
                  onDoubleClick={() => setViewBooking(row)}
                >
                  <td className={`${autoserviceListTdClass} whitespace-nowrap text-ink-muted`}>
                    {formatPreferredDateTime(row)}
                  </td>
                  <td className={autoserviceListTdClass}>
                    <div className="font-semibold text-ink">{row.name}</div>
                  </td>
                  <td className={`${autoserviceListTdClass} whitespace-nowrap text-ink-muted`}>
                    {row.phone || '—'}
                  </td>
                  <td
                    className={`${autoserviceListTdClass} hidden truncate text-ink-muted lg:table-cell`}
                    title={formatVehicleBrief(row.vehicle)}
                  >
                    {formatVehicleBrief(row.vehicle)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        {loading ? (
          <p className="py-10 text-center text-sm text-ink-muted">Загрузка…</p>
        ) : filteredRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            {rows.length === 0 ? 'Записей пока нет' : 'Ничего не найдено'}
          </p>
        ) : (
          filteredRows.map((row) => (
            <BookingMobileCard
              key={row.id}
              row={row}
              onView={() => setViewBooking(row)}
            />
          ))
        )}
      </div>

      <InspectionBookingAddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Добавить запись"
        onCreated={(row) => {
          setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
        }}
      />

      <BookingViewModal
        booking={viewBooking}
        onClose={() => setViewBooking(null)}
        onCreateOrder={(booking) => {
          setViewBooking(null);
          navigate('/autoservice/orders/new', {
            state: {
              scheduledAtLocal: `${booking.preferred_date}T${booking.preferred_time?.slice(0, 5) || '10:00'}`,
              workZoneId: booking.work_zone_id,
              clientId: booking.client_id,
              vehicleId: booking.garage_vehicle_id,
              clientName: booking.name,
              clientPhone: booking.phone,
              vehicleMake: booking.vehicle_make || booking.vehicle?.make,
              vehicleModel: booking.vehicle_model || booking.vehicle?.model,
              inspectionBookingId: booking.id,
            },
          });
        }}
      />
    </div>
  );
}
