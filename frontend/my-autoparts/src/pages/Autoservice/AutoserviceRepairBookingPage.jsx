import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import MobileFormField from '../../components/MobileFormField/MobileFormField';
import SearchablePillSelect from '../../components/SearchablePillSelect/SearchablePillSelect';
import GarageQuickAddModal from '../../components/Garage/GarageQuickAddModal';
import { UnderlineTabs } from '../../components/UI';
import Toast from '../../components/UI/Toast';
import Modal from '../../components/UI/Modal';
import { apiRequest } from '../../utils/apiClient';
import {
  fetchAutoserviceClientMe,
  selectIsAutoserviceClient,
} from '../../redux/slices/AutoserviceClientSlice';
import { formatGarageVehicleLabel, garageVehicleSearchText } from '../../utils/garageVehicleUi';

const pillControlClass = 'sg-pill-input w-full';

const formTextareaClass = 'sg-pill-textarea w-full';

const btnPrimary =
  'inline-flex min-h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 sm:min-h-10';

const btnGhost =
  'inline-flex min-h-11 items-center justify-center rounded-sg-sm border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition hover:bg-surface-muted sm:min-h-10';

const STATUS_META = {
  new: {
    label: 'В ожидании',
    className: 'bg-warning-50 text-warning-700 ring-warning-100',
  },
  confirmed: {
    label: 'Подтверждена',
    className: 'bg-brand-50 text-brand-700 ring-brand-100',
  },
  processed: {
    label: 'Обработана',
    className: 'bg-success-50 text-success-700 ring-success-100',
  },
  cancelled: {
    label: 'Отменена',
    className: 'bg-surface-subtle text-ink-muted ring-line',
  },
};

