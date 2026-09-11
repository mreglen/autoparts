import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import RepairOrderViewModal, { OrderStatusBadge } from '../../components/Autoservice/RepairOrderViewModal';
import PlannerCreateChoiceModal from '../../components/Autoservice/PlannerCreateChoiceModal';
import PlannerCellContextMenu from '../../components/Autoservice/PlannerCellContextMenu';
import InspectionBookingAddModal from '../../components/Autoservice/InspectionBookingAddModal';
import { apiRequest } from '../../utils/apiClient';
import { formatOrderClockRange, formatPersonNameWithInitials } from '../../utils/autoserviceOrderDisplay';
import { toDateInputValue } from '../../utils/serverDate';
import {
  addDays,
  getWeekStart,
  sortDayOrders,
  toIsoDate,
} from '../../utils/autoservicePlannerLayout';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const ORDER_STATUS_STYLES = {
  pending: 'bg-warning-100 text-warning-700 hover:bg-warning-50',
  in_progress: 'bg-brand-400 text-white hover:bg-brand-500',
  done: 'bg-brand-500 text-white hover:bg-brand-600',
  completed: 'bg-ink-muted text-white hover:bg-ink-faint',
  cancelled: 'bg-line text-ink-soft line-through hover:bg-line-strong',
};

const INSPECTION_STATUS_STYLES = {
  new: 'bg-success-600 text-white hover:bg-success-700',
  processed: 'bg-success-700 text-white hover:bg-success-600',
  cancelled: 'bg-line text-ink-soft line-through hover:bg-line-strong',
};

function plannerItemStyle(item) {
  if (item?.kind === 'inspection') {
    return INSPECTION_STATUS_STYLES[item.status] || INSPECTION_STATUS_STYLES.new;
  }
  return ORDER_STATUS_STYLES[item?.status] || ORDER_STATUS_STYLES.pending;
}

function plannerItemTimeLabel(item) {
  if (item?.kind === 'inspection') return 'Осмотр';
  return formatOrderClockRange(item);
}

function plannerItemKey(item) {
  return `${item.kind || 'order'}-${item.id}`;
}

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

