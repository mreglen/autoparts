import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import { useDebouncedValue } from '../../hooks/useDebouncedCallback';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import Modal from '../../components/UI/Modal';
import { UnderlineTabs } from '../../components/UI';
import RepairOrderViewModal, {
  OrderStatusBadge,
  vehicleLabel,
} from '../../components/Autoservice/RepairOrderViewModal';
import { apiRequest } from '../../utils/apiClient';
import AutoserviceClientRequisitesFields from '../../components/Autoservice/AutoserviceClientRequisitesFields';
import { handlePhoneInputChange, validatePhone, validateEmail } from '../../utils/contactValidation';
import { formatServerDate, formatServerDateTime } from '../../utils/serverDate';
import { normalizeVinOrNull, sanitizeVinInput, VIN_INPUT_MAX_LENGTH } from '../../utils/laximoVin';
import {
  clientRequisitesChanged,
  emptyClientRequisites,
  isGuestClient,
  personTypeLabel,
  saveAutoserviceClientRequisites,
  createAutoserviceClientAccount,
  validateInn,
} from '../../utils/autoserviceClientRequisites';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

function AccountBadge({ userId }) {
  if (userId) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
        Есть
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
      Гость
    </span>
  );
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hiddenMatchHint(client, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return null;

  const hiddenFields = [
    { label: 'Email', value: client?.email },
    { label: 'Наименование', value: client?.legal_name },
    { label: 'ИНН', value: client?.inn },
    { label: 'КПП', value: client?.kpp },
    { label: client?.person_type === 'legal' ? 'Юр. адрес' : 'Адрес', value: client?.address },
    { label: client?.person_type === 'ie' ? 'ОГРНИП' : 'ОГРН', value: client?.ogrn },
  ];

  for (const field of hiddenFields) {
    const raw = String(field.value || '').trim();
    if (!raw) continue;
    if (normalizeSearchText(raw).includes(normalizedQuery)) {
      return `${field.label}: ${raw}`;
    }
  }
  return null;
}

