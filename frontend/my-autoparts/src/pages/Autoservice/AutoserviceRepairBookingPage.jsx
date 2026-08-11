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
  'h-10 w-full rounded-full border border-transparent bg-white/90 px-4 text-sm text-gray-900 shadow-none ring-1 ring-gray-200/70 transition hover:bg-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 disabled:cursor-not-allowed disabled:opacity-60';

const formTextareaClass =
  'mt-0 block w-full min-h-[108px] resize-y rounded-2xl border border-transparent bg-white/90 px-4 py-3 text-sm text-gray-900 shadow-none ring-1 ring-gray-200/70 transition hover:bg-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 disabled:cursor-not-allowed disabled:opacity-60';

const btnPrimary =
  'inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-600/20 disabled:opacity-60';

const btnGhost =
  'inline-flex h-11 items-center justify-center rounded-xl border border-gray-300/80 bg-white/80 px-4 text-sm font-medium text-gray-700 backdrop-blur transition hover:bg-white';

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

function addDaysIso(days) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '—';
  const parts = String(value).slice(0, 10).split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatDateShort(value) {
  if (!value) return { day: '—', month: '' };
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { day: '—', month: '' };
  return {
    day: date.toLocaleDateString('ru-RU', { day: 'numeric' }),
    month: date.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', ''),
  };
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.className}`}
    >
      {status === 'new' ? (
        <span className="repair-booking-pending-dot h-1.5 w-1.5 rounded-full bg-amber-500" />
      ) : null}
      {meta.label}
    </span>
  );
}

function StepLabel({ index, title, hint }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
        {index}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {hint ? <p className="mt-0.5 text-xs text-gray-500">{hint}</p> : null}
      </div>
    </div>
  );
}

function BookingRow({ row }) {
  const createdLabel = formatCreatedAt(row.created_at);
  const vehicleLabel = formatGarageVehicleLabel(row.vehicle);
  const note = row.notes || row.comment;
  const dateParts = formatDateShort(row.preferred_date);

  return (
    <article
      data-status={row.status}
      className="repair-booking-timeline-item repair-booking-enter border-b border-gray-100/80 py-4 last:border-b-0"
    >
      <div className="flex gap-3">
        <div className="flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-900 text-white">
          <span className="text-lg font-bold leading-none tabular-nums">{dateParts.day}</span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
            {dateParts.month}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{formatDate(row.preferred_date)}</p>
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
            <p className="mt-1 text-sm text-gray-400">Без комментария</p>
          )}
          <p className="mt-1.5 text-xs text-gray-500">
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
          <div className="flex gap-3">
            <div className="h-14 w-12 rounded-xl bg-gray-100" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-28 rounded bg-gray-100" />
              <div className="h-4 w-48 rounded bg-gray-100" />
              <div className="h-3 w-full max-w-md rounded bg-gray-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const DATE_CHIPS = [
  { id: 'today', label: 'Сегодня', value: () => todayIso() },
  { id: 'tomorrow', label: 'Завтра', value: () => addDaysIso(1) },
  { id: 'week', label: 'Через неделю', value: () => addDaysIso(7) },
];

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
  const [successFlash, setSuccessFlash] = useState(false);
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

  useEffect(() => {
    if (!successFlash) return undefined;
    const timer = window.setTimeout(() => setSuccessFlash(false), 3500);
    return () => window.clearTimeout(timer);
  }, [successFlash]);

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
      setSuccessFlash(true);
      setTab('list');
    } catch (err) {
      setError(err?.message || 'Не удалось отправить заявку');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = useMemo(() => rows.filter((row) => row.status === 'new').length, [rows]);
  const selectedVehicle = useMemo(
    () => vehicles.find((v) => String(v.id) === String(vehicleId)) || null,
    [vehicles, vehicleId],
  );

  if (!isReady || (isAuthenticated && clientStatus === 'loading')) return <AuthLoadingScreen />;

  const formBlock = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="repair-booking-enter repair-booking-enter-delay-1 space-y-4">
        <StepLabel index={1} title="Контакты" hint="Как с вами связаться" />
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

      <div className="repair-booking-enter repair-booking-enter-delay-2 space-y-4">
        <StepLabel index={2} title="Авто и дата" hint="Когда удобно приехать" />
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
        {selectedVehicle ? (
          <p className="rounded-xl bg-indigo-50/80 px-3 py-2 text-xs text-indigo-900">
            Выбрано: <span className="font-semibold">{formatGarageVehicleLabel(selectedVehicle)}</span>
          </p>
        ) : null}
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
        <div className="flex flex-wrap gap-2">
          {DATE_CHIPS.map((chip) => {
            const value = chip.value();
            const active = preferredDate === value;
            return (
              <button
                key={chip.id}
                type="button"
                disabled={saving}
                onClick={() => setPreferredDate(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="repair-booking-enter repair-booking-enter-delay-3 space-y-4">
        <StepLabel index={3} title="Что сделать" hint="Коротко опишите задачу" />
        <MobileFormField label="Комментарий" htmlFor="booking-comment">
          <textarea
            id="booking-comment"
            className={formTextareaClass}
            rows={4}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={2000}
            disabled={saving}
            placeholder="Например: стук при торможении, замена колодок, диагностика подвески…"
          />
        </MobileFormField>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
    <div key={tab} className="repair-booking-enter">
      {successFlash ? (
        <div
          className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          Заявка отправлена. Мы свяжемся с вами для подтверждения времени.
        </div>
      ) : null}

      {rowsError ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {rowsError}
        </p>
      ) : null}

      {rowsLoading ? (
        <BookingsSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/40 px-5 py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">Пока тихо</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
            Оставьте первую заявку — она появится здесь, а сервис подтвердит удобное время.
          </p>
          <button type="button" onClick={() => setTab('form')} className={`${btnPrimary} mt-5`}>
            Записаться
          </button>
        </div>
      ) : (
        <div>
          {rows.map((row) => (
            <BookingRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full min-w-0">
      <section className="repair-booking-hero repair-booking-enter mb-6 px-5 py-6 sm:px-7 sm:py-8">
        <div className="relative z-[1] flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700/80">
              Автосервис
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Запись на ремонт
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
              Выберите авто и удобный день — мастерская перезвонит и подтвердит визит.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-white/70 px-3 py-1 ring-1 ring-slate-200/80">
                {rowsLoading ? '…' : `${rows.length} заявок`}
              </span>
              {activeCount > 0 ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800 ring-1 ring-amber-200/80">
                  {activeCount} в ожидании
                </span>
              ) : null}
              {vehicles.length > 0 ? (
                <span className="rounded-full bg-white/70 px-3 py-1 ring-1 ring-slate-200/80">
                  {vehicles.length} авто в гараже
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/garage" className={btnGhost}>
              Мои авто
            </Link>
            <button
              type="button"
              onClick={() => setTab('form')}
              className={`${btnPrimary} hidden sm:inline-flex lg:hidden`}
            >
              Новая заявка
            </button>
            <button
              type="button"
              onClick={loadBookings}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 text-gray-600 ring-1 ring-gray-200/80 transition hover:bg-white hover:text-gray-900"
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
      </section>

      <UnderlineTabs
        className="mb-5 lg:hidden"
        ariaLabel="Разделы записи на ремонт"
        gapClassName="gap-4"
        tabs={[
          { id: 'form', label: 'Новая заявка' },
          { id: 'list', label: 'Мои заявки' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-10">
        <section
          className={`lg:col-span-5 ${tab === 'form' ? 'block' : 'hidden lg:block'}`}
        >
          <div className="rounded-2xl bg-white/60 p-1 ring-1 ring-slate-200/70 backdrop-blur-sm lg:sticky lg:top-4">
            <div className="rounded-[0.9rem] bg-gradient-to-b from-white to-slate-50/80 px-4 py-5 sm:px-5">
              <div className="mb-5 hidden lg:block">
                <h2 className="text-lg font-semibold text-slate-900">Новая заявка</h2>
                <p className="mt-1 text-sm text-slate-500">Три шага — и мы на связи</p>
              </div>
              {formBlock}
            </div>
          </div>
        </section>

        <section className={`mt-6 lg:col-span-7 lg:mt-0 ${tab === 'list' ? 'block' : 'hidden lg:block'}`}>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Мои заявки</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {rowsLoading ? 'Загрузка…' : 'Статус и желаемые даты'}
              </p>
            </div>
            {!rowsLoading && rows.length > 0 ? (
              <p className="text-sm tabular-nums text-slate-500">{rows.length}</p>
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
