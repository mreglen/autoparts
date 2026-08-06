import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';
import { formatPhoneInput, validatePhone } from '../../utils/contactValidation';
import { formatServerDateTime, parseServerDate } from '../../utils/serverDate';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const ORDER_STATUS_LABELS = {
  accepted: 'Принят',
  in_progress: 'В работе',
  ready: 'Готов',
  issued: 'Выдан',
  cancelled: 'Отменён',
};

const BOOKING_STATUS_LABELS = {
  new: 'Новая',
  processed: 'Обработана',
  cancelled: 'Отменена',
};

const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABELS);
const BOOKING_STATUS_OPTIONS = Object.entries(BOOKING_STATUS_LABELS);

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function weekdayIndex(date) {
  return (date.getDay() + 6) % 7;
}

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - weekdayIndex(first));
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push(day);
  }
  return cells;
}

function formatHuman(isoDate) {
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
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

function emptyDayEntry(isoDate) {
  return { date: isoDate, repair_orders: [], repair_bookings: [] };
}

function defaultScheduledLocal(isoDate) {
  return `${isoDate}T09:00`;
}

export default function AutoservicePlannerPage() {
  const navigate = useNavigate();
  const { isReady, isAuthenticated } = useAuthReady();
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [daysMap, setDaysMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [createForm, setCreateForm] = useState({ name: '', phone: '', comment: '' });
  const [bookingEditForm, setBookingEditForm] = useState(null);
  const [orderEditForm, setOrderEditForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const rangeFrom = cells.length ? toIsoDate(cells[0]) : null;
  const rangeTo = cells.length ? toIsoDate(cells[cells.length - 1]) : null;

  const load = useCallback(async () => {
    if (!rangeFrom || !rangeTo) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(
        `/autoservice/planner?from=${rangeFrom}&to=${rangeTo}`,
      );
      const next = {};
      (data?.days || []).forEach((day) => {
        next[day.date] = day;
      });
      setDaysMap(next);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить планировщик');
      setDaysMap({});
    } finally {
      setLoading(false);
    }
  }, [rangeFrom, rangeTo]);

  useEffect(() => {
    if (isReady && isAuthenticated) load();
  }, [isReady, isAuthenticated, load]);

  const resetModalState = () => {
    setShowCreateBooking(false);
    setEditingBookingId(null);
    setEditingOrderId(null);
    setCreateForm({ name: '', phone: '', comment: '' });
    setBookingEditForm(null);
    setOrderEditForm(null);
  };

  const closeModal = () => {
    setSelectedDate(null);
    resetModalState();
  };

  const openDay = (iso) => {
    setSelectedDate(iso);
    resetModalState();
  };

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
    closeModal();
  };

  const selectedDay = selectedDate
    ? (daysMap[selectedDate] || emptyDayEntry(selectedDate))
    : null;

  const navigateToNewOrder = (booking = null) => {
    navigate('/autoservice/orders/new', {
      state: {
        scheduledAtLocal: defaultScheduledLocal(selectedDate),
        clientPhone: booking?.phone || undefined,
        clientName: booking?.name || undefined,
        bookingId: booking?.id || undefined,
      },
    });
  };

  const handleCreateBooking = async (event) => {
    event.preventDefault();
    if (!selectedDate) return;
    const name = createForm.name.trim();
    const phoneErr = validatePhone(createForm.phone);
    if (!name) {
      setError('Укажите имя клиента');
      return;
    }
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiRequest('/autoservice/repair-bookings/staff', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone: createForm.phone.trim(),
          preferred_date: selectedDate,
          comment: createForm.comment.trim() || null,
        }),
      });
      await load();
      setShowCreateBooking(false);
      setCreateForm({ name: '', phone: '', comment: '' });
    } catch (e) {
      setError(e?.message || 'Не удалось создать запись');
    } finally {
      setSaving(false);
    }
  };

  const startEditBooking = (booking) => {
    setEditingBookingId(booking.id);
    setShowCreateBooking(false);
    setEditingOrderId(null);
    setBookingEditForm({
      name: booking.name || '',
      phone: booking.phone || '',
      preferred_date: booking.preferred_date,
      comment: booking.comment || '',
      status: booking.status || 'new',
    });
  };

  const handleSaveBooking = async (event) => {
    event.preventDefault();
    if (!editingBookingId || !bookingEditForm) return;
    const name = bookingEditForm.name.trim();
    const phoneErr = validatePhone(bookingEditForm.phone);
    if (!name) {
      setError('Укажите имя клиента');
      return;
    }
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/autoservice/repair-bookings/${editingBookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          phone: bookingEditForm.phone.trim(),
          preferred_date: bookingEditForm.preferred_date,
          comment: bookingEditForm.comment.trim() || null,
          status: bookingEditForm.status,
        }),
      });
      await load();
      setEditingBookingId(null);
      setBookingEditForm(null);
    } catch (e) {
      setError(e?.message || 'Не удалось сохранить запись');
    } finally {
      setSaving(false);
    }
  };

  const startEditOrder = (order) => {
    setEditingOrderId(order.id);
    setShowCreateBooking(false);
    setEditingBookingId(null);
    setOrderEditForm({
      scheduled_at: toLocalInputValue(order.scheduled_at),
      status: order.status || 'accepted',
    });
  };

  const handleSaveOrder = async (event) => {
    event.preventDefault();
    if (!editingOrderId || !orderEditForm) return;
    const scheduledIso = fromLocalInputValue(orderEditForm.scheduled_at);
    if (!scheduledIso) {
      setError('Укажите дату и время заказ-наряда');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/autoservice/repair-orders/${editingOrderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduled_at: scheduledIso }),
      });
      if (orderEditForm.status) {
        await apiRequest(`/autoservice/repair-orders/${editingOrderId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: orderEditForm.status }),
        });
      }
      await load();
      setEditingOrderId(null);
      setOrderEditForm(null);
    } catch (e) {
      setError(e?.message || 'Не удалось сохранить заказ-наряд');
    } finally {
      setSaving(false);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;

  const orders = selectedDay?.repair_orders || [];
  const bookings = selectedDay?.repair_bookings || [];
  const hasItems = orders.length > 0 || bookings.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Планировщик</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            ←
          </button>
          <span className="min-w-[9rem] text-center text-sm font-medium text-gray-900">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            →
          </button>
        </div>
      </div>

      {error && !selectedDate && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
          {WEEKDAYS.map((label) => (
            <div key={label} className="px-2 py-2">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day) => {
            const iso = toIsoDate(day);
            const entry = daysMap[iso];
            const dayOrders = entry?.repair_orders || [];
            const dayBookings = entry?.repair_bookings || [];
            const isCurrentMonth = day.getMonth() === viewMonth;
            const isToday = iso === toIsoDate(today);
            const dayHasItems = dayOrders.length > 0 || dayBookings.length > 0;
            const isSelected = selectedDate === iso;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => openDay(iso)}
                className={`min-h-[4.5rem] border-b border-r border-gray-100 p-2 text-left align-top transition-colors hover:bg-indigo-50/60 ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50/60 text-gray-400'
                } ${isSelected ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'
                  }`}
                >
                  {day.getDate()}
                </span>
                <span className="mt-1 block space-y-0.5">
                  {dayOrders.length > 0 && (
                    <span className="block text-xs text-gray-700">
                      Заказ-наряды: {dayOrders.length}
                    </span>
                  )}
                  {dayBookings.length > 0 && (
                    <span className="block text-xs text-amber-700">
                      Записи: {dayBookings.length}
                    </span>
                  )}
                  {!dayHasItems && isCurrentMonth && (
                    <span className="block text-xs text-gray-400">+</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading && <p className="mt-3 text-sm text-gray-500">Загрузка…</p>}

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Закрыть"
            onClick={closeModal}
          />
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {formatHuman(selectedDay.date)}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {hasItems ? 'События на этот день' : 'На этот день пока ничего не запланировано'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Закрыть"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && selectedDate && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateBooking(true);
                  setEditingBookingId(null);
                  setEditingOrderId(null);
                  setError('');
                }}
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Новая запись
              </button>
              <button
                type="button"
                onClick={() => navigateToNewOrder()}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Создать заказ-наряд
              </button>
            </div>

            {showCreateBooking && (
              <form onSubmit={handleCreateBooking} className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Новая запись</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm text-gray-700">
                    Имя
                    <input
                      type="text"
                      required
                      value={createForm.name}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm text-gray-700">
                    Телефон
                    <input
                      type="tel"
                      required
                      value={createForm.phone}
                      onChange={(e) => setCreateForm((prev) => ({
                        ...prev,
                        phone: formatPhoneInput(e.target.value),
                      }))}
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className="mt-3 block text-sm text-gray-700">
                  Комментарий
                  <textarea
                    rows={2}
                    value={createForm.comment}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, comment: e.target.value }))}
                    className={inputClass}
                  />
                </label>
                <p className="mt-2 text-xs text-gray-500">
                  Дата: {formatHuman(selectedDate)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {saving ? 'Сохранение…' : 'Сохранить запись'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateBooking(false)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}

            <h3 className="mt-5 text-sm font-semibold text-gray-900">Заказ-наряды</h3>
            {orders.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">Нет заказ-нарядов</p>
            ) : (
              <div className="mt-2 space-y-2">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  >
                    {editingOrderId === order.id && orderEditForm ? (
                      <form onSubmit={handleSaveOrder} className="space-y-3">
                        <p className="font-medium text-gray-900">
                          {order.order_number} · {order.client_name}
                        </p>
                        <p className="text-gray-600">{order.vehicle}</p>
                        <label className="block text-sm text-gray-700">
                          Дата и время
                          <input
                            type="datetime-local"
                            required
                            value={orderEditForm.scheduled_at}
                            onChange={(e) => setOrderEditForm((prev) => ({
                              ...prev,
                              scheduled_at: e.target.value,
                            }))}
                            className={inputClass}
                          />
                        </label>
                        <label className="block text-sm text-gray-700">
                          Статус
                          <select
                            value={orderEditForm.status}
                            onChange={(e) => setOrderEditForm((prev) => ({
                              ...prev,
                              status: e.target.value,
                            }))}
                            className={inputClass}
                          >
                            {ORDER_STATUS_OPTIONS.map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={saving}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                          >
                            {saving ? '…' : 'Сохранить'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingOrderId(null);
                              setOrderEditForm(null);
                            }}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Отмена
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">
                            {order.order_number} · {order.client_name}
                          </p>
                          <p className="mt-0.5 text-gray-600">
                            {order.vehicle} · {formatServerDateTime(order.scheduled_at)}
                            {order.lift_number != null ? ` · подъёмник №${order.lift_number}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {ORDER_STATUS_LABELS[order.status] || order.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEditOrder(order)}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/autoservice/orders/${order.id}/edit`)}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Открыть
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h3 className="mt-5 text-sm font-semibold text-gray-900">Записи</h3>
            {bookings.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">Нет записей</p>
            ) : (
              <div className="mt-2 space-y-2">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-sm"
                  >
                    {editingBookingId === booking.id && bookingEditForm ? (
                      <form onSubmit={handleSaveBooking} className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm text-gray-700">
                            Имя
                            <input
                              type="text"
                              required
                              value={bookingEditForm.name}
                              onChange={(e) => setBookingEditForm((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))}
                              className={inputClass}
                            />
                          </label>
                          <label className="block text-sm text-gray-700">
                            Телефон
                            <input
                              type="tel"
                              required
                              value={bookingEditForm.phone}
                              onChange={(e) => setBookingEditForm((prev) => ({
                                ...prev,
                                phone: formatPhoneInput(e.target.value),
                              }))}
                              className={inputClass}
                            />
                          </label>
                        </div>
                        <label className="block text-sm text-gray-700">
                          Дата записи
                          <input
                            type="date"
                            required
                            value={bookingEditForm.preferred_date}
                            onChange={(e) => setBookingEditForm((prev) => ({
                              ...prev,
                              preferred_date: e.target.value,
                            }))}
                            className={inputClass}
                          />
                        </label>
                        <label className="block text-sm text-gray-700">
                          Комментарий
                          <textarea
                            rows={2}
                            value={bookingEditForm.comment}
                            onChange={(e) => setBookingEditForm((prev) => ({
                              ...prev,
                              comment: e.target.value,
                            }))}
                            className={inputClass}
                          />
                        </label>
                        <label className="block text-sm text-gray-700">
                          Статус
                          <select
                            value={bookingEditForm.status}
                            onChange={(e) => setBookingEditForm((prev) => ({
                              ...prev,
                              status: e.target.value,
                            }))}
                            className={inputClass}
                          >
                            {BOOKING_STATUS_OPTIONS.map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={saving}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                          >
                            {saving ? '…' : 'Сохранить'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBookingId(null);
                              setBookingEditForm(null);
                            }}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Отмена
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">
                            {booking.name} · {booking.phone}
                          </p>
                          {booking.comment && (
                            <p className="mt-0.5 text-gray-600">{booking.comment}</p>
                          )}
                          <p className="mt-0.5 text-xs text-gray-500">
                            {BOOKING_STATUS_LABELS[booking.status] || booking.status}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigateToNewOrder(booking)}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
                          >
                            Заказ-наряд
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditBooking(booking)}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Изменить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
