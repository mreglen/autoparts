import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';
import { formatServerDateTime } from '../../utils/serverDate';

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

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Monday-first index of the weekday. */
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
  const [patchingId, setPatchingId] = useState(null);

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

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
    setSelectedDate(null);
  };

  const markBookingProcessed = async (bookingId) => {
    setPatchingId(bookingId);
    try {
      await apiRequest(`/autoservice/repair-bookings/${bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'processed' }),
      });
      await load();
    } catch (e) {
      setError(e?.message || 'Не удалось обновить заявку');
    } finally {
      setPatchingId(null);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;

  const selectedDay = selectedDate ? daysMap[selectedDate] : null;

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

      {error && (
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
            const orders = entry?.repair_orders || [];
            const bookings = entry?.repair_bookings || [];
            const isCurrentMonth = day.getMonth() === viewMonth;
            const isToday = iso === toIsoDate(today);
            const hasItems = orders.length > 0 || bookings.length > 0;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => hasItems && setSelectedDate(iso)}
                className={`min-h-[4.5rem] border-b border-r border-gray-100 p-2 text-left align-top transition-colors ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50/60 text-gray-400'
                } ${hasItems ? 'hover:bg-indigo-50/60' : 'cursor-default'}`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'
                  }`}
                >
                  {day.getDate()}
                </span>
                <span className="mt-1 block space-y-0.5">
                  {orders.length > 0 && (
                    <span className="block text-xs text-gray-700">
                      Заказ-наряды: {orders.length}
                    </span>
                  )}
                  {bookings.length > 0 && (
                    <span className="block text-xs text-amber-700">
                      Заявки: {bookings.length}
                    </span>
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
            onClick={() => setSelectedDate(null)}
          />
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {formatHuman(selectedDay.date)}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Закрыть"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <h3 className="mt-4 text-sm font-semibold text-gray-900">Заказ-наряды</h3>
            {(selectedDay.repair_orders || []).length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">Нет заказ-нарядов</p>
            ) : (
              <div className="mt-2 space-y-2">
                {selectedDay.repair_orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">
                        {order.order_number} · {order.client_name}
                      </p>
                      <p className="mt-0.5 text-gray-600">
                        {order.vehicle} · {formatServerDateTime(order.scheduled_at)}
                        {order.lift_number != null ? ` · подъёмник №${order.lift_number}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {ORDER_STATUS_LABELS[order.status] || order.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/autoservice/orders/${order.id}/edit`)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Открыть
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h3 className="mt-5 text-sm font-semibold text-gray-900">Заявки на ремонт</h3>
            {(selectedDay.repair_bookings || []).length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">Нет заявок</p>
            ) : (
              <div className="mt-2 space-y-2">
                {selectedDay.repair_bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">
                        {booking.name} · {booking.phone}
                      </p>
                      {booking.comment && (
                        <p className="mt-0.5 text-gray-600">{booking.comment}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate('/autoservice/orders/new')}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
                      >
                        Создать заказ
                      </button>
                      {booking.status === 'new' && (
                        <button
                          type="button"
                          disabled={patchingId === booking.id}
                          onClick={() => markBookingProcessed(booking.id)}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          {patchingId === booking.id ? '…' : 'Обработана'}
                        </button>
                      )}
                    </div>
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
