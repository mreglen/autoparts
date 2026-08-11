import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import RepairOrderViewModal, { REPAIR_ORDER_STATUS_LABELS } from '../../components/Autoservice/RepairOrderViewModal';
import { apiRequest } from '../../utils/apiClient';
import { formatPhoneInput, validatePhone } from '../../utils/contactValidation';
import { formatServerDateTime, parseServerDate } from '../../utils/serverDate';
import { formatOrderTimeRange } from '../../utils/autoserviceLiftDisplay';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const ORDER_STATUS_LABELS = REPAIR_ORDER_STATUS_LABELS;

const ORDER_STATUS_OPTIONS = [
  ['pending', 'Ожидание'],
  ['in_progress', 'В работе'],
  ['completed', 'Завершён'],
  ['cancelled', 'Отменён'],
];
const BOOKING_STATUS_LABELS = {
  new: 'В ожидании',
  processed: 'Обработано',
  cancelled: 'Отменена',
};

const inputClass =
  'mt-1 block w-full rounded-sg border border-line bg-surface px-3 py-2 text-sm shadow-sg-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeIsoDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
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
  return { date: isoDate, repair_orders: [], repair_bookings: [], inspection_bookings: [] };
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
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [createForm, setCreateForm] = useState({ name: '', phone: '', comment: '' });
  const [orderEditForm, setOrderEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('calendar');
  const [liftDayDate, setLiftDayDate] = useState(() => toIsoDate(today));
  const [liftDayData, setLiftDayData] = useState(null);
  const [liftDayLoading, setLiftDayLoading] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);
  const [viewOrderLoading, setViewOrderLoading] = useState(false);

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
        next[normalizeIsoDate(day.date)] = day;
      });
      setDaysMap(next);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить планировщик');
      setDaysMap({});
    } finally {
      setLoading(false);
    }
  }, [rangeFrom, rangeTo]);

  const loadLiftDay = useCallback(async () => {
    if (!liftDayDate) return;
    setLiftDayLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/autoservice/planner/lifts?date=${liftDayDate}`);
      setLiftDayData(data);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить загрузку подъёмников');
      setLiftDayData(null);
    } finally {
      setLiftDayLoading(false);
    }
  }, [liftDayDate]);

  useEffect(() => {
    if (isReady && isAuthenticated) load();
  }, [isReady, isAuthenticated, load]);

  useEffect(() => {
    if (isReady && isAuthenticated && viewMode === 'lifts') loadLiftDay();
  }, [isReady, isAuthenticated, viewMode, loadLiftDay]);

  const resetModalState = () => {
    setShowCreateBooking(false);
    setEditingOrderId(null);
    setCreateForm({ name: '', phone: '', comment: '' });
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

  const openOrderView = async (orderId) => {
    setViewOrderLoading(true);
    setViewOrder(null);
    setError('');
    try {
      const data = await apiRequest(`/autoservice/repair-orders/${orderId}`);
      setViewOrder(data);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить заказ-наряд');
    } finally {
      setViewOrderLoading(false);
    }
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
      await apiRequest('/autoservice/inspection-bookings', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone: createForm.phone.trim(),
          preferred_date: selectedDate,
          notes: createForm.comment.trim() || null,
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

  const startEditOrder = (order) => {
    setEditingOrderId(order.id);
    setShowCreateBooking(false);
    setOrderEditForm({
      scheduled_at: toLocalInputValue(order.scheduled_at),
      status: order.status || 'pending',
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
  const inspectionBookings = selectedDay?.inspection_bookings || [];
  const hasItems = orders.length > 0 || inspectionBookings.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Планировщик</h1>
          <div className="inline-flex rounded-sg border border-gray-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`rounded-sg px-3 py-1.5 text-sm font-medium ${
                viewMode === 'calendar' ? 'bg-brand-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Календарь
            </button>
            <button
              type="button"
              onClick={() => setViewMode('lifts')}
              className={`rounded-sg px-3 py-1.5 text-sm font-medium ${
                viewMode === 'lifts' ? 'bg-brand-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Подъёмники
            </button>
          </div>
        </div>
        {viewMode === 'calendar' ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-sg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            ←
          </button>
          <span className="min-w-[9rem] text-center text-sm font-medium text-gray-900">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-sg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            →
          </button>
        </div>
        ) : (
          <input
            type="date"
            value={liftDayDate}
            onChange={(e) => setLiftDayDate(e.target.value)}
            className="rounded-sg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
          />
        )}
      </div>

      {error && !selectedDate && viewMode === 'calendar' && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {error && viewMode === 'lifts' && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {viewMode === 'lifts' ? (
        <div className="mt-4">
          {liftDayLoading ? (
            <p className="text-sm text-gray-500">Загрузка…</p>
          ) : (
            <div className="space-y-4">
              {(liftDayData?.lifts || []).length === 0 ? (
                <p className="rounded-sg border border-gray-200 bg-white p-4 text-sm text-gray-500">
                  Нет активных подъёмников. Добавьте их в настройках автосервиса.
                </p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {(liftDayData?.lifts || []).map((lift) => (
                    <section key={lift.id} className="rounded-sg border border-gray-200 bg-white p-4">
                      <h2 className="text-sm font-semibold text-gray-900">{lift.name}</h2>
                      <p className="mt-1 text-xs text-gray-500">
                        {lift.orders.length ? `${lift.orders.length} заказ(ов)` : 'Свободен'}
                      </p>
                      <div className="mt-3 space-y-2">
                        {lift.orders.map((order) => (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => openOrderView(order.id)}
                            className="w-full rounded-sg border border-gray-200 px-3 py-2 text-left text-sm transition hover:border-brand-300 hover:bg-brand-50/40"
                          >
                            <p className="font-medium text-gray-900">{order.order_number} · {order.client_name}</p>
                            <p className="mt-0.5 text-gray-600">{order.vehicle}</p>
                            <p className="mt-0.5 text-xs text-gray-500">{formatOrderTimeRange(order)}</p>
                            <p className="mt-1 text-xs text-gray-500">{ORDER_STATUS_LABELS[order.status] || order.status}</p>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
              {(liftDayData?.unassigned_orders || []).length > 0 ? (
                <section className="rounded-sg border border-dashed border-gray-300 bg-gray-50 p-4">
                  <h2 className="text-sm font-semibold text-gray-900">Без подъёмника</h2>
                  <div className="mt-3 space-y-2">
                    {liftDayData.unassigned_orders.map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => openOrderView(order.id)}
                        className="w-full rounded-sg border border-gray-200 bg-white px-3 py-2 text-left text-sm transition hover:border-brand-300 hover:bg-brand-50/40"
                      >
                        <p className="font-medium text-gray-900">{order.order_number} · {order.client_name}</p>
                        <p className="mt-0.5 text-gray-600">{order.vehicle}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{formatOrderTimeRange(order)}</p>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      ) : (
      <>
      <div className="mt-4 overflow-hidden rounded-sg border border-gray-200 bg-white">
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
            const dayInspections = entry?.inspection_bookings || [];
            const isCurrentMonth = day.getMonth() === viewMonth;
            const isToday = iso === toIsoDate(today);
            const dayHasItems = dayOrders.length > 0 || dayInspections.length > 0;
            const isSelected = selectedDate === iso;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => openDay(iso)}
                className={`relative min-h-[5.5rem] border-b border-r border-gray-100 p-2 text-left align-top transition-colors hover:bg-brand-50/60 ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50/60 text-gray-400'
                } ${dayHasItems ? 'bg-brand-50/40' : ''} ${isSelected ? 'ring-2 ring-inset ring-brand-500' : ''}`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday ? 'bg-brand-600 text-white' : 'text-gray-700'
                  }`}
                >
                  {day.getDate()}
                </span>
                <span className="mt-1.5 block space-y-1">
                  {dayOrders.length > 0 && (
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-brand-800">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                      Заказ-наряды: {dayOrders.length}
                    </span>
                  )}
                  {dayInspections.length > 0 && (
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-800">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      Записи: {dayInspections.length}
                    </span>
                  )}
                  {!dayHasItems && isCurrentMonth && (
                    <span className="block text-xs text-gray-300">+</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          Заказ-наряды
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Записи
        </span>
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
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-sg-lg border border-gray-200 bg-white p-5 shadow-xl">
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
                className="rounded-sg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Закрыть"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && selectedDate && (
              <p className="mt-3 rounded-sg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateBooking(true);
                  setEditingOrderId(null);
                  setError('');
                }}
                className="rounded-sg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Новая запись
              </button>
              <button
                type="button"
                onClick={() => navigateToNewOrder()}
                className="rounded-sg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Создать заказ-наряд
              </button>
            </div>

            {showCreateBooking && (
              <form onSubmit={handleCreateBooking} className="mt-4 rounded-sg border border-amber-200 bg-amber-50/50 p-4">
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
                    className="rounded-sg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {saving ? 'Сохранение…' : 'Сохранить запись'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateBooking(false)}
                    className="rounded-sg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
                    className="rounded-sg border border-gray-200 px-3 py-2.5 text-sm"
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
                            className="rounded-sg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                          >
                            {saving ? '…' : 'Сохранить'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingOrderId(null);
                              setOrderEditForm(null);
                            }}
                            className="rounded-sg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Отмена
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openOrderView(order.id)}
                          className="min-w-0 flex-1 rounded-sg text-left transition hover:bg-gray-50/80"
                        >
                          <p className="font-medium text-gray-900">
                            {order.order_number} · {order.client_name}
                          </p>
                          <p className="mt-0.5 text-gray-600">
                            {order.vehicle} · {formatOrderTimeRange(order)}
                            {order.lift_name ? ` · ${order.lift_name}` : ''}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {ORDER_STATUS_LABELS[order.status] || order.status}
                          </p>
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditOrder(order)}
                            className="rounded-sg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
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

            <h3 className="mt-5 text-sm font-semibold text-gray-900">Записи</h3>
            {inspectionBookings.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">Нет записей на этот день</p>
            ) : (
              <div className="mt-2 space-y-2">
                {inspectionBookings.map((item) => (
                  <div
                    key={`inspection-${item.id}`}
                    className="rounded-sg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">
                          {item.name} · {item.phone}
                        </p>
                        {item.vehicle && item.vehicle !== '—' ? (
                          <p className="mt-0.5 text-gray-700">{item.vehicle}</p>
                        ) : null}
                        {item.notes && (
                          <p className="mt-0.5 text-gray-600">{item.notes}</p>
                        )}
                        <p className="mt-0.5 text-xs text-gray-500">
                          {BOOKING_STATUS_LABELS[item.status] || item.status}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/autoservice/inspections')}
                        className="rounded-sg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Открыть список
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}

      <RepairOrderViewModal
        order={viewOrder}
        loading={viewOrderLoading}
        onClose={() => {
          setViewOrder(null);
          setViewOrderLoading(false);
        }}
        onEdit={(order) => {
          setViewOrder(null);
          navigate(`/autoservice/orders/${order.id}/edit`);
        }}
      />
    </div>
  );
}