function VehicleList({
  vehicles,
  loading,
  canEdit = false,
  onEdit,
  onVinClick,
  onShowVehicleOrders,
  ordersByVehicle = {},
}) {
  if (loading) {
    return <p className="text-sm text-gray-500">Загрузка автомобилей…</p>;
  }
  if (!vehicles?.length) {
    return <p className="text-sm text-gray-500">Автомобилей нет</p>;
  }
  return (
    <ul className="space-y-2">
      {vehicles.map((v) => (
        <li key={v.id} className="rounded-lg border border-gray-100 p-3 text-sm text-gray-700">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
            <span className="font-medium text-gray-900">
              {v.make} {v.model}
              {v.year ? `, ${v.year}` : ''}
            </span>
            {v.vin ? (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVinClick?.(v.vin);
                  }}
                  className="font-mono text-indigo-600 underline decoration-indigo-300 underline-offset-2 transition hover:text-indigo-800 hover:decoration-indigo-600"
                  title="Открыть VIN-каталог"
                >
                  VIN {v.vin}
                </button>
              </>
            ) : null}
              {v.plate ? ` · ${v.plate}` : ''}
              {v.color ? ` · ${v.color}` : ''}
              <div className="mt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowVehicleOrders?.(v);
                  }}
                  className="text-sm font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 transition hover:text-indigo-800 hover:decoration-indigo-600"
                >
                  Заказ-наряды
                </button>
              </div>
            </div>
            {canEdit ? (
              <button
                type="button"
                onClick={() => onEdit?.(v)}
                className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
              >
                Изменить
              </button>
            ) : null}
          </div>

          {ordersByVehicle[v.id]?.length ? (
            <div className="mt-3 border-t border-gray-100 pt-2">
              <p className="mb-1 text-xs font-medium text-gray-500">Заказ-наряды по этому авто</p>
              <ul className="space-y-1">
                {ordersByVehicle[v.id].map((order) => (
                  <li key={order.id} className="text-xs text-gray-700">
                    №{order.order_number || order.id} · {formatServerDateTime(order.scheduled_at || order.created_at) || '—'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ProfileValue({ value }) {
  const text = String(value || '').trim();
  if (!text) {
    return <span className="text-gray-400">не указано</span>;
  }
  return text;
}

function ClientProfileFields({ client }) {
  const type = client?.person_type || 'individual';
  const rows = [
    ['Телефон', client?.phone],
    ['Email', client?.email],
    ['Тип', personTypeLabel(type)],
  ];
  if (type === 'legal') {
    rows.push(['Наименование', client?.legal_name]);
  }
  if (type === 'ie') {
    rows.push(['Наименование ИП', client?.legal_name]);
  }
  rows.push([type === 'legal' ? 'Юридический адрес' : 'Адрес', client?.address]);
  rows.push(['ИНН', client?.inn]);
  if (type === 'legal') {
    rows.push(['КПП', client?.kpp]);
    rows.push(['ОГРН', client?.ogrn]);
  }
  if (type === 'ie') {
    rows.push(['ОГРНИП', client?.ogrn]);
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className={label.includes('адрес') || label.includes('Адрес') ? 'sm:col-span-2' : ''}>
          <dt className="text-xs font-medium text-gray-500">{label}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-900">
            <ProfileValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

const BOOKING_STATUS_LABELS = {
  new: 'В ожидании',
  processed: 'Обработано',
  cancelled: 'Отменена',
};

const BOOKING_STATUS_STYLES = {
  new: 'bg-amber-50 text-amber-800 ring-amber-200',
  processed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-200',
};

const BOOKING_SOURCE_LABELS = {
  site: 'Сайт',
  staff: 'Сотрудник',
  client: 'Клиент',
};

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BookingStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        BOOKING_STATUS_STYLES[status] || BOOKING_STATUS_STYLES.new
      }`}
    >
      {BOOKING_STATUS_LABELS[status] || status}
    </span>
  );
}

function ClientHistoryList({ loading, empty, children }) {
  if (loading) {
    return <p className="text-sm text-gray-500">Загрузка…</p>;
  }
  if (!children) {
    return <p className="text-sm text-gray-500">{empty}</p>;
  }
  return <ul className="divide-y divide-gray-100">{children}</ul>;
}

function ClientOrderRow({ row, onOpen }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(row)}
        className="flex w-full items-start justify-between gap-3 py-2.5 text-left transition hover:bg-gray-50/80"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">
            Заказ-наряд №{row.order_number || row.id}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatServerDateTime(row.scheduled_at || row.created_at) || '—'}
            {row.vehicle ? ` · ${vehicleLabel(row.vehicle)}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <OrderStatusBadge status={row.status} />
          <p className="mt-1 text-xs tabular-nums text-gray-600">
            {formatMoney(row.grand_total)} ₽
          </p>
        </div>
      </button>
    </li>
  );
}

function ClientBookingRow({ row, onOpen }) {
  const vehicle = row.vehicle
    ? [row.vehicle.make, row.vehicle.model, row.vehicle.plate].filter(Boolean).join(' ')
    : '';
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(row)}
        className="flex w-full items-start justify-between gap-3 py-2.5 text-left transition hover:bg-gray-50/80"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {formatServerDate(row.preferred_date) || 'Запись'}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {BOOKING_SOURCE_LABELS[row.source] || row.source || '—'}
            {vehicle ? ` · ${vehicle}` : ''}
          </p>
        </div>
        <BookingStatusBadge status={row.status} />
      </button>
    </li>
  );
}

function ClientBookingViewModal({ booking, onClose }) {
  if (!booking) return null;
  const vehicle = booking.vehicle
    ? [booking.vehicle.make, booking.vehicle.model, booking.vehicle.year, booking.vehicle.plate]
        .filter(Boolean)
        .join(' ')
    : '';
  return (
    <Modal
      open={Boolean(booking)}
      onClose={onClose}
      title={`Запись · ${formatServerDate(booking.preferred_date) || booking.name || ''}`}
      size="md"
      wrapperClassName="z-[120]"
      footer={
        <div className="flex justify-end">
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
        <div className="flex flex-wrap items-center gap-2">
          <BookingStatusBadge status={booking.status} />
          <span className="text-xs text-gray-500">
            {BOOKING_SOURCE_LABELS[booking.source] || booking.source || '—'}
          </span>
        </div>
        <p>
          <span className="font-medium text-gray-900">Имя:</span> {booking.name || '—'}
        </p>
        <p>
          <span className="font-medium text-gray-900">Телефон:</span> {booking.phone || '—'}
        </p>
        <p>
          <span className="font-medium text-gray-900">Желаемая дата:</span>{' '}
          {formatServerDate(booking.preferred_date) || '—'}
        </p>
        <p>
          <span className="font-medium text-gray-900">Автомобиль:</span> {vehicle || '—'}
        </p>
        <p>
          <span className="font-medium text-gray-900">Создана:</span>{' '}
          {formatServerDateTime(booking.created_at) || '—'}
        </p>
        <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3">
          <p>
            <span className="font-medium text-gray-900">Комментарий:</span>{' '}
            <span className="whitespace-pre-wrap">{booking.notes?.trim() || '—'}</span>
          </p>
        </div>
      </div>
    </Modal>
  );
}

function ClientProfileModal({
  open,
  client,
  vehicles,
  loading,
  onClose,
  onEditVehicle,
  onAddVehicle,
  onVinClick,
  onSaved,
}) {
  const navigate = useNavigate();
  const isGuest = isGuestClient(client);
  const clientId = client?.id;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyClientRequisites(client));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState('profile');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);
  const [viewBooking, setViewBooking] = useState(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [vehicleOrderFilterId, setVehicleOrderFilterId] = useState(null);

  const guestEmail = String((editing ? form.email : client?.email) || '').trim();
  const canCreateAccount = isGuest && guestEmail && !validateEmail(guestEmail);

  useEffect(() => {
    setEditing(false);
    setForm(emptyClientRequisites(client));
    setError('');
    setSaving(false);
    setSection('profile');
    setOrders([]);
    setBookings([]);
    setViewOrder(null);
    setViewBooking(null);
    setCreatingAccount(false);
    setAccountMessage('');
    setVehicleOrderFilterId(null);
  }, [open, clientId]);

  useEffect(() => {
    if (!open || !clientId) return undefined;
    let cancelled = false;
    (async () => {
      setOrdersLoading(true);
      try {
        const data = await apiRequest(
          `/autoservice/repair-orders?scope=all&client_id=${encodeURIComponent(clientId)}`,
        );
        if (!cancelled) setOrders(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, clientId]);

  useEffect(() => {
    if (!open || !clientId) return undefined;
    let cancelled = false;
    (async () => {
      setBookingsLoading(true);
      try {
        const data = await apiRequest(
          `/autoservice/inspection-bookings?client_id=${encodeURIComponent(clientId)}`,
        );
        if (!cancelled) setBookings(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setBookings([]);
      } finally {
        if (!cancelled) setBookingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, clientId]);

  const handleClose = () => {
    if (saving) return;
    setEditing(false);
    setAccountMessage('');
    onClose?.();
  };

  const startEditing = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setSection('profile');
    setForm(emptyClientRequisites(client));
    setError('');
    setAccountMessage('');
    setEditing(true);
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!client?.id) return;
    setError('');
    if (isGuest) {
      if (String(form.name || '').trim().length < 2) {
        setError('Укажите ФИО');
        return;
      }
      const phoneErr = validatePhone(form.phone);
      if (phoneErr) {
        setError(phoneErr);
        return;
      }
    }
    const email = String(form.email || '').trim();
    if (email) {
      const emailErr = validateEmail(email);
      if (emailErr) {
        setError(emailErr);
        return;
      }
    }
    const innErr = validateInn(form.inn);
    if (innErr) {
      setError(innErr);
      return;
    }
    if (!clientRequisitesChanged(form, emptyClientRequisites(client))) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await saveAutoserviceClientRequisites(client.id, form, { isGuest });
      onSaved?.(updated);
      setForm(emptyClientRequisites(updated));
      setEditing(false);
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить клиента');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!client?.id || !canCreateAccount) return;
    const email = guestEmail;
    if (
      !window.confirm(
        `Создать личный кабинет и отправить пароль на ${email}?\n\nКлиент сможет входить на сайт и видеть свои заказ-наряды и записи.`,
      )
    ) {
      return;
    }

    setError('');
    setAccountMessage('');
    setCreatingAccount(true);
    try {
      if (editing && clientRequisitesChanged(form, emptyClientRequisites(client))) {
        const saved = await saveAutoserviceClientRequisites(client.id, form, { isGuest });
        onSaved?.(saved);
        setForm(emptyClientRequisites(saved));
      }
      const result = await createAutoserviceClientAccount(client.id);
      onSaved?.(result.client);
      setForm(emptyClientRequisites(result.client));
      setEditing(false);
      setAccountMessage(
        result.email_sent
          ? `Аккаунт создан. Пароль отправлен на ${result.email}.`
          : `Аккаунт создан, но письмо на ${result.email} не удалось отправить.`,
      );
    } catch (err) {
      setError(err?.message || 'Не удалось создать аккаунт');
    } finally {
      setCreatingAccount(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Профиль' },
    { id: 'vehicles', label: 'Автомобили', count: loading ? undefined : vehicles.length },
    { id: 'orders', label: 'Заказ-наряды', count: ordersLoading ? undefined : orders.length },
    { id: 'bookings', label: 'Записи', count: bookingsLoading ? undefined : bookings.length },
  ];
  const filteredOrders = vehicleOrderFilterId ? orders.filter((row) => row.vehicle_id === vehicleOrderFilterId) : orders;
  const filteredVehicle = vehicleOrderFilterId
    ? vehicles.find((v) => v.id === vehicleOrderFilterId)
    : null;
  const filteredVehicleLabel = filteredVehicle
    ? [filteredVehicle.make, filteredVehicle.model].filter(Boolean).join(' ')
    : '';
  const ordersByVehicle = orders.reduce((acc, row) => {
    if (!row?.vehicle_id) return acc;
    if (!acc[row.vehicle_id]) acc[row.vehicle_id] = [];
    acc[row.vehicle_id].push(row);
    return acc;
  }, {});

  return (
    <>
    <Modal
      open={open}
      onClose={handleClose}
      title={client ? client.name : 'Клиент'}
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {canCreateAccount && (section === 'profile' || editing) ? (
            <button
              type="button"
              onClick={handleCreateAccount}
              disabled={saving || creatingAccount}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60"
            >
              {creatingAccount ? 'Создание…' : 'Создать аккаунт'}
            </button>
          ) : null}
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setForm(emptyClientRequisites(client));
                  setError('');
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Закрыть
              </button>
              {section === 'profile' ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={startEditing}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Редактировать
                </button>
              ) : null}
            </>
          )}
        </div>
      }
    >
      {client ? (
        <div className="space-y-5">
          {editing ? null : (
            <UnderlineTabs
              tabs={tabs}
              value={section}
              onChange={setSection}
              ariaLabel="Разделы карточки клиента"
            />
          )}

          {section === 'profile' || editing ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <AccountBadge userId={client.user_id} />
                {isGuest ? (
                  <p className="text-xs text-gray-500">
                    Гость — можно менять ФИО, телефон и автомобили.
                    {canCreateAccount ? ' Email указан — можно создать личный кабинет.' : ''}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">
                    ФИО и телефон берутся из аккаунта.
                  </p>
                )}
              </div>

              {editing ? (
                <form id="edit-autoservice-client" onSubmit={handleSave} className="space-y-3">
                  <AutoserviceClientRequisitesFields
                    form={form}
                    onChange={setForm}
                    isGuest={isGuest}
                    disabled={saving}
                    idPrefix="client-card"
                  />
                  {error ? <p className="text-sm text-red-600">{error}</p> : null}
                  {accountMessage ? <p className="text-sm text-emerald-700">{accountMessage}</p> : null}
                </form>
              ) : (
                <ClientProfileFields client={client} />
              )}

              {!editing && accountMessage ? (
                <p className="text-sm text-emerald-700">{accountMessage}</p>
              ) : null}

            </>
          ) : null}

          {section === 'vehicles' && !editing ? (
            <div className="space-y-3">
              {isGuest ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onAddVehicle}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    Добавить авто
                  </button>
                </div>
              ) : null}
              <VehicleList
                vehicles={vehicles}
                loading={loading}
                canEdit={isGuest}
                onEdit={onEditVehicle}
                onVinClick={onVinClick}
                onShowVehicleOrders={(vehicle) => {
                  setVehicleOrderFilterId(vehicle.id);
                  setSection('orders');
                }}
                ordersByVehicle={ordersByVehicle}
              />
            </div>
          ) : null}

          {section === 'orders' && !editing ? (
            <div className="space-y-3">
              {vehicleOrderFilterId && filteredVehicleLabel ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800 ring-1 ring-inset ring-indigo-200">
                    Фильтр: авто {filteredVehicleLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => setVehicleOrderFilterId(null)}
                    className="text-xs font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 transition hover:text-indigo-800 hover:decoration-indigo-600"
                  >
                    Сбросить фильтр
                  </button>
                </div>
              ) : null}
              <ClientHistoryList
                loading={ordersLoading}
                empty={vehicleOrderFilterId ? 'Нет заказ-нарядов по этому авто' : 'Заказ-нарядов нет'}
              >
                {filteredOrders.length
                  ? filteredOrders.map((row) => (
                      <ClientOrderRow key={row.id} row={row} onOpen={setViewOrder} />
                    ))
                  : null}
              </ClientHistoryList>
            </div>
          ) : null}

          {section === 'bookings' && !editing ? (
            <ClientHistoryList loading={bookingsLoading} empty="Записей нет">
              {bookings.length
                ? bookings.map((row) => (
                    <ClientBookingRow key={row.id} row={row} onOpen={setViewBooking} />
                  ))
                : null}
            </ClientHistoryList>
          ) : null}
        </div>
      ) : null}
    </Modal>
    <RepairOrderViewModal
      order={viewOrder}
      enablePayment
      onClose={() => setViewOrder(null)}
      onOrderChange={(updated) => {
        setViewOrder(updated);
        setOrders((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
      }}
      onEdit={(order) => {
        setViewOrder(null);
        handleClose();
        navigate(`/autoservice/orders/${order.id}/edit`);
      }}
    />
    <ClientBookingViewModal booking={viewBooking} onClose={() => setViewBooking(null)} />
    </>
  );
}

function EditGuestVehicleModal({ open, vehicle, onClose, onSaved }) {
  const [form, setForm] = useState({
    vin: '',
    make: '',
    model: '',
    year: '',
    color: '',
    plate: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !vehicle) return;
    setForm({
      vin: vehicle.vin || '',
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year != null ? String(vehicle.year) : '',
      color: vehicle.color || '',
      plate: vehicle.plate || '',
      notes: vehicle.notes || '',
    });
    setError('');
    setSaving(false);
  }, [open, vehicle]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vehicle) return;
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
      const row = await apiRequest(`/autoservice/garage/vehicles/${vehicle.id}/staff`, {
        method: 'PATCH',
        body: JSON.stringify({
          vin: form.vin.trim() || null,
          make,
          model,
          year,
          color: form.color.trim() || null,
          plate: form.plate.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      onSaved(row);
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Изменить автомобиль"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            form="edit-guest-vehicle"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      }
    >
      <form id="edit-guest-vehicle" onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">VIN</label>
            <input
              className={inputClass}
              value={form.vin}
              onChange={(e) => setForm((p) => ({ ...p, vin: sanitizeVinInput(e.target.value) }))}
              maxLength={VIN_INPUT_MAX_LENGTH}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Марка</label>
            <input
              className={inputClass}
              value={form.make}
              onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Модель</label>
            <input
              className={inputClass}
              value={form.model}
              onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Год</label>
            <input
              type="number"
              className={inputClass}
              value={form.year}
              onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
              min={1900}
              max={2100}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Цвет</label>
            <input
              className={inputClass}
              value={form.color}
              onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Госномер</label>
            <input
              className={inputClass}
              value={form.plate}
              onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Заметка</label>
            <textarea
              className={inputClass}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              disabled={saving}
            />
          </div>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}

function AddGuestVehicleModal({ open, clientId, onClose, onCreated }) {
  const [form, setForm] = useState({
    vin: '',
    make: '',
    model: '',
    year: '',
    color: '',
    plate: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      vin: '',
      make: '',
      model: '',
      year: '',
      color: '',
      plate: '',
      notes: '',
    });
    setError('');
    setSaving(false);
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientId) return;
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
      const row = await apiRequest('/autoservice/garage/vehicles/staff', {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientId,
          vin: form.vin.trim() || null,
          make,
          model,
          year,
          color: form.color.trim() || null,
          plate: form.plate.trim() || null,
          notes: form.notes.trim() || null,
        }),
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
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить автомобиль"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            form="add-guest-vehicle"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </div>
      }
    >
      <form id="add-guest-vehicle" onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">VIN</label>
            <input
              className={inputClass}
              value={form.vin}
              onChange={(e) => setForm((p) => ({ ...p, vin: sanitizeVinInput(e.target.value) }))}
              maxLength={VIN_INPUT_MAX_LENGTH}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Марка</label>
            <input
              className={inputClass}
              value={form.make}
              onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Модель</label>
            <input
              className={inputClass}
              value={form.model}
              onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Год</label>
            <input
              type="number"
              className={inputClass}
              value={form.year}
              onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
              min={1900}
              max={2100}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Цвет</label>
            <input
              className={inputClass}
              value={form.color}
              onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Госномер</label>
            <input
              className={inputClass}
              value={form.plate}
              onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Заметка</label>
            <textarea
              className={inputClass}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              disabled={saving}
            />
          </div>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}

function AddClientModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setPhone('');
    setPhoneError('');
    setError(null);
    setSaving(false);
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
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
        body: JSON.stringify({
          name: trimmedName,
          phone,
        }),
      });
      onCreated(row);
      onClose();
    } catch (err) {
      const msg = err?.message || 'Не удалось добавить клиента';
      if (/телефон/i.test(msg)) {
        setPhoneError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить клиента"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            form="add-autoservice-client"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </div>
      }
    >
      <form id="add-autoservice-client" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">ФИО</label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Иванов Иван Иванович"
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
              handlePhoneInputChange(e, (value) => {
                setPhone(value);
                setPhoneError('');
              });
            }}
            placeholder="+7 (___) ___-__-__"
            disabled={saving}
            required
          />
          {phoneError ? <p className="mt-1 text-sm text-red-600">{phoneError}</p> : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}

export default function AutoserviceClientsPage() {
  const navigate = useNavigate();
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState('');
  const qApplied = useDebouncedValue(q);
  const [vehiclesModalClient, setVehiclesModalClient] = useState(null);
  const [clientVehicles, setClientVehicles] = useState({});
  const [vehiclesLoadingId, setVehiclesLoadingId] = useState(null);
  const [editVehicle, setEditVehicle] = useState(null);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);

  const handleVinClick = useCallback(async (rawVin) => {
    const vin = normalizeVinOrNull(rawVin);
    if (!vin) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(vin);
      }
    } catch {
      // no-op: clipboard may be unavailable in insecure context
    }
    setVehiclesModalClient(null);
    navigate(`/autoparts/vin?vin=${encodeURIComponent(vin)}`);
  }, [navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (qApplied.trim()) params.set('q', qApplied.trim());
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await apiRequest(`/autoservice/clients${suffix}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить клиентов');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [qApplied]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      load();
    }
  }, [isReady, isAuthenticated, load]);

  const openClientVehicles = async (client) => {
    if (!client?.id) return;
    setVehiclesModalClient(client);
    if (clientVehicles[client.id]) return;
    setVehiclesLoadingId(client.id);
    try {
      const data = await apiRequest(`/autoservice/garage/vehicles?client_id=${client.id}`);
      setClientVehicles((prev) => ({ ...prev, [client.id]: Array.isArray(data) ? data : [] }));
    } catch {
      setClientVehicles((prev) => ({ ...prev, [client.id]: [] }));
    } finally {
      setVehiclesLoadingId(null);
    }
  };

  const closeClientVehicles = () => {
    setVehiclesModalClient(null);
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Клиенты</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading
              ? 'Загрузка…'
              : qApplied.trim()
                ? `${rows.length} найдено`
                : `${rows.length} клиентов`}
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

      <div className="mb-4 flex items-center gap-2">
        <AutoserviceLiveSearchField
          value={q}
          onChange={setQ}
          placeholder="Имя, телефон, авто, VIN, заказ-наряд, запись, ИНН…"
          ariaLabel="Поиск клиентов"
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

      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="py-3 pr-3">Имя</th>
              <th className="w-44 py-3 pr-3">Телефон</th>
              <th className="w-28 py-3">Аккаунт</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-gray-500">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-gray-500">
                  {qApplied.trim() ? 'Ничего не найдено' : 'Клиентов пока нет'}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const hint = hiddenMatchHint(row, qApplied);
                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer transition-colors hover:bg-gray-50/70"
                    onClick={() => openClientVehicles(row)}
                  >
                    <td className="py-3 pr-3 align-middle">
                      <p className="font-medium text-gray-900">{row.name}</p>
                      {hint ? (
                        <p className="mt-0.5 truncate text-xs text-indigo-600" title={hint}>
                          Найдено по: {hint}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 align-middle tabular-nums text-gray-700">
                      {row.phone || '—'}
                    </td>
                    <td className="py-3 align-middle">
                      <AccountBadge userId={row.user_id} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AddClientModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(row) => {
          setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
        }}
      />

      <ClientProfileModal
        open={Boolean(vehiclesModalClient)}
        client={vehiclesModalClient}
        vehicles={vehiclesModalClient ? clientVehicles[vehiclesModalClient.id] : []}
        loading={vehiclesModalClient ? vehiclesLoadingId === vehiclesModalClient.id : false}
        onClose={closeClientVehicles}
        onEditVehicle={setEditVehicle}
        onAddVehicle={() => setAddVehicleOpen(true)}
        onVinClick={handleVinClick}
        onSaved={(updated) => {
          setVehiclesModalClient(updated);
          setRows((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
        }}
      />

      <AddGuestVehicleModal
        open={addVehicleOpen}
        clientId={vehiclesModalClient?.id}
        onClose={() => setAddVehicleOpen(false)}
        onCreated={(created) => {
          if (!created?.client_id) return;
          setClientVehicles((prev) => ({
            ...prev,
            [created.client_id]: [created, ...(prev[created.client_id] || [])],
          }));
        }}
      />

      <EditGuestVehicleModal
        open={Boolean(editVehicle)}
        vehicle={editVehicle}
        onClose={() => setEditVehicle(null)}
        onSaved={(updated) => {
          setClientVehicles((prev) => {
            const clientId = updated.client_id;
            const list = prev[clientId] || [];
            return {
              ...prev,
              [clientId]: list.map((v) => (v.id === updated.id ? updated : v)),
            };
          });
        }}
      />
    </div>
  );
}
