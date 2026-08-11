import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import RepairOrderViewModal, { REPAIR_ORDER_STATUS_LABELS } from '../../components/Autoservice/RepairOrderViewModal';
import { apiRequest } from '../../utils/apiClient';
import { formatOrderClockRange } from '../../utils/autoserviceOrderDisplay';
import {
  addDays,
  buildScheduledLocal,
  formatMinutesLabel,
  getWeekStart,
  layoutDayOrders,
  minutesFromPointer,
  toIsoDate,
} from '../../utils/autoservicePlannerLayout';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAY_HEIGHT = 720;
const HOUR_LABELS = Array.from({ length: 25 }, (_, index) => index);

const ORDER_STATUS_COLORS = {
  pending: 'bg-sky-100 border-sky-300 text-sky-900',
  in_progress: 'bg-emerald-100 border-emerald-300 text-emerald-900',
  completed: 'bg-gray-100 border-gray-300 text-gray-700',
  cancelled: 'bg-red-50 border-red-200 text-red-700',
};

function formatDayHeader(isoDate) {
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}`;
}

function PlannerDayCell({ isoDate, orders, zoneId, isUnassigned, onOrderClick, onEmptyClick, showHourLabels }) {
  const layouts = useMemo(() => layoutDayOrders(orders), [orders]);

  const handleCellClick = (event) => {
    if (event.target.closest('[data-order-block="true"]')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = minutesFromPointer(event.clientY, rect);
    onEmptyClick({
      isoDate,
      scheduledAtLocal: buildScheduledLocal(isoDate, minutes),
      workZoneId: isUnassigned ? null : zoneId,
    });
  };

  return (
    <div
      className="relative border-r border-gray-100 bg-white"
      style={{ height: DAY_HEIGHT }}
      onClick={handleCellClick}
      role="presentation"
    >
      {showHourLabels
        ? HOUR_LABELS.slice(0, 24).map((hour) => (
          <div
            key={`label-${hour}`}
            className="pointer-events-none absolute left-1 z-0 text-[10px] text-gray-400"
            style={{ top: `${(hour / 24) * 100}%` }}
          >
            {String(hour).padStart(2, '0')}:00
          </div>
        ))
        : null}
      {HOUR_LABELS.slice(0, 24).map((hour) => (
        <div
          key={hour}
          className="pointer-events-none absolute inset-x-0 border-t border-gray-100"
          style={{ top: `${(hour / 24) * 100}%` }}
        />
      ))}
      {layouts.map((layout) => {
        const width = 100 / layout.columnCount;
        const left = width * layout.columnIndex;
        const statusClass = ORDER_STATUS_COLORS[layout.order.status] || ORDER_STATUS_COLORS.pending;
        return (
          <button
            key={layout.order.id}
            type="button"
            data-order-block="true"
            onClick={(event) => {
              event.stopPropagation();
              onOrderClick(layout.order.id);
            }}
            className={`absolute overflow-hidden rounded border px-1 py-0.5 text-left text-[10px] leading-tight shadow-sm transition hover:brightness-95 ${statusClass}`}
            style={{
              top: `${layout.topPercent}%`,
              height: `${Math.max(layout.heightPercent, (15 / (24 * 60)) * 100)}%`,
              left: `calc(${left}% + 2px)`,
              width: `calc(${width}% - 4px)`,
            }}
            title={`${layout.order.order_number} · ${layout.order.client_name}`}
          >
            <span className="block font-semibold">{formatOrderClockRange(layout.order)}</span>
            <span className="block truncate">{layout.order.order_number}</span>
            <span className="block truncate opacity-80">{layout.order.client_name}</span>
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

  const navigateToNewOrder = ({ scheduledAtLocal, workZoneId }) => {
    navigate('/autoservice/orders/new', {
      state: {
        scheduledAtLocal,
        workZoneId,
      },
    });
  };

  const shiftWeek = (delta) => {
    setWeekStart((prev) => addDays(prev, delta * 7));
  };

  if (!isReady) return <AuthLoadingScreen />;

  const zones = plannerData?.zones || [];
  const dayHeaders = plannerData?.days?.length
    ? plannerData.days
    : weekDays.map((day) => ({ date: toIsoDate(day) }));

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Планировщик</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="rounded-sg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(getWeekStart(today))}
            className="rounded-sg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Текущая неделя
          </button>
          <span className="min-w-[10rem] text-center text-sm font-medium text-gray-900">
            {formatDayHeader(dayHeaders[0]?.date)} — {formatDayHeader(dayHeaders[6]?.date)}
          </span>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="rounded-sg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            →
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-sg border border-gray-200 bg-white">
        <div
          className="grid min-w-[960px]"
          style={{ gridTemplateColumns: '180px repeat(7, minmax(120px, 1fr))' }}
        >
          <div className="sticky left-0 z-20 border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Рабочая зона
          </div>
          {dayHeaders.map((day, index) => {
            const iso = String(day.date).slice(0, 10);
            const isToday = iso === toIsoDate(today);
            return (
              <div
                key={iso}
                className={`border-b border-r border-gray-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide ${
                  isToday ? 'bg-brand-50 text-brand-800' : 'bg-gray-50 text-gray-500'
                }`}
              >
                <div>{WEEKDAYS[index]}</div>
                <div className="mt-0.5 text-sm normal-case">{formatDayHeader(iso)}</div>
              </div>
            );
          })}

          {zones.length === 0 && !loading ? (
            <div className="col-span-8 px-4 py-8 text-sm text-gray-500">
              Нет рабочих зон. Добавьте их в настройках автосервиса.
            </div>
          ) : (
            zones.map((zone) => (
              <div key={zone.id ?? 'unassigned'} className="contents">
                <div className="sticky left-0 z-10 flex items-center border-b border-r border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-900">
                  {zone.name}
                </div>
                {(zone.days || []).map((dayCell, dayIndex) => (
                  <div key={`${zone.id ?? 'unassigned'}-${dayCell.date}`} className="border-b border-gray-100">
                    <PlannerDayCell
                      isoDate={String(dayCell.date).slice(0, 10)}
                      orders={dayCell.orders || []}
                      zoneId={zone.is_unassigned ? null : zone.id}
                      isUnassigned={Boolean(zone.is_unassigned)}
                      showHourLabels={dayIndex === 0}
                      onOrderClick={openOrderView}
                      onEmptyClick={navigateToNewOrder}
                    />
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
        {Object.entries(REPAIR_ORDER_STATUS_LABELS).map(([status, label]) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded border ${ORDER_STATUS_COLORS[status]?.split(' ')[0] || 'bg-gray-100'}`} />
            {label}
          </span>
        ))}
        <span>Клик по пустому месту — создать заказ-наряд ({formatMinutesLabel(0)}–{formatMinutesLabel(24 * 60 - 15)})</span>
      </div>

      {loading ? <p className="mt-3 text-sm text-gray-500">Загрузка…</p> : null}

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
