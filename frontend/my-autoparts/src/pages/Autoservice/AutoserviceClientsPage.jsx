import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import { useDebouncedValue } from '../../hooks/useDebouncedCallback';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import Modal, { ConfirmDialog } from '../../components/UI/Modal';
import { Skeleton, UnderlineTabs, NumericInput } from '../../components/UI';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import {
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTheadRowClass,
  autoserviceListThClass,
  autoserviceListTbodyClass,
  autoserviceListTrClickableClass,
  autoserviceListTdClass,
} from '../../utils/warehouseListUi';
import RepairOrderViewModal, {
  OrderStatusBadge,
  vehicleLabel,
} from '../../components/Autoservice/RepairOrderViewModal';
import { apiRequest } from '../../utils/apiClient';
import AutoserviceClientRequisitesFields from '../../components/Autoservice/AutoserviceClientRequisitesFields';
import { validatePhoneOptional, validateEmail } from '../../utils/contactValidation';
import PhoneInput from '../../components/UI/PhoneInput';
import { formatServerDate, formatServerDateTime } from '../../utils/serverDate';
import { normalizeVinForLookupOrNull, sanitizeVinInput, VIN_INPUT_MAX_LENGTH } from '../../utils/laximoVin';
import {
  clientRequisitesChanged,
  emptyClientRequisites,
  isGuestClient,
  personTypeLabel,
  saveAutoserviceClientRequisites,
  createAutoserviceClientAccount,
  validateInn,
} from '../../utils/autoserviceClientRequisites';

const inputClass = 'sg-pill-input mt-1';
const textareaClass = 'sg-pill-textarea mt-1';

function ClientMobileCard({ row, hint, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="w-full rounded-sg border border-line bg-surface px-4 py-3 text-left shadow-sm transition hover:border-brand-200 hover:bg-brand-50/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">{row.name}</p>
          <p className="mt-0.5 truncate text-sm text-ink-muted">{row.phone || '—'}</p>
          {hint ? (
            <p className="mt-1 truncate text-xs text-brand-600" title={hint}>
              Найдено по: {hint}
            </p>
          ) : null}
        </div>
        <AccountBadge userId={row.user_id} />
      </div>
    </button>
  );
}