function todayIso() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '—';
  const parts = String(value).slice(0, 10).split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatCreatedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || {
    label: status,
    className: 'bg-surface-subtle text-ink-soft ring-line',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

function bookingVehicleLabel(row) {
  const fromVehicle = formatGarageVehicleLabel(row.vehicle);
  if (fromVehicle) return fromVehicle;
  return [row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ') || '';
}

function BookingRow({ row, onOpen }) {
  const vehicleLabel = bookingVehicleLabel(row);
  const note = row.notes || row.comment;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full border-b border-line-soft py-2 text-left last:border-b-0"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium tabular-nums text-ink">
          {formatDate(row.preferred_date)}
          {row.preferred_time ? ` · ${String(row.preferred_time).slice(0, 5)}` : ''}
        </p>
        <StatusBadge status={row.status} />
        {row.organization_name ? (
          <span className="truncate text-xs text-ink-muted">{row.organization_name}</span>
        ) : null}
      </div>
      <p className="mt-0.5 truncate text-ink-soft">{vehicleLabel || 'Без автомобиля'}</p>
      <p className="mt-0.5 truncate text-xs text-ink-muted">
        {note || 'Комментарий не указан'}
      </p>
    </button>
  );
}

function BookingsSkeleton() {
  return (
    <div className="space-y-0" aria-hidden>
      {[1, 2, 3].map((key) => (
        <div key={key} className="animate-pulse border-b border-line-soft py-4 last:border-b-0">
          <div className="h-4 w-28 rounded bg-surface-subtle" />
          <div className="mt-2 h-4 w-48 rounded bg-surface-subtle" />
          <div className="mt-2 h-3 w-full max-w-md rounded bg-surface-subtle" />
        </div>
      ))}
    </div>
  );
}

export default function AutoserviceRepairBookingPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isReady, isAuthenticated } = useAuthReady();
  const user = useSelector((state) => state.auth.user);
  const isClient = useSelector(selectIsAutoserviceClient);
  const clientStatus = useSelector((state) => state.autoserviceClient.status);
  const client = useSelector((state) => state.autoserviceClient.client);

  const defaultName = useMemo(() => {
    if (client?.name) return client.name;
    return [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  }, [client?.name, user?.first_name, user?.last_name]);

  const [tab, setTab] = useState('form');
  const [orgs, setOrgs] = useState([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [preferredDate, setPreferredDate] = useState(todayIso());
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState('');
  const [viewBooking, setViewBooking] = useState(null);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      dispatch(fetchAutoserviceClientMe());
    }
  }, [dispatch, isReady, isAuthenticated]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return undefined;
    let cancelled = false;
    apiRequest('/public/autoservice/organizations')
      .then((data) => {
        if (!cancelled) setOrgs(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setOrgs([]);
      })
      .finally(() => {
        if (!cancelled) setOrgsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isReady, isAuthenticated]);

  useEffect(() => {
    if (selectedOrgId || orgs.length === 0) return;
    const preferred = client?.organization_id;
    const exists = preferred && orgs.some((org) => org.organization_id === preferred);
    setSelectedOrgId(exists ? preferred : orgs[0].organization_id);
  }, [orgs, client?.organization_id, selectedOrgId]);

  useEffect(() => {
    setName(defaultName);
  }, [defaultName]);

  useEffect(() => {
    setPhone(client?.phone || user?.phone || '');
  }, [client?.phone, user?.phone]);

  useEffect(() => {
    if (isReady && isAuthenticated && clientStatus === 'succeeded' && !isClient) {
      navigate('/autoservice/welcome', { replace: true });
    }
  }, [isReady, isAuthenticated, clientStatus, isClient, navigate]);

  useEffect(() => {
    const selectedVehicleId = location.state?.selectedVehicleId;
    if (!selectedVehicleId) return;
    setVehicleId(String(selectedVehicleId));
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state?.selectedVehicleId, navigate]);

  const loadVehicles = useCallback(async (organizationId) => {
    setVehiclesLoading(true);
    try {
      const url = organizationId
        ? `/autoservice/garage/vehicles?organization_id=${encodeURIComponent(organizationId)}`
        : '/autoservice/garage/vehicles';
      const data = await apiRequest(url);
      setVehicles(Array.isArray(data) ? data : []);
    } catch {
      setVehicles([]);
    } finally {
      setVehiclesLoading(false);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    setRowsLoading(true);
    setRowsError('');
    try {
      const data = await apiRequest('/autoservice/inspection-bookings/me');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setRows([]);
      setRowsError(err?.message || 'Не удалось загрузить записи');
    } finally {
      setRowsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated && clientStatus === 'succeeded' && isClient) {
      loadBookings();
    }
  }, [isReady, isAuthenticated, clientStatus, isClient, loadBookings]);

  useEffect(() => {
    if (!isReady || !isAuthenticated || !selectedOrgId) return;
    setVehicleId('');
    loadVehicles(selectedOrgId);
  }, [isReady, isAuthenticated, selectedOrgId, loadVehicles]);

  const vehicleOptions = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        value: String(vehicle.id),
        label: formatGarageVehicleLabel(vehicle),
        searchText: garageVehicleSearchText(vehicle),
      })),
    [vehicles],
  );

  const orgOptions = useMemo(
    () =>
      orgs.map((org) => ({
        value: org.organization_id,
        label: org.name || 'Автосервис',
        hint: [org.address, org.phone].filter(Boolean).join(' · ') || null,
        searchText: `${org.name || ''} ${org.address || ''}`,
      })),
    [orgs],
  );

  const handleVehicleCreated = (vehicle) => {
    if (!vehicle?.id) return;
    setVehicles((prev) => [vehicle, ...prev.filter((item) => item.id !== vehicle.id)]);
    setVehicleId(String(vehicle.id));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!preferredDate) {
      setError('Укажите желаемую дату');
      return;
    }
    if (!selectedOrgId) {
      setError('Выберите автосервис');
      return;
    }
    setSaving(true);
    try {
      const row = await apiRequest('/autoservice/inspection-bookings/me', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: selectedOrgId,
          name: name.trim() || null,
          phone: phone.trim() || null,
          preferred_date: preferredDate,
          notes: comment.trim() || null,
          garage_vehicle_id: vehicleId ? Number(vehicleId) : null,
        }),
      });
      setRows((prev) => [row, ...prev]);
      setComment('');
      setTab('list');
    } catch (err) {
      setError(err?.message || 'Не удалось отправить запись');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = useMemo(() => rows.filter((row) => row.status === 'new').length, [rows]);

  if (!isReady || (isAuthenticated && clientStatus === 'loading')) return <AuthLoadingScreen />;

  const formBlock = (
    <form onSubmit={handleSubmit} className="space-y-5">
      <MobileFormField label="Автосервис" htmlFor="booking-org" required>
        <SearchablePillSelect
          id="booking-org"
          ariaLabel="Автосервис"
          value={selectedOrgId}
          onChange={setSelectedOrgId}
          options={orgOptions}
          loading={orgsLoading}
          disabled={saving}
          placeholder="Выберите автосервис"
        />
      </MobileFormField>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MobileFormField label="Имя" htmlFor="booking-name">
            <input
              id="booking-name"
              className={pillControlClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              disabled={saving}
              placeholder="Как к вам обращаться"
              autoComplete="name"
            />
          </MobileFormField>
          <MobileFormField label="Телефон" htmlFor="booking-phone">
            <input
              id="booking-phone"
              className={pillControlClass}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={40}
              disabled={saving}
              placeholder="+7 …"
              autoComplete="tel"
            />
          </MobileFormField>
        </div>
      </div>

      <div className="space-y-4">
        <MobileFormField label="Автомобиль" htmlFor="booking-vehicle">
          <SearchablePillSelect
            id="booking-vehicle"
            ariaLabel="Автомобиль"
            value={vehicleId}
            onChange={setVehicleId}
            options={vehicleOptions}
            loading={vehiclesLoading}
            disabled={saving}
            placeholder="Найти авто по марке, номеру или VIN"
            emptyOptionLabel="Без автомобиля"
            addOptionLabel="Добавить автомобиль"
            onAddClick={() => setAddVehicleOpen(true)}
          />
        </MobileFormField>
        <MobileFormField label="Желаемая дата" htmlFor="booking-date" required>
          <input
            id="booking-date"
            type="date"
            className={pillControlClass}
            value={preferredDate}
            min={todayIso()}
            onChange={(event) => setPreferredDate(event.target.value)}
            disabled={saving}
          />
        </MobileFormField>
      </div>

      <MobileFormField label="Что нужно сделать" htmlFor="booking-comment">
        <textarea
          id="booking-comment"
          className={formTextareaClass}
          rows={4}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={2000}
          disabled={saving}
          placeholder="Опишите симптомы, работы или пожелания по времени"
        />
      </MobileFormField>

      <Toast message={error} variant="error" onClose={() => setError('')} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={saving} className={`${btnPrimary} w-full sm:w-auto`}>
          {saving ? 'Отправка…' : 'Отправить запись'}
        </button>
        <Link to="/garage/repairs" className={`${btnGhost} w-full sm:w-auto`}>
          История ремонтов
        </Link>
      </div>
    </form>
  );

  const listBlock = (
    <>
      <Toast message={rowsError} variant="error" onClose={() => setRowsError('')} />

      {rowsLoading ? (
        <BookingsSkeleton />
      ) : rows.length === 0 ? (
        <div className="py-12 text-center">
          <h3 className="text-base font-semibold text-ink">Записей пока нет</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
            Заполните форму — запись появится здесь, и мы свяжемся с вами для подтверждения
          </p>
          <button type="button" onClick={() => setTab('form')} className={`${btnPrimary} mt-5`}>
            Создать запись
          </button>
        </div>
      ) : (
        <div>
          {rows.map((row) => (
            <BookingRow key={row.id} row={row} onOpen={() => setViewBooking(row)} />
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Запись на ремонт</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {rowsLoading
              ? 'Загрузка…'
              : activeCount > 0
                ? `${rows.length} записей · ${activeCount} в ожидании`
                : `${rows.length} записей`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/garage" className={btnGhost}>
            Мои авто
          </Link>
          <button
            type="button"
            onClick={loadBookings}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-ink-muted transition hover:bg-surface-muted hover:text-ink"
            title="Обновить"
            aria-label="Обновить"
          >
            <svg
              className={`h-4 w-4 ${rowsLoading ? 'animate-spin' : ''}`}
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
      </div>

      <UnderlineTabs
        className="mb-4 lg:hidden"
        ariaLabel="Разделы записи на ремонт"
        gapClassName="gap-4"
        tabs={[
          { id: 'form', label: 'Новая запись' },
          { id: 'list', label: 'Мои записи' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="lg:grid lg:grid-cols-5 lg:items-start lg:gap-10">
        <section className={`lg:col-span-2 ${tab === 'form' ? 'block' : 'hidden lg:block'}`}>
          <h2 className="mb-4 hidden text-sm font-semibold uppercase tracking-wide text-ink-muted lg:block">
            Новая запись
          </h2>
          {formBlock}
        </section>

        <section className={`mt-2 lg:col-span-3 lg:mt-0 ${tab === 'list' ? 'block' : 'hidden lg:block'}`}>
          <div className="mb-3 hidden items-baseline justify-between gap-3 lg:flex">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Мои записи</h2>
            {!rowsLoading && rows.length > 0 ? (
              <p className="text-sm text-ink-muted">{rows.length}</p>
            ) : null}
          </div>
          {listBlock}
        </section>
      </div>

      {addVehicleOpen ? (
        <GarageQuickAddModal
          onClose={() => setAddVehicleOpen(false)}
          onCreated={handleVehicleCreated}
          organizationId={selectedOrgId || null}
        />
      ) : null}

      <Modal
        open={Boolean(viewBooking)}
        onClose={() => setViewBooking(null)}
        title={
          viewBooking
            ? `запись · ${formatDate(viewBooking.preferred_date)}${viewBooking.preferred_time ? `, ${String(viewBooking.preferred_time).slice(0, 5)}` : ''}`
            : 'запись'
        }
        size="sm"
        draggable
        footer={
          <div className="flex justify-end">
            <button type="button" onClick={() => setViewBooking(null)} className={btnGhost}>
              Закрыть
            </button>
          </div>
        }
      >
        {viewBooking ? (
          <div className="space-y-4 text-sm">
            <div>
              <StatusBadge status={viewBooking.status} />
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Желаемая дата</dt>
                <dd className="mt-1 font-medium text-ink">
                  {formatDate(viewBooking.preferred_date)}
                  {viewBooking.preferred_time ? `, ${String(viewBooking.preferred_time).slice(0, 5)}` : ''}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Автомобиль</dt>
                <dd className="mt-1 font-medium text-ink">
                  {bookingVehicleLabel(viewBooking) || 'Без автомобиля'}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Автосервис</dt>
                <dd className="mt-1 font-medium text-ink">{viewBooking.organization_name || '—'}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Имя</dt>
                <dd className="mt-1 font-medium text-ink">{viewBooking.name || '—'}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Телефон</dt>
                <dd className="mt-1 font-medium text-ink">{viewBooking.phone || '—'}</dd>
              </div>
            </dl>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Комментарий</dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink-soft">
                {(viewBooking.notes || viewBooking.comment || '').trim() || '—'}
              </dd>
            </div>
            {formatCreatedAt(viewBooking.created_at) ? (
              <p className="text-xs text-ink-muted">Создана {formatCreatedAt(viewBooking.created_at)}</p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
