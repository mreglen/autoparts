import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import MobileFormField from '../../components/MobileFormField/MobileFormField';
import SearchablePillSelect from '../../components/SearchablePillSelect/SearchablePillSelect';
import GarageQuickAddModal from '../../components/Garage/GarageQuickAddModal';
import { apiRequest } from '../../utils/apiClient';
import { selectIsAutoserviceClient } from '../../redux/slices/AutoserviceClientSlice';
import { formatGarageVehicleLabel, garageVehicleSearchText } from '../../utils/garageVehicleUi';
import {
  warehouseEmptyShellClass,
  warehousePageClass,
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseSecondaryButtonClass,
} from '../../utils/warehouseListUi';

const formInputClass = `${warehousePillControlClass} mt-0`;
const formTextareaClass =
  'mt-0 block w-full min-h-[96px] resize-y rounded-xl border border-transparent bg-gray-100 px-4 py-3 text-sm text-gray-900 shadow-none transition hover:bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

const STATUS_META = {
  new: {
    label: 'Новая',
    className: 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100',
  },
  processed: {
    label: 'Обработана',
    className: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100',
  },
  cancelled: {
    label: 'Отменена',
    className: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
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

function formatVehicleBrief(vehicle) {
  if (!vehicle) return null;
  return formatGarageVehicleLabel(vehicle);
}

function BookingCard({ row }) {
  const statusMeta = STATUS_META[row.status] || {
    label: row.status,
    className: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200',
  };
  const createdLabel = formatCreatedAt(row.created_at);
  const vehicleLabel = formatVehicleBrief(row.vehicle);

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition-shadow hover:shadow">
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-800 ring-1 ring-gray-200">
                Заявка · #{row.id}
              </span>
              {createdLabel && <span className="text-sm text-gray-500">{createdLabel}</span>}
            </div>

            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="text-lg font-bold tabular-nums text-gray-900">{formatDate(row.preferred_date)}</p>
                <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gray-500">Желаемая дата</p>
              </div>
              {vehicleLabel ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{vehicleLabel}</p>
                  <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gray-500">Автомобиль</p>
                </div>
              ) : null}
            </div>

            {row.comment ? (
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{row.comment}</p>
            ) : (
              <p className="text-sm text-gray-400">Комментарий не указан</p>
            )}

            {(row.name || row.phone) && (
              <p className="text-xs text-gray-500">
                {[row.name, row.phone].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          <span
            className={`inline-flex shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}
          >
            {statusMeta.label}
          </span>
        </div>
      </div>
    </article>
  );
}

function BookingsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[1, 2].map((key) => (
        <div key={key} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="h-6 w-32 rounded-full bg-gray-100" />
              <div className="h-7 w-28 rounded-lg bg-gray-100" />
              <div className="h-4 w-full max-w-md rounded bg-gray-100" />
            </div>
            <div className="h-6 w-20 rounded-full bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AutoserviceRepairBookingPage() {
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
    try {
      const data = await apiRequest('/autoservice/repair-bookings/me');
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated && isClient) {
      loadVehicles();
      loadBookings();
    }
  }, [isReady, isAuthenticated, isClient, loadVehicles, loadBookings]);

  const vehicleOptions = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        value: String(vehicle.id),
        label: formatGarageVehicleLabel(vehicle),
        searchText: garageVehicleSearchText(vehicle),
      })),
    [vehicles]
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
      const row = await apiRequest('/autoservice/repair-bookings', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || null,
          phone: phone.trim() || null,
          preferred_date: preferredDate,
          comment: comment.trim() || null,
          garage_vehicle_id: vehicleId ? Number(vehicleId) : null,
        }),
      });
      setRows((prev) => [row, ...prev]);
      setComment('');
    } catch (err) {
      setError(err?.message || 'Не удалось отправить заявку');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = useMemo(
    () => rows.filter((row) => row.status === 'new').length,
    [rows]
  );

  if (!isReady) return <AuthLoadingScreen />;

  return (
    <div className={`${warehousePageClass} mx-auto max-w-5xl`}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Запись на ремонт</h1>
     
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {!rowsLoading && rows.length > 0 && (
            <div className="mr-1 hidden items-center gap-4 text-right sm:flex">
              <div>
                <div className="text-base font-bold tabular-nums text-gray-900 leading-tight">{rows.length}</div>
                <div className="text-[11px] text-gray-500">Заявок</div>
              </div>
              {activeCount > 0 && (
                <div>
                  <div className="text-base font-bold tabular-nums text-indigo-600 leading-tight">{activeCount}</div>
                  <div className="text-[11px] text-gray-500">В ожидании</div>
                </div>
              )}
            </div>
          )}
          <Link to="/garage" className={warehouseSecondaryButtonClass}>
            Мои авто
          </Link>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-5 lg:items-start lg:gap-8">
        <section className="lg:col-span-2 lg:sticky lg:top-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <h2 className="text-base font-semibold text-gray-900">Новая заявка</h2>
            <p className="mt-1 text-sm text-gray-500">Контакты, автомобиль и описание работ</p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <div className="space-y-4 rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Контакты</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <MobileFormField label="Имя" htmlFor="booking-name">
                    <input
                      id="booking-name"
                      className={formInputClass}
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
                      className={formInputClass}
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

              <div className="space-y-4 rounded-xl bg-gray-50 p-4">
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
                    className={formInputClass}
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

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <button type="submit" disabled={saving} className={`${warehousePrimaryButtonClass} w-full`}>
                  {saving ? 'Отправка…' : 'Отправить заявку'}
                </button>
                <Link to="/garage/repairs" className={`${warehouseSecondaryButtonClass} w-full text-center`}>
                  История ремонтов
                </Link>
              </div>
            </form>
          </div>
        </section>

        <section className="mt-8 lg:col-span-3 lg:mt-0">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Мои заявки</h2>
            {!rowsLoading && rows.length > 0 && (
              <p className="mt-0.5 text-sm text-gray-500">
                {rows.length} {rows.length === 1 ? 'заявка' : rows.length < 5 ? 'заявки' : 'заявок'}
              </p>
            )}
          </div>

          {rowsLoading ? (
            <BookingsSkeleton />
          ) : rows.length === 0 ? (
            <div className={warehouseEmptyShellClass}>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900">Заявок пока нет</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
                Заполните форму слева — заявка появится здесь, и мы свяжемся с вами для подтверждения
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((row) => (
                <BookingCard key={row.id} row={row} />
              ))}
            </div>
          )}
        </section>
      </div>

      {addVehicleOpen ? (
        <GarageQuickAddModal
          onClose={() => setAddVehicleOpen(false)}
          onCreated={handleVehicleCreated}
        />
      ) : null}
    </div>
  );
}
