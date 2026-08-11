import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import MobileFormField from '../../components/MobileFormField/MobileFormField';
import SearchablePillSelect from '../../components/SearchablePillSelect/SearchablePillSelect';
import GarageQuickAddModal from '../../components/Garage/GarageQuickAddModal';
import { UnderlineTabs } from '../../components/UI';
import { apiRequest } from '../../utils/apiClient';
import {
  fetchAutoserviceClientMe,
  selectIsAutoserviceClient,
} from '../../redux/slices/AutoserviceClientSlice';
import { formatGarageVehicleLabel, garageVehicleSearchText } from '../../utils/garageVehicleUi';

const pillControlClass =
  'h-10 w-full rounded-full border border-transparent bg-gray-100 px-4 text-sm text-gray-900 shadow-none transition hover:bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

const formTextareaClass =
  'mt-0 block w-full min-h-[96px] resize-y rounded-xl border border-transparent bg-gray-100 px-4 py-3 text-sm text-gray-900 shadow-none transition hover:bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

const btnPrimary =
  'inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60';

const btnGhost =
  'inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50';

const STATUS_META = {
  new: {
    label: 'В ожидании',
    className: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  processed: {
    label: 'Обработана',
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
  cancelled: {
    label: 'Отменена',
    className: 'bg-gray-100 text-gray-600 ring-gray-200',
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
    className: 'bg-gray-100 text-gray-700 ring-gray-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

function BookingRow({ row }) {
  const createdLabel = formatCreatedAt(row.created_at);
  const vehicleLabel = formatGarageVehicleLabel(row.vehicle);
  const note = row.notes || row.comment;

  return (
    <article className="border-b border-gray-100 py-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold tabular-nums text-gray-900">
              {formatDate(row.preferred_date)}
            </p>
            <StatusBadge status={row.status} />
          </div>
          {vehicleLabel ? (
            <p className="mt-1 truncate text-sm font-medium text-gray-800">{vehicleLabel}</p>
          ) : (
            <p className="mt-1 text-sm text-gray-500">Без автомобиля</p>
          )}
          {note ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 line-clamp-3">{note}</p>
          ) : (
            <p className="mt-1 text-sm text-gray-400">Комментарий не указан</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {[createdLabel ? `Создана ${createdLabel}` : null, row.name, row.phone]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>
    </article>
  );
}

function BookingsSkeleton() {
  return (
    <div className="space-y-0" aria-hidden>
      {[1, 2, 3].map((key) => (
        <div key={key} className="animate-pulse border-b border-gray-100 py-4 last:border-b-0">
          <div className="h-4 w-28 rounded bg-gray-100" />
          <div className="mt-2 h-4 w-48 rounded bg-gray-100" />
          <div className="mt-2 h-3 w-full max-w-md rounded bg-gray-100" />
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

  useEffect(() => {
    if (isReady && isAuthenticated) {
      dispatch(fetchAutoserviceClientMe());
    }
  }, [dispatch, isReady, isAuthenticated]);

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

  const loadVehicles = useCallback(async () => {
    setVehiclesLoading(true);
    try {
      const data = await apiRequest('/autoservice/garage/vehicles');
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
      setRowsError(err?.message || 'Не удалось загрузить заявки');
    } finally {
      setRowsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated && clientStatus === 'succeeded' && isClient) {
      loadVehicles();
      loadBookings();
    }
  }, [isReady, isAuthenticated, clientStatus, isClient, loadVehicles, loadBookings]);

  const vehicleOptions = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        value: String(vehicle.id),
        label: formatGarageVehicleLabel(vehicle),
        searchText: garageVehicleSearchText(vehicle),
      })),
    [vehicles],
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
    setSaving(true);
    try {
      const row = await apiRequest('/autoservice/inspection-bookings/me', {
        method: 'POST',
        body: JSON.stringify({
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
      setError(err?.message || 'Не удалось отправить заявку');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = useMemo(() => rows.filter((row) => row.status === 'new').length, [rows]);

  if (!isReady || (isAuthenticated && clientStatus === 'loading')) return <AuthLoadingScreen />;

  const formBlock = (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Контакты</p>
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
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Авто и дата</p>
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

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={saving} className={`${btnPrimary} w-full sm:w-auto`}>
          {saving ? 'Отправка…' : 'Отправить заявку'}
        </button>
        <Link to="/garage/repairs" className={`${btnGhost} w-full sm:w-auto`}>
          История ремонтов
        </Link>
      </div>
    </form>
  );

  const listBlock = (
    <>
      {rowsError ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {rowsError}
        </p>
      ) : null}

      {rowsLoading ? (
        <BookingsSkeleton />
      ) : rows.length === 0 ? (
        <div className="py-12 text-center">
          <h3 className="text-base font-semibold text-gray-900">Заявок пока нет</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
            Заполните форму — заявка появится здесь, и мы свяжемся с вами для подтверждения
          </p>
          <button type="button" onClick={() => setTab('form')} className={`${btnPrimary} mt-5`}>
            Создать заявку
          </button>
        </div>
      ) : (
        <div>
          {rows.map((row) => (
            <BookingRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Запись на ремонт</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {rowsLoading
              ? 'Загрузка…'
              : activeCount > 0
                ? `${rows.length} заявок · ${activeCount} в ожидании`
                : `${rows.length} заявок`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/garage" className={btnGhost}>
            Мои авто
          </Link>
          <button
            type="button"
            onClick={loadBookings}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
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
          { id: 'form', label: 'Новая заявка' },
          { id: 'list', label: 'Мои заявки' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="lg:grid lg:grid-cols-5 lg:items-start lg:gap-10">
        <section className={`lg:col-span-2 ${tab === 'form' ? 'block' : 'hidden lg:block'}`}>
          <h2 className="mb-4 hidden text-sm font-semibold uppercase tracking-wide text-gray-500 lg:block">
            Новая заявка
          </h2>
          {formBlock}
        </section>

        <section className={`mt-2 lg:col-span-3 lg:mt-0 ${tab === 'list' ? 'block' : 'hidden lg:block'}`}>
          <div className="mb-3 hidden items-baseline justify-between gap-3 lg:flex">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Мои заявки</h2>
            {!rowsLoading && rows.length > 0 ? (
              <p className="text-sm text-gray-500">{rows.length}</p>
            ) : null}
          </div>
          {listBlock}
        </section>
      </div>

      {addVehicleOpen ? (
        <GarageQuickAddModal onClose={() => setAddVehicleOpen(false)} onCreated={handleVehicleCreated} />
      ) : null}
    </div>
  );
}