function AccountBadge({ userId }) {
  if (userId) {
    return (
      <span className="inline-flex rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700 ring-1 ring-inset ring-success-100">
        С аккаунтом
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-ink-muted ring-1 ring-inset ring-line">
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
    return <p className="text-sm text-ink-muted">Загрузка автомобилей…</p>;
  }
  if (!vehicles?.length) {
    return <p className="text-sm text-ink-muted">Автомобилей нет</p>;
  }
  return (
    <ul className="space-y-2">
      {vehicles.map((v) => (
        <li key={v.id} className="rounded-sg-sm border border-line-soft p-3 text-sm text-ink-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
            <span className="font-medium text-ink">
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
                  className="font-mono text-brand-600 underline decoration-brand-300 underline-offset-2 transition hover:text-brand-800 hover:decoration-brand-600"
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
                  className="text-sm font-medium text-brand-600 underline decoration-brand-300 underline-offset-2 transition hover:text-brand-800 hover:decoration-brand-600"
                >
                  Заказ-наряды
                </button>
              </div>
            </div>
            {canEdit ? (
              <button
                type="button"
                onClick={() => onEdit?.(v)}
                className="shrink-0 rounded-sg-sm px-2 py-1 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
              >
                Изменить
              </button>
            ) : null}
          </div>

          {ordersByVehicle[v.id]?.length ? (
            <div className="mt-3 border-t border-line-soft pt-2">
              <p className="mb-1 text-xs font-medium text-ink-muted">Заказ-наряды по этому авто</p>
              <ul className="space-y-1">
                {ordersByVehicle[v.id].map((order) => (
                  <li key={order.id} className="text-xs text-ink-soft">
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
    return <span className="text-ink-faint">не указано</span>;
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
          <dt className="text-xs font-medium text-ink-muted">{label}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
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
  new: 'bg-warning-50 text-warning-700 ring-warning-100',
  processed: 'bg-success-50 text-success-700 ring-success-100',
  cancelled: 'bg-surface-subtle text-ink-muted ring-line',
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
    return <p className="text-sm text-ink-muted">Загрузка…</p>;
  }
  if (!children) {
    return <p className="text-sm text-ink-muted">{empty}</p>;
  }
  return <ul className="divide-y divide-line-soft">{children}</ul>;
}

function ClientOrderRow({ row, onOpen }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(row)}
        className="flex w-full items-start justify-between gap-3 py-2.5 text-left transition hover:bg-surface-muted/80"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            Заказ-наряд №{row.order_number || row.id}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {formatServerDateTime(row.scheduled_at || row.created_at) || '—'}
            {row.vehicle ? ` · ${vehicleLabel(row.vehicle)}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <OrderStatusBadge status={row.status} />
          <p className="mt-1 text-xs tabular-nums text-ink-muted">
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
        className="flex w-full items-start justify-between gap-3 py-2.5 text-left transition hover:bg-surface-muted/80"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            {formatServerDate(row.preferred_date) || 'Заявка'}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
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
      title={`Заявка · ${formatServerDate(booking.preferred_date) || booking.name || ''}`}
      size="md"
      wrapperClassName="z-[120]"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sg-sm border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-muted"
          >
            Закрыть
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-ink-soft">
        <div className="flex flex-wrap items-center gap-2">
          <BookingStatusBadge status={booking.status} />
          <span className="text-xs text-ink-muted">
            {BOOKING_SOURCE_LABELS[booking.source] || booking.source || '—'}
          </span>
        </div>
        <p>
          <span className="font-medium text-ink">Имя:</span> {booking.name || '—'}
        </p>
        <p>
          <span className="font-medium text-ink">Телефон:</span> {booking.phone || '—'}
        </p>
        <p>
          <span className="font-medium text-ink">Желаемая дата:</span>{' '}
          {formatServerDate(booking.preferred_date) || '—'}
        </p>
        <p>
          <span className="font-medium text-ink">Автомобиль:</span> {vehicle || '—'}
        </p>
        <p>
          <span className="font-medium text-ink">Создана:</span>{' '}
          {formatServerDateTime(booking.created_at) || '—'}
        </p>
        <div className="rounded-sg border border-line-soft bg-surface-muted/80 px-3 py-3">
          <p>
            <span className="font-medium text-ink">Комментарий:</span>{' '}
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
  const [createAccountConfirmOpen, setCreateAccountConfirmOpen] = useState(false);
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
    setCreateAccountConfirmOpen(false);
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
      const phoneErr = validatePhoneOptional(form.phone);
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
      setCreateAccountConfirmOpen(false);
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
              onClick={() => setCreateAccountConfirmOpen(true)}
              disabled={saving || creatingAccount}
              className="rounded-sg-sm border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
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
                className="rounded-sg-sm border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-muted"
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-sg-sm bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-sg-sm border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-muted"
              >
                Закрыть
              </button>
              {section === 'profile' ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={startEditing}
                  className="rounded-sg-sm bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
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
                  <p className="text-xs text-ink-muted">
                    Гость — можно менять ФИО, телефон и автомобили.
                    {canCreateAccount ? ' Email указан — можно создать личный кабинет.' : ''}
                  </p>
                ) : (
                  <p className="text-xs text-ink-muted">
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
                  {error ? <p className="text-sm text-danger-600">{error}</p> : null}
                  {accountMessage ? <p className="text-sm text-success-700">{accountMessage}</p> : null}
                </form>
              ) : (
                <ClientProfileFields client={client} />
              )}

              {!editing && accountMessage ? (
                <p className="text-sm text-success-700">{accountMessage}</p>
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
                    className="rounded-sg-sm bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
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
                  <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
                    Фильтр: авто {filteredVehicleLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => setVehicleOrderFilterId(null)}
                    className="text-xs font-medium text-brand-600 underline decoration-brand-300 underline-offset-2 transition hover:text-brand-800 hover:decoration-brand-600"
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
            <ClientHistoryList loading={bookingsLoading} empty="Заявок нет">
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
    <ConfirmDialog
      open={createAccountConfirmOpen}
      onClose={() => {
        if (!creatingAccount) setCreateAccountConfirmOpen(false);
      }}
      onConfirm={handleCreateAccount}
      title="Создать личный кабинет?"
      message={`Отправить пароль на ${guestEmail}? Клиент сможет входить на сайт и видеть свои заказ-наряды и заявки.`}
      confirmLabel="Создать аккаунт"
      cancelLabel="Отмена"
      loading={creatingAccount}
    />
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
            className="rounded-sg-sm border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-muted"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            form="edit-guest-vehicle"
            disabled={saving}
            className="rounded-sg-sm bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      }
    >
      <form id="edit-guest-vehicle" onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-ink-soft">VIN</label>
            <input
              className={inputClass}
              value={form.vin}
              onChange={(e) => setForm((p) => ({ ...p, vin: sanitizeVinInput(e.target.value) }))}
              maxLength={VIN_INPUT_MAX_LENGTH}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft">Марка</label>
            <input
              className={inputClass}
              value={form.make}
              onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft">Модель</label>
            <input
              className={inputClass}
              value={form.model}
              onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft">Год</label>
            <NumericInput
              mode="numeric"
              className={inputClass}
              value={form.year}
              onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
              maxLength={4}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft">Цвет</label>
            <input
              className={inputClass}
              value={form.color}
              onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-ink-soft">Госномер</label>
            <input
              className={inputClass}
              value={form.plate}
              onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-ink-soft">Заметка</label>
            <textarea
              className={textareaClass}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              disabled={saving}
            />
          </div>
        </div>
        {error ? <p className="text-sm text-danger-600">{error}</p> : null}
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
            className="rounded-sg-sm border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-muted"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            form="add-guest-vehicle"
            disabled={saving}
            className="rounded-sg-sm bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </div>
      }
    >
      <form id="add-guest-vehicle" onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-ink-soft">VIN</label>
            <input
              className={inputClass}
              value={form.vin}
              onChange={(e) => setForm((p) => ({ ...p, vin: sanitizeVinInput(e.target.value) }))}
              maxLength={VIN_INPUT_MAX_LENGTH}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft">Марка</label>
            <input
              className={inputClass}
              value={form.make}
              onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft">Модель</label>
            <input
              className={inputClass}
              value={form.model}
              onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft">Год</label>
            <NumericInput
              mode="numeric"
              className={inputClass}
              value={form.year}
              onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
              maxLength={4}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft">Цвет</label>
            <input
              className={inputClass}
              value={form.color}
              onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-ink-soft">Госномер</label>
            <input
              className={inputClass}
              value={form.plate}
              onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-ink-soft">Заметка</label>
            <textarea
              className={textareaClass}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              disabled={saving}
            />
          </div>
        </div>
        {error ? <p className="text-sm text-danger-600">{error}</p> : null}
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
            className="rounded-sg-sm border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-muted"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            form="add-autoservice-client"
            disabled={saving}
            className="rounded-sg-sm bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </div>
      }
    >
      <form id="add-autoservice-client" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-soft">ФИО</label>
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
          <label className="block text-sm font-medium text-ink-soft">Телефон (необязательно)</label>
          <PhoneInput
            className={`${inputClass} ${phoneError ? '!border-danger-600 !bg-danger-50 focus:!border-danger-600' : ''}`}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setPhoneError('');
            }}
            placeholder="+7 (___) ___-__-__"
            disabled={saving}
          />
          {phoneError ? <p className="mt-1 text-sm text-danger-600">{phoneError}</p> : null}
        </div>
        {error ? <p className="text-sm text-danger-600">{error}</p> : null}
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
    const vin = normalizeVinForLookupOrNull(rawVin);
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

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/autoservice/clients') {
        load();
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [load]);

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
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Клиенты</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
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
          className="inline-flex min-h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Добавить
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <AutoserviceLiveSearchField
          value={q}
          onChange={setQ}
          placeholder="Имя, телефон, авто, VIN, заказ-наряд, заявка, ИНН…"
          ariaLabel="Поиск клиентов"
        />
        <button
          type="button"
          onClick={load}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-ink-muted transition hover:bg-surface-subtle hover:text-ink"
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

      <div className={autoserviceListTableWrapClass}>
        <table className={autoserviceListTableClass}>
          <thead>
            <tr className={autoserviceListTheadRowClass}>
              <th className={`min-w-0 ${autoserviceListThClass}`}>Имя</th>
              <th className={`w-36 ${autoserviceListThClass}`}>Телефон</th>
              <th className={`w-28 ${autoserviceListThClass}`}>Аккаунт</th>
            </tr>
          </thead>
          <tbody className={autoserviceListTbodyClass}>
            {loading ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-ink-muted">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-ink-muted">
                  {qApplied.trim() ? 'Ничего не найдено' : 'Клиентов пока нет'}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const hint = hiddenMatchHint(row, qApplied);
                return (
                  <tr
                    key={row.id}
                    className={autoserviceListTrClickableClass}
                    onClick={() => openClientVehicles(row)}
                  >
                    <td className={autoserviceListTdClass}>
                      <p className="font-semibold text-ink">{row.name}</p>
                      {hint ? (
                        <p className="mt-0.5 truncate text-xs text-brand-600" title={hint}>
                          Найдено по: {hint}
                        </p>
                      ) : null}
                    </td>
                    <td className={`${autoserviceListTdClass} whitespace-nowrap tabular-nums text-ink-muted`}>
                      {row.phone || '—'}
                    </td>
                    <td className={autoserviceListTdClass}>
                      <AccountBadge userId={row.user_id} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`client-sk-${i}`} className="h-20 w-full rounded-sg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            {qApplied.trim() ? 'Ничего не найдено' : 'Клиентов пока нет'}
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <ClientMobileCard
                key={row.id}
                row={row}
                hint={hiddenMatchHint(row, qApplied)}
                onOpen={openClientVehicles}
              />
            ))}
          </div>
        )}
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