function formatLongDay(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function PlannerDayCell({ orders, onItemClick, isToday, onContextMenu }) {
  const items = useMemo(() => sortDayOrders(orders), [orders]);
  const cellClass = `min-h-[3rem] border-b border-r border-line-soft transition-colors hover:bg-surface-subtle/45 ${
    isToday ? 'bg-brand-50/30' : 'bg-surface'
  }`;

  const handleContextMenu = (event) => {
    event.preventDefault();
    onContextMenu?.({ x: event.clientX, y: event.clientY });
  };

  if (items.length === 0) {
    return (
      <div
        className={cellClass}
        onContextMenu={handleContextMenu}
      />
    );
  }

  return (
    <div
      className={`flex ${cellClass} flex-col gap-1 p-1.5 sm:p-2`}
      onContextMenu={handleContextMenu}
    >
      {items.map((order) => {
        const styleClass = plannerItemStyle(order);
        const clientName = order.client_name || '—';
        const clientLabel = formatPersonNameWithInitials(clientName);
        return (
          <button
            key={plannerItemKey(order)}
            type="button"
            onClick={() => onItemClick(order)}
            className={`w-full rounded-sg-sm px-2 py-1.5 text-left text-[11px] font-semibold leading-tight transition sm:text-xs ${styleClass}`}
            title={`${order.kind === 'inspection' ? 'Осмотр' : `№ ${order.order_number}`} · ${clientName}`}
          >
            <span className="block tabular-nums">{plannerItemTimeLabel(order)}</span>
            <span className="mt-0.5 block truncate font-normal">{clientLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

function WeekToolbar({
  weekRangeLabel,
  selectedDateIso,
  onPrev,
  onNext,
  onToday,
  onJumpDate,
}) {
  return (
    <div className="inline-flex w-full items-center gap-1 rounded-sg bg-surface-subtle p-1 md:w-auto">
      <button
        type="button"
        onClick={onPrev}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sg-sm text-ink-muted transition hover:bg-surface hover:text-ink md:h-9 md:w-9"
        aria-label="Предыдущая неделя"
      >
        ←
      </button>
      <button
        type="button"
        onClick={onToday}
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-sg-sm px-3 text-sm font-medium text-ink-soft transition hover:bg-surface md:h-9"
      >
        Сегодня
      </button>
      <span className="min-w-0 flex-1 truncate px-1 text-center text-sm font-semibold text-ink md:hidden">
        {weekRangeLabel}
      </span>
      <span className="hidden min-w-[9rem] px-2 text-center text-sm font-medium text-ink md:inline">
        {weekRangeLabel}
      </span>
      <button
        type="button"
        onClick={onNext}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sg-sm text-ink-muted transition hover:bg-surface hover:text-ink md:h-9 md:w-9"
        aria-label="Следующая неделя"
      >
        →
      </button>
      <label className="relative ml-0.5 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-sg-sm bg-surface text-ink-muted shadow-sm ring-1 ring-line/80 transition hover:text-ink md:h-9 md:w-auto md:px-2.5">
        <span className="sr-only">Выбрать дату</span>
        <svg className="h-5 w-5 shrink-0 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <input
          type="date"
          value={selectedDateIso}
          onChange={(e) => onJumpDate(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Перейти к неделе по дате"
        />
      </label>
    </div>
  );
}

function MobileDayPlanner({
  dayHeaders,
  zones,
  todayIso,
  selectedDayIso,
  onSelectDay,
  onItemClick,
  onCellContextMenu,
  onAddInZone,
  loading,
}) {
  const selectedIndex = dayHeaders.findIndex(
    (day) => String(day.date).slice(0, 10) === selectedDayIso,
  );

  return (
    <div className="md:hidden">
      <div className="grid grid-cols-7 gap-1">
        {dayHeaders.map((day, index) => {
          const iso = String(day.date).slice(0, 10);
          const isToday = iso === todayIso;
          const isSelected = iso === selectedDayIso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay(iso)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-sg px-0.5 py-1.5 text-center transition ${
                isSelected
                  ? 'bg-brand-600 text-white shadow-sm'
                  : isToday
                    ? 'bg-brand-50 text-brand-800'
                    : 'bg-surface-subtle text-ink-soft'
              }`}
            >
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${isSelected ? 'text-white/80' : ''}`}>
                {WEEKDAYS[index]}
              </span>
              <span className="text-sm font-semibold leading-tight">{formatDayHeader(iso).slice(0, 2)}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-base font-semibold capitalize text-ink">
        {formatLongDay(selectedDayIso)}
      </p>

      {loading && zones.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Загрузка…</p>
      ) : zones.length === 0 ? (
        <p className="mt-4 rounded-sg-lg border border-line bg-surface px-4 py-8 text-center text-sm text-ink-muted">
          Нет рабочих зон. Добавьте их в настройках автосервиса.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {zones.map((zone) => {
            const dayCell = (zone.days || [])[selectedIndex] || {};
            const orders = sortDayOrders(dayCell.orders || []);
            return (
              <section
                key={zone.id ?? 'unassigned'}
                className="rounded-sg-lg border border-line bg-surface px-3.5 py-3 shadow-sm transition-colors hover:bg-surface-muted/80"
                onContextMenu={(event) => {
                  event.preventDefault();
                  onCellContextMenu?.({
                    x: event.clientX,
                    y: event.clientY,
                    dayIso: selectedDayIso,
                    zoneId: zone.id ?? null,
                  });
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-ink">{zone.name}</h2>
                  {onAddInZone ? (
                    <button
                      type="button"
                      onClick={() => onAddInZone({ dayIso: selectedDayIso, zoneId: zone.id ?? null })}
                      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sg border border-brand-200 bg-brand-50 text-lg font-semibold text-brand-700 transition hover:bg-brand-100"
                      aria-label={`Добавить в ${zone.name}`}
                    >
                      +
                    </button>
                  ) : null}
                </div>
                {orders.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-faint">Нет записей</p>
                ) : (
                  <ul className="mt-2 divide-y divide-line-soft">
                    {orders.map((order) => (
                      <li key={plannerItemKey(order)}>
                        <button
                          type="button"
                          onClick={() => onItemClick(order)}
                          className="flex w-full min-h-11 items-start gap-3 py-2.5 text-left"
                        >
                          <span className={`w-14 shrink-0 pt-0.5 text-sm font-semibold tabular-nums ${
                            order.kind === 'inspection' ? 'text-success-700' : 'text-brand-700'
                          }`}>
                            {plannerItemTimeLabel(order)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium text-ink">
                                {order.vehicle && order.vehicle !== '—'
                                  ? order.vehicle
                                  : (order.kind === 'inspection' ? 'Осмотр' : 'Авто')}
                              </span>
                              {order.kind === 'inspection' ? (
                                <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-700 ring-1 ring-inset ring-success-100">
                                  Осмотр
                                </span>
                              ) : (
                                <OrderStatusBadge status={order.status} />
                              )}
                            </span>
                            <span className="mt-0.5 block truncate text-sm text-ink-muted">
                              {formatPersonNameWithInitials(order.client_name)}
                              {order.client_phone ? ` · ${order.client_phone}` : ''}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AutoservicePlannerPage() {
  const navigate = useNavigate();
  const { isReady, isAuthenticated } = useAuthReady();
  const today = useMemo(() => new Date(), []);
  const todayIso = toIsoDate(today);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [plannerData, setPlannerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewOrder, setViewOrder] = useState(null);
  const [viewOrderLoading, setViewOrderLoading] = useState(false);
  const [selectedDayIso, setSelectedDayIso] = useState(todayIso);
  const [createChoiceOpen, setCreateChoiceOpen] = useState(false);
  const [createContext, setCreateContext] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [inspectionPrefillDate, setInspectionPrefillDate] = useState(null);
  const [inspectionPrefillZoneId, setInspectionPrefillZoneId] = useState(null);
  const [viewInspection, setViewInspection] = useState(null);

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

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/autoservice/planner') {
        load();
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [load]);

  const handlePlannerItemClick = (item) => {
    if (item?.kind === 'inspection') {
      setViewInspection(item);
      return;
    }
    openOrderView(item.id);
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

  const shiftWeek = (delta) => {
    setWeekStart((prev) => addDays(prev, delta * 7));
    setSelectedDayIso((prev) => {
      const [y, m, d] = String(prev).split('-').map(Number);
      if (!y || !m || !d) return prev;
      return toIsoDate(addDays(new Date(y, m - 1, d), delta * 7));
    });
  };

  const jumpToDate = (isoDate) => {
    if (!isoDate) return;
    const [y, m, d] = String(isoDate).split('-').map(Number);
    if (!y || !m || !d) return;
    setWeekStart(getWeekStart(new Date(y, m - 1, d)));
    setSelectedDayIso(isoDate);
  };

  const beginCreateOrder = useCallback((ctx) => {
    const dayIso = ctx?.dayIso || todayIso;
    navigate('/autoservice/orders/new', {
      state: {
        scheduledAtLocal: `${dayIso}T10:00`,
        ...(ctx?.zoneId != null ? { workZoneId: ctx.zoneId } : {}),
      },
    });
  }, [navigate, todayIso]);

  const beginCreateInspection = useCallback((ctx) => {
    const dayIso = ctx?.dayIso || todayIso;
    setInspectionPrefillDate(dayIso);
    setInspectionPrefillZoneId(ctx?.zoneId ?? null);
    setInspectionModalOpen(true);
  }, [todayIso]);

  const openCreateChoice = useCallback((ctx) => {
    setCreateContext(ctx || null);
    setCreateChoiceOpen(true);
  }, []);

  const handleCellContextMenu = useCallback(({ x, y, dayIso, zoneId }) => {
    setContextMenu({ x, y, dayIso, zoneId });
  }, []);

  if (!isReady) return <AuthLoadingScreen />;

  const zones = plannerData?.zones || [];
  const dayHeaders = plannerData?.days?.length
    ? plannerData.days
    : weekDays.map((day) => ({ date: toIsoDate(day) }));
  const weekRangeLabel = formatWeekRange(dayHeaders[0]?.date, dayHeaders[6]?.date);
  const selectedDateIso = toIsoDate(weekStart);
  const dayIsos = dayHeaders.map((day) => String(day.date).slice(0, 10));
  const activeDayIso = dayIsos.includes(selectedDayIso)
    ? selectedDayIso
    : (dayIsos.includes(todayIso) ? todayIso : dayIsos[0]);

  const handleOpenCreate = () => {
    beginCreateInspection({ dayIso: activeDayIso, zoneId: null });
  };

  const resolvedCreateContext = createContext || { dayIso: activeDayIso, zoneId: null };
  const contextMenuContext = contextMenu
    ? { dayIso: contextMenu.dayIso, zoneId: contextMenu.zoneId }
    : null;

  return (
    <div className="w-full min-w-0">
      <div className="mb-3 flex flex-col gap-3 md:mb-5 md:flex-row md:items-center md:justify-between">
        <h1 className="max-md:hidden text-xl font-bold text-ink sm:text-2xl">Планировщик</h1>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex h-11 w-full items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-base font-semibold text-white transition hover:bg-brand-700 md:h-10 md:w-auto md:text-sm"
          >
            Создать
          </button>
          <WeekToolbar
            weekRangeLabel={weekRangeLabel}
            selectedDateIso={selectedDateIso}
            onPrev={() => shiftWeek(-1)}
            onNext={() => shiftWeek(1)}
            onToday={() => {
              setWeekStart(getWeekStart(today));
              setSelectedDayIso(todayIso);
            }}
            onJumpDate={jumpToDate}
          />
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-sg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700" role="alert">
          {error}
        </div>
      ) : null}

      <MobileDayPlanner
        dayHeaders={dayHeaders}
        zones={zones}
        todayIso={todayIso}
        selectedDayIso={activeDayIso}
        onSelectDay={setSelectedDayIso}
        onItemClick={handlePlannerItemClick}
        onCellContextMenu={handleCellContextMenu}
        onAddInZone={openCreateChoice}
        loading={loading}
      />

      <div className="hidden overflow-x-auto md:block">
        <div className="min-w-[36rem] overflow-hidden rounded-sg-lg border border-line bg-surface shadow-sm">
          <div
            className="grid w-full"
            style={{ gridTemplateColumns: 'minmax(7.5rem, 11rem) repeat(7, minmax(4.5rem, 1fr))' }}
          >
            <div className="sticky left-0 z-10 border-b border-r border-line bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Зона
            </div>
            {dayHeaders.map((day, index) => {
              const iso = String(day.date).slice(0, 10);
              const isToday = iso === toIsoDate(today);
              return (
                <div
                  key={iso}
                  className={`border-b border-r border-line px-2 py-2 text-center ${
                    isToday ? 'bg-brand-50 text-brand-800' : 'bg-surface-muted text-ink-muted'
                  }`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wide sm:text-xs">
                    {WEEKDAYS[index]}
                  </div>
                  <div className={`mt-0.5 text-sm font-medium ${isToday ? 'text-brand-900' : 'text-ink'}`}>
                    {formatDayHeader(iso)}
                  </div>
                </div>
              );
            })}

            {zones.length === 0 && !loading ? (
              <div className="col-span-8 px-4 py-8 text-center text-sm text-ink-muted">
                Нет рабочих зон. Добавьте их в настройках автосервиса.
              </div>
            ) : (
              zones.map((zone) => (
                <div key={zone.id ?? 'unassigned'} className="contents">
                  <div className="sticky left-0 z-10 border-b border-r border-line bg-surface px-3 py-2.5 text-sm font-medium leading-snug text-ink">
                    {zone.name}
                  </div>
                  {(zone.days || []).map((dayCell) => {
                    const iso = String(dayCell.date).slice(0, 10);
                    const isToday = iso === toIsoDate(today);
                    return (
                      <PlannerDayCell
                        key={`${zone.id ?? 'unassigned'}-${dayCell.date}`}
                        orders={dayCell.orders || []}
                        onItemClick={handlePlannerItemClick}
                        isToday={isToday}
                        onContextMenu={({ x, y }) => handleCellContextMenu({
                          x,
                          y,
                          dayIso: iso,
                          zoneId: zone.id ?? null,
                        })}
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
        <p className="mt-3 hidden text-sm text-ink-muted md:block" aria-live="polite">
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

      <PlannerCreateChoiceModal
        open={createChoiceOpen}
        onClose={() => setCreateChoiceOpen(false)}
        onChooseOrder={() => {
          setCreateChoiceOpen(false);
          beginCreateOrder(resolvedCreateContext);
        }}
        onChooseInspection={() => {
          setCreateChoiceOpen(false);
          beginCreateInspection(resolvedCreateContext);
        }}
      />

      <PlannerCellContextMenu
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onClose={() => setContextMenu(null)}
        onCreateInspection={() => beginCreateInspection(contextMenuContext)}
      />

      <InspectionBookingAddModal
        open={inspectionModalOpen}
        onClose={() => setInspectionModalOpen(false)}
        initialPreferredDate={inspectionPrefillDate}
        workZoneId={inspectionPrefillZoneId}
        zones={zones}
        onCreated={() => {
          setInspectionModalOpen(false);
          load();
        }}
      />

      <InspectionBookingAddModal
        open={Boolean(viewInspection)}
        onClose={() => setViewInspection(null)}
        zones={zones}
        initialBooking={
          viewInspection
            ? {
                id: viewInspection.id,
                name: viewInspection.client_name,
                phone: viewInspection.client_phone,
                preferred_date: toDateInputValue(viewInspection.scheduled_at),
                notes: viewInspection.notes,
                vehicle: viewInspection.vehicle,
                work_zone_id: viewInspection.work_zone_id,
              }
            : null
        }
        onSaved={() => {
          setViewInspection(null);
          load();
        }}
      />
    </div>
  );
}
