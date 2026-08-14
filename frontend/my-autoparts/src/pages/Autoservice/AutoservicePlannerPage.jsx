import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import RepairOrderViewModal from '../../components/Autoservice/RepairOrderViewModal';
import { apiRequest } from '../../utils/apiClient';
import { formatOrderClockRange } from '../../utils/autoserviceOrderDisplay';
import {
  addDays,
  getWeekStart,
  sortDayOrders,
  toIsoDate,
} from '../../utils/autoservicePlannerLayout';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const ORDER_STATUS_STYLES = {
  pending: 'bg-sky-500 text-white hover:bg-sky-600',
  in_progress: 'bg-emerald-500 text-white hover:bg-emerald-600',
  done: 'bg-violet-500 text-white hover:bg-violet-600',
  completed: 'bg-gray-400 text-white hover:bg-gray-500',
  cancelled: 'bg-gray-300 text-gray-700 line-through hover:bg-gray-400',
};

function formatDayHeader(isoDate) {
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}`;
}

function formatWeekRange(startDate, endDate) {
  const start = formatDayHeader(startDate);
  const end = formatDayHeader(endDate);
  const year = String(startDate).slice(0, 4);
  return `${start} – ${end} · ${year}`;
}

function PlannerDayCell({ orders, onOrderClick, isToday }) {
  const items = useMemo(() => sortDayOrders(orders), [orders]);

  if (items.length === 0) {
    return (
      <div
        className={`min-h-[3rem] border-b border-r border-gray-100 ${
          isToday ? 'bg-brand-50/30' : 'bg-white'
        }`}
      />
    );
  }

  return (
    <div
      className={`flex min-h-[3rem] flex-col gap-1 border-b border-r border-gray-100 p-1.5 sm:p-2 ${
        isToday ? 'bg-brand-50/20' : 'bg-white'
      }`}
    >
      {items.map((order) => {
        const styleClass = ORDER_STATUS_STYLES[order.status] || ORDER_STATUS_STYLES.pending;
        return (
          <button
            key={order.id}
            type="button"
            onClick={() => onOrderClick(order.id)}
            className={`w-full rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold leading-tight transition sm:text-xs ${styleClass}`}
            title={order.order_number}
          >
            {formatOrderClockRange(order)}
          </button>
        );
      })}
    </div>
  );
}

export default function AutoservicePlannerPage() {
  const navigate = useNavigate();
  const { isReady, isAuthenticated } = useAuthReady();
  const today = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [plannerData, setPlannerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewOrder, setViewOrder] = useState(null);
  const [viewOrderLoading, setViewOrderLoading] = useState(false);

  const weekStartIso = toIsoDate(weekStart);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/autoservice/planner/week?week_start=${weekStartIso}`);
      setPlannerData(data);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить планировщик');
      setPlannerData(null);
    } finally {
      setLoading(false);
    }
  }, [weekStartIso]);

  useEffect(() => {
    if (isReady && isAuthenticated) load();
  }, [isReady, isAuthenticated, load]);

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

  const shiftWeek = (delta) => {
    setWeekStart((prev) => addDays(prev, delta * 7));
  };

  const jumpToDate = (isoDate) => {
    if (!isoDate) return;
    const [y, m, d] = String(isoDate).split('-').map(Number);
    if (!y || !m || !d) return;
    setWeekStart(getWeekStart(new Date(y, m - 1, d)));
  };

  if (!isReady) return <AuthLoadingScreen />;

  const zones = plannerData?.zones || [];
  const dayHeaders = plannerData?.days?.length
    ? plannerData.days
    : weekDays.map((day) => ({ date: toIsoDate(day) }));
  const weekRangeLabel = formatWeekRange(dayHeaders[0]?.date, dayHeaders[6]?.date);
  const selectedDateIso = toIsoDate(weekStart);

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Планировщик</h1>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition hover:bg-white hover:text-gray-900"
            aria-label="Предыдущая неделя"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(getWeekStart(today))}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-white"
          >
            Сегодня
          </button>
          <span className="hidden min-w-[9rem] px-2 text-center text-sm font-medium text-gray-900 sm:inline">
            {weekRangeLabel}
          </span>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition hover:bg-white hover:text-gray-900"
            aria-label="Следующая неделя"
          >
            →
          </button>
          <label className="relative ml-0.5 inline-flex h-9 cursor-pointer items-center rounded-lg bg-white px-2.5 text-gray-600 shadow-sm ring-1 ring-gray-200/80 transition hover:text-gray-900">
            <span className="sr-only">Выбрать дату</span>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input
              type="date"
              value={selectedDateIso}
              onChange={(e) => jumpToDate(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Перейти к неделе по дате"
            />
          </label>
        </div>
      </div>

      <p className="mb-3 text-sm font-medium text-gray-700 sm:hidden">{weekRangeLabel}</p>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <div className="min-w-[36rem] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div
            className="grid w-full"
            style={{ gridTemplateColumns: 'minmax(7.5rem, 11rem) repeat(7, minmax(4.5rem, 1fr))' }}
          >
            <div className="sticky left-0 z-10 border-b border-r border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Зона
            </div>
            {dayHeaders.map((day, index) => {
              const iso = String(day.date).slice(0, 10);
              const isToday = iso === toIsoDate(today);
              return (
                <div
                  key={iso}
                  className={`border-b border-r border-gray-200 px-2 py-2 text-center ${
                    isToday ? 'bg-brand-50 text-brand-800' : 'bg-gray-50 text-gray-600'
                  }`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wide sm:text-xs">
                    {WEEKDAYS[index]}
                  </div>
                  <div className={`mt-0.5 text-sm font-medium ${isToday ? 'text-brand-900' : 'text-gray-800'}`}>
                    {formatDayHeader(iso)}
                  </div>
                </div>
              );
            })}

            {zones.length === 0 && !loading ? (
              <div className="col-span-8 px-4 py-8 text-center text-sm text-gray-500">
                Нет рабочих зон. Добавьте их в настройках автосервиса.
              </div>
            ) : (
              zones.map((zone) => (
                <div key={zone.id ?? 'unassigned'} className="contents">
                  <div className="sticky left-0 z-10 border-b border-r border-gray-200 bg-white px-3 py-2.5 text-sm font-medium leading-snug text-gray-900">
                    {zone.name}
                  </div>
                  {(zone.days || []).map((dayCell) => {
                    const iso = String(dayCell.date).slice(0, 10);
                    const isToday = iso === toIsoDate(today);
                    return (
                      <PlannerDayCell
                        key={`${zone.id ?? 'unassigned'}-${dayCell.date}`}
                        orders={dayCell.orders || []}
                        onOrderClick={openOrderView}
                        isToday={isToday}
                      />
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-gray-500" aria-live="polite">
          Загрузка…
        </p>
      ) : null}

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
