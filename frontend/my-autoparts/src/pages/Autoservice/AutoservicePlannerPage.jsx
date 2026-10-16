import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import { usePlannerWorkZonePermissions } from '../../hooks/usePlannerWorkZonePermissions';
import { withBackTo } from '../../hooks/useHistoryBack';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import RepairOrderViewModal, { OrderStatusBadge, normalizeRepairOrderStatus } from '../../components/Autoservice/RepairOrderViewModal';
import PlannerCreateChoiceModal from '../../components/Autoservice/PlannerCreateChoiceModal';
import PlannerCellContextMenu from '../../components/Autoservice/PlannerCellContextMenu';
import InspectionBookingAddModal from '../../components/Autoservice/InspectionBookingAddModal';
import Toast from '../../components/UI/Toast';
import Modal from '../../components/UI/Modal';
import { apiRequest } from '../../utils/apiClient';
import { formatOrderClockRange } from '../../utils/autoserviceOrderDisplay';
import { parseWallClockDate, toDateInputValue } from '../../utils/serverDate';
import {
  addDays,
  assignPlannerLanes,
  getWeekStart,
  plannerItemCoversDay,
  plannerItemEndDate,
  plannerInspectionSegment,
  sortDayOrders,
  toIsoDate,
} from '../../utils/autoservicePlannerLayout';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const PLANNER_VIEW_STORAGE_KEY = 'plannerViewMode';

function readPlannerViewMode() {
  if (typeof localStorage === 'undefined') return 'week';
  return localStorage.getItem(PLANNER_VIEW_STORAGE_KEY) === 'compact' ? 'compact' : 'week';
}

const ORDER_STATUS_STYLES = {
  pending: 'bg-warning-100 text-warning-700 hover:bg-warning-50',
  in_progress: 'bg-brand-400 text-white hover:bg-brand-500',
  done: 'bg-brand-500 text-white hover:bg-brand-600',
  completed: 'bg-ink-muted text-white hover:bg-ink-faint',
  cancelled: 'bg-line text-ink-soft line-through hover:bg-line-strong',
};

const INSPECTION_STATUS_STYLES = {
  new: 'bg-success-600 text-white hover:bg-success-700',
  confirmed: 'bg-success-600 text-white hover:bg-success-700',
  processed: 'bg-success-700 text-white hover:bg-success-600',
  cancelled: 'bg-line text-ink-soft line-through hover:bg-line-strong',
};

function plannerItemStyle(item) {
  if (item?.kind === 'inspection') {
    return INSPECTION_STATUS_STYLES[item.status] || INSPECTION_STATUS_STYLES.new;
  }
  const status = normalizeRepairOrderStatus(item?.status);
  return ORDER_STATUS_STYLES[status] || ORDER_STATUS_STYLES.pending;
}

const ORDER_BAR_COLORS = {
  pending: 'bg-warning-600',
  in_progress: 'bg-brand-400',
  done: 'bg-brand-500',
  completed: 'bg-ink-muted',
  cancelled: 'bg-line-strong',
};

const INSPECTION_BAR_COLORS = {
  new: 'bg-success-600',
  confirmed: 'bg-success-600',
  processed: 'bg-success-700',
  cancelled: 'bg-line-strong',
};

function plannerItemBarColor(item) {
  if (item?.kind === 'inspection') {
    return INSPECTION_BAR_COLORS[item.status] || INSPECTION_BAR_COLORS.new;
  }
  return ORDER_BAR_COLORS[normalizeRepairOrderStatus(item?.status)] || ORDER_BAR_COLORS.pending;
}

function plannerZoneDayItems(zone, dayIso) {
  return sortDayOrders(
    (zone?.days || [])
      .flatMap((day) => day.orders || [])
      .filter((item) => plannerItemCoversDay(item, dayIso)),
  );
}

function plannerItemTimeLabel(item) {
  if (item?.kind === 'inspection') return item.preferred_time?.slice(0, 5) || '—';
  return formatOrderClockRange(item);
}

function plannerClientFirstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '—';
}

function plannerInspectionClockLabel(item) {
  const date = parseWallClockDate(item?.inspection_scheduled_at);
  return date ? date.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—';
}

function plannerItemStartTimeLabel(item) {
  if (item?.kind === 'inspection') return item.preferred_time?.slice(0, 5) || '—';
  const start = parseWallClockDate(item?.scheduled_at);
  return start ? start.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—';
}

function plannerItemMobileTimeLabel(item, dayIso) {
  const start = parseWallClockDate(item?.scheduled_at);
  if (!start || item?.kind === 'inspection' || toIsoDate(start) === dayIso) {
    return plannerItemStartTimeLabel(item);
  }
  return `с ${formatDayHeader(toIsoDate(start))}`;
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

function plannerBarTimeLabel(entry, dayIsos) {
  const { item, startIdx, endIdx } = entry;
  if (item.kind === 'inspection') return plannerItemTimeLabel(item);
  if (endIdx <= startIdx) return plannerItemTimeLabel(item);
  const startDate = parseWallClockDate(item.scheduled_at);
  if (!startDate) return '—';
  const startClock = startDate.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const end = plannerItemEndDate(item);
  if (!end) return startClock;
  const endClock = end.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (entry.continuesFromPrevWeek) {
    return `${formatDayHeader(toIsoDate(startDate))} → ${formatDayHeader(dayIsos[endIdx])} ${endClock}`;
  }
  return `${startClock} → ${formatDayHeader(dayIsos[endIdx])} ${endClock}`;
}

function PlannerZoneWeekRow({ zone, dayIsos, todayIso, onItemClick, onCellContextMenu }) {
  const entries = useMemo(
    () => assignPlannerLanes((zone.days || []).flatMap((day) => day.orders || []), dayIsos),
    [zone.days, dayIsos],
  );

  const handleCellContextMenu = (dayIso) => (event) => {
    event.preventDefault();
    onCellContextMenu?.({ x: event.clientX, y: event.clientY, dayIso, zoneId: zone.id ?? null });
  };

  const handleCellClick = (dayIso) => (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onCellContextMenu?.({
      x: rect.left,
      y: rect.bottom + 4,
      dayIso,
      zoneId: zone.id ?? null,
    });
  };

  return (
    <div className="contents">
      <div className="sticky left-0 z-10 border-b border-r border-line bg-surface px-3 py-2.5 text-sm font-medium leading-snug text-ink">
        {zone.name}
      </div>
      <div className="relative col-span-7 min-h-[3rem] border-b border-line-soft">
        <div className="absolute inset-0 grid grid-cols-7">
          {(zone.days || []).map((dayCell) => {
            const iso = String(dayCell.date).slice(0, 10);
            const weekday = new Date(`${iso}T00:00:00`).getDay();
            const isWeekend = weekday === 0 || weekday === 6;
            return (
              <div
                key={iso}
                className={`border-r border-line-soft transition-colors hover:bg-surface-subtle/45 ${
                  iso === todayIso ? 'bg-brand-50/30' : isWeekend ? 'bg-danger-50/40' : 'bg-surface'
                }`}
                onContextMenu={handleCellContextMenu(iso)}
                onClick={handleCellClick(iso)}
              />
            );
          })}
        </div>
        {entries.length > 0 ? (
          <div className="pointer-events-none relative grid grid-cols-[repeat(14,minmax(0,1fr))] py-px sm:py-0.5">
            {entries.map((entry) => {
              const { item } = entry;
              const styleClass = plannerItemStyle(item);
              const clientName = item.client_name || '—';
              const vehicleLabel = item.vehicle_make || '';
              const nameWithVehicle = [plannerClientFirstName(clientName), vehicleLabel].filter(Boolean).join(' ');
              const titleVehicle = [item.vehicle_make, item.vehicle_model].filter(Boolean).join(' ');
              const itemTitle = [
                item.kind === 'inspection' ? 'Осмотр' : `№ ${item.order_number}`,
                clientName,
                titleVehicle,
              ].filter(Boolean).join(' · ');
              const segment = plannerInspectionSegment(entry);
              return (
                <button
                  key={plannerItemKey(item)}
                  type="button"
                  onClick={() => onItemClick(item)}
                  className={`pointer-events-auto relative mx-0.5 my-px min-w-0 overflow-hidden rounded-sg-sm px-2 py-1.5 text-left text-[11px] font-semibold leading-tight transition sm:mx-1 sm:my-0.5 sm:text-xs ${styleClass} ${
                    entry.continuesPastWeek ? 'rounded-r-none' : ''
                  } ${entry.continuesFromPrevWeek ? 'rounded-l-none' : ''}`}
                  style={{
                    gridColumn: `${entry.subStart + 1} / ${entry.subEnd + 2}`,
                    gridRow: entry.lane + 1,
                  }}
                  title={itemTitle}
                >
                  <span className="relative block truncate tabular-nums">{plannerBarTimeLabel(entry, dayIsos)}</span>
                  <span className="relative mt-0.5 block truncate font-normal">{nameWithVehicle}</span>
                  {segment ? (
                    <span
                      className="absolute inset-y-0 bg-success-600 px-1.5 py-1.5 text-white"
                      style={{ left: `${segment.leftPercent}%`, width: `${segment.widthPercent}%` }}
                    >
                      <span className="block truncate tabular-nums">{plannerInspectionClockLabel(item)}</span>
                      <span className="mt-0.5 block truncate font-normal">{nameWithVehicle}</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const COMPACT_MAX_BARS = 6;

function PlannerWeekGrid({
  zones,
  dayHeaders,
  dayIsos,
  todayIso,
  loading,
  onItemClick,
  onCellContextMenu,
}) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <div className="min-w-[52rem] overflow-hidden rounded-sg-lg border border-line bg-surface shadow-sm">
        <div
          className="grid w-full"
          style={{ gridTemplateColumns: 'minmax(5rem, 7.3rem) repeat(7, minmax(6.5rem, 1fr))' }}
        >
          <div className="sticky left-0 z-10 border-b border-r border-line bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Зона
          </div>
          {dayHeaders.map((day, index) => {
            const iso = String(day.date).slice(0, 10);
            const isToday = iso === todayIso;
            const isWeekend = index >= 5;
            return (
              <div
                key={iso}
                className={`border-b border-r border-line px-2 py-2 text-center ${
                  isToday
                    ? 'bg-brand-50 text-brand-800'
                    : isWeekend
                      ? 'bg-danger-50/60 text-ink-muted'
                      : 'bg-surface-muted text-ink-muted'
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-wide sm:text-sm">
                  <span>{WEEKDAYS[index]}</span>{' '}
                  <span className={`normal-case tracking-normal ${isToday ? 'text-brand-900' : 'text-ink'}`}>
                    {formatDayHeader(iso)}
                  </span>
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
              <PlannerZoneWeekRow
                key={zone.id ?? 'unassigned'}
                zone={zone}
                dayIsos={dayIsos}
                todayIso={todayIso}
                onItemClick={onItemClick}
                onCellContextMenu={onCellContextMenu}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatDayModalTitle(isoDate) {
  const label = formatLongDay(isoDate);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function PlannerCompactZoneRow({ zone, dayIsos, todayIso, onDayOpen }) {
  return (
    <div className="contents">
      <div className="sticky left-0 z-10 border-b border-r border-line bg-surface px-3 py-2 text-sm font-medium leading-snug text-ink">
        {zone.name}
      </div>
      {dayIsos.map((iso, index) => {
        const items = plannerZoneDayItems(zone, iso);
        const bars = items.slice(0, COMPACT_MAX_BARS);
        const hiddenCount = items.length - bars.length;
        const isToday = iso === todayIso;
        const isWeekend = index >= 5;
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onDayOpen(iso)}
            title={`${zone.name} · ${formatDayHeader(iso)} · ${items.length || 'свободно'}`}
            className={`flex min-h-11 flex-col gap-1 border-b border-line-soft px-1.5 py-1.5 transition-colors hover:bg-surface-subtle/70 ${
              isToday ? 'bg-brand-50/40' : isWeekend ? 'bg-danger-50/40' : 'bg-surface'
            }`}
          >
            <span className={`text-[11px] font-semibold leading-none tabular-nums ${isToday ? 'text-brand-800' : 'text-ink-faint'}`}>
              {iso.slice(8)}
            </span>
            <span className="flex flex-col gap-[3px]">
              {bars.map((item) => (
                <span key={plannerItemKey(item)} className={`h-[3px] w-full rounded-full ${plannerItemBarColor(item)}`} />
              ))}
              {hiddenCount > 0 ? (
                <span className="text-[10px] leading-none text-ink-faint">+{hiddenCount}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PlannerCompactWeek({ zones, dayHeaders, todayIso, loading, onDayOpen }) {
  const dayIsos = dayHeaders.map((day) => String(day.date).slice(0, 10));
  return (
    <div className="hidden overflow-x-auto md:block">
      <div className="min-w-[42rem] overflow-hidden rounded-sg-lg border border-line bg-surface shadow-sm">
        <div
          className="grid w-full"
          style={{ gridTemplateColumns: 'minmax(5rem, 7.3rem) repeat(7, minmax(3.25rem, 1fr))' }}
        >
          <div className="sticky left-0 z-10 border-b border-r border-line bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Зона
          </div>
          {dayHeaders.map((day, index) => {
            const iso = String(day.date).slice(0, 10);
            const isToday = iso === todayIso;
            const isWeekend = index >= 5;
            return (
              <div
                key={iso}
                className={`border-b border-r border-line py-2 text-center text-xs font-semibold uppercase tracking-wide ${
                  isToday
                    ? 'bg-brand-50 text-brand-800'
                    : isWeekend
                      ? 'bg-danger-50/60 text-ink-muted'
                      : 'bg-surface-muted text-ink-muted'
                }`}
              >
                {WEEKDAYS[index]}
              </div>
            );
          })}

          {zones.length === 0 && !loading ? (
            <div className="col-span-8 px-4 py-8 text-center text-sm text-ink-muted">
              Нет рабочих зон. Добавьте их в настройках автосервиса.
            </div>
          ) : (
            zones.map((zone) => (
              <PlannerCompactZoneRow
                key={zone.id ?? 'unassigned'}
                zone={zone}
                dayIsos={dayIsos}
                todayIso={todayIso}
                onDayOpen={onDayOpen}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PlannerDayModal({ open, dayIso, zones, onClose, onItemClick }) {
  const sections = (zones || [])
    .map((zone) => ({ zone, items: plannerZoneDayItems(zone, dayIso) }))
    .filter((section) => section.items.length > 0);

  return (
    <Modal open={open} onClose={onClose} title={dayIso ? formatDayModalTitle(dayIso) : ''} size="md">
      {sections.length === 0 ? (
        <p className="rounded-sg border border-dashed border-line-strong bg-surface px-4 py-8 text-center text-sm text-ink-muted">
          На этот день ничего нет
        </p>
      ) : (
        <div className="space-y-4">
          {sections.map(({ zone, items }) => (
            <section key={zone.id ?? 'unassigned'}>
              <h3 className="text-sm font-semibold text-ink">{zone.name}</h3>
              <ul className="mt-1.5 space-y-1.5">
                {items.map((item) => {
                  const vehicle = [item.vehicle_make, item.vehicle_model].filter(Boolean).join(' ')
                    || (item.vehicle && item.vehicle !== '—' ? item.vehicle : '');
                  return (
                    <li key={plannerItemKey(item)}>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onItemClick(item);
                        }}
                        className="flex w-full items-start gap-3 rounded-sg border border-line bg-surface px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
                      >
                        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${plannerItemBarColor(item)}`} />
                        <span className="w-16 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-ink-soft">
                          {plannerItemMobileTimeLabel(item, dayIso)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                              {item.client_name || '—'}
                            </span>
                            {item.kind === 'inspection' ? (
                              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-success-700">
                                Осмотр
                              </span>
                            ) : (
                              <OrderStatusBadge status={item.status} className="shrink-0" noRing />
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-sm text-ink-muted">
                            {vehicle || '—'}
                            {item.kind === 'inspection' && item.client_phone ? ` · ${item.client_phone}` : ''}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}

function PlannerViewModeSwitch({ viewMode, onChange }) {
  const modes = [
    {
      id: 'week',
      label: 'Недельная сетка',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" d="M4 7h9M4 12h16M4 17h6" />
        </svg>
      ),
    },
    {
      id: 'compact',
      label: 'Календарь',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="relative ml-1 hidden shrink-0 items-center rounded-sg-sm bg-surface p-0.5 ring-1 ring-line/80 md:inline-flex"
      role="group"
      aria-label="Вид планировщика"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0.5 top-0.5 h-7 w-7 rounded-sg-sm bg-brand-600 shadow-sg-sm transition-transform duration-200"
        style={{ transform: viewMode === 'compact' ? 'translateX(100%)' : 'translateX(0)' }}
      />
      {modes.map((mode) => {
        const active = viewMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            aria-pressed={active}
            aria-label={mode.label}
            title={mode.label}
            className={`relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-sg-sm transition-colors ${
              active ? 'text-white' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {mode.icon}
          </button>
        );
      })}
    </div>
  );
}

function WeekToolbar({
  weekRangeLabel,
  selectedDateIso,
  viewMode,
  onViewModeChange,
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
      <PlannerViewModeSwitch viewMode={viewMode} onChange={onViewModeChange} />
    </div>
  );
}

function MobileDayPlanner({
  dayHeaders,
  zones,
  todayIso,
  selectedDayIso,
  onSelectDay,
  onSwipeDay,
  onItemClick,
  onCellContextMenu,
  onAddInZone,
  canEditZone,
  loading,
}) {
  const touchStartRef = useRef(null);

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (event) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    onSwipeDay?.(dx < 0 ? 1 : -1);
  };

  return (
    <div
      className="md:hidden touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        touchStartRef.current = null;
      }}
    >
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
            const orders = plannerZoneDayItems(zone, selectedDayIso);
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
                  {onAddInZone && (canEditZone ? canEditZone(zone.id ?? null) : true) ? (
                    <button
                      type="button"
                      onClick={() => onAddInZone({ dayIso: selectedDayIso, zoneId: zone.id ?? null })}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1 rounded-full border border-brand-200/80 bg-brand-50/60 text-xs font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-100 active:bg-brand-100 lg:w-auto lg:pl-2.5 lg:pr-3"
                      aria-label={`Добавить в ${zone.name}`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                      </svg>
                      <span className="hidden lg:inline">Запись</span>
                    </button>
                  ) : null}
                </div>
                {orders.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {orders.map((order) => (
                      <li key={plannerItemKey(order)}>
                        <button
                          type="button"
                          onClick={() => onItemClick(order)}
                          className={`flex w-full min-h-11 items-start gap-3 rounded-sg px-3 py-2.5 text-left transition ${plannerItemStyle(order)}`}
                        >
                          <span className="w-14 shrink-0 pt-0.5 text-sm font-semibold tabular-nums">
                            {plannerItemMobileTimeLabel(order, selectedDayIso)}
                          </span>
                          {order.kind === 'inspection' ? (
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {order.client_name || '—'}
                              </span>
                              <span className="mt-0.5 block truncate text-sm opacity-80">
                                {order.client_phone || '—'}
                              </span>
                            </span>
                          ) : (
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                  {order.vehicle && order.vehicle !== '—' ? order.vehicle : 'Авто'}
                                </span>
                                <OrderStatusBadge status={order.status} className="shrink-0" noRing />
                              </span>
                              <span className="mt-0.5 block truncate text-sm opacity-80">
                                {order.client_name || '—'}
                                {order.client_phone ? ` · ${order.client_phone}` : ''}
                              </span>
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
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
  const location = useLocation();
  const { isReady, isAuthenticated } = useAuthReady();
  const {
    loaded: permissionsLoaded,
    canEditZone,
    anyEditable,
  } = usePlannerWorkZonePermissions(isReady && isAuthenticated);
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
  const [viewMode, setViewMode] = useState(readPlannerViewMode);
  const [dayModalIso, setDayModalIso] = useState(null);

  const changeViewMode = (next) => {
    setViewMode(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PLANNER_VIEW_STORAGE_KEY, next);
    }
  };

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
    setDayModalIso(null);
    const nextWeekStart = addDays(weekStart, delta * 7);
    setWeekStart(nextWeekStart);
    const startIso = toIsoDate(nextWeekStart);
    const endIso = toIsoDate(addDays(nextWeekStart, 6));
    setSelectedDayIso(todayIso >= startIso && todayIso <= endIso ? todayIso : startIso);
  };

  const jumpToDate = (isoDate) => {
    if (!isoDate) return;
    setDayModalIso(null);
    const [y, m, d] = String(isoDate).split('-').map(Number);
    if (!y || !m || !d) return;
    setWeekStart(getWeekStart(new Date(y, m - 1, d)));
    setSelectedDayIso(isoDate);
  };

  const beginCreateOrder = useCallback((ctx) => {
    const dayIso = ctx?.dayIso || todayIso;
    navigate('/autoservice/orders/new', {
      state: withBackTo(location, {
        scheduledAtLocal: `${dayIso}T10:00`,
        ...(ctx?.zoneId != null ? { workZoneId: ctx.zoneId } : {}),
      }),
    });
  }, [navigate, location, todayIso]);

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

  const shiftDay = (delta) => {
    const [y, m, d] = String(activeDayIso).split('-').map(Number);
    if (!y || !m || !d) return;
    const next = addDays(new Date(y, m - 1, d), delta);
    const nextIso = toIsoDate(next);
    if (dayIsos.length === 7 && (nextIso < dayIsos[0] || nextIso > dayIsos[6])) {
      setWeekStart(getWeekStart(next));
    }
    setSelectedDayIso(nextIso);
  };

  const resolvedCreateContext = createContext || { dayIso: activeDayIso, zoneId: null };
  const contextMenuContext = contextMenu
    ? { dayIso: contextMenu.dayIso, zoneId: contextMenu.zoneId }
    : null;

  return (
    <div className="min-w-0 lg:-mr-6">
      <div className="mb-3 flex flex-col gap-3 md:mb-5 md:flex-row md:items-center md:justify-between">
        <h1 className="max-md:hidden text-xl font-bold text-ink sm:text-2xl">Планировщик</h1>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <button
            type="button"
            onClick={handleOpenCreate}
            disabled={permissionsLoaded && !anyEditable}
            title={
              permissionsLoaded && !anyEditable
                ? 'Нет рабочих зон с правом редактирования'
                : undefined
            }
            className="inline-flex h-11 w-full items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-base font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 md:h-10 md:w-auto md:text-sm"
          >
            Создать
          </button>
          <WeekToolbar
            weekRangeLabel={weekRangeLabel}
            selectedDateIso={selectedDateIso}
            viewMode={viewMode}
            onViewModeChange={changeViewMode}
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

      <Toast message={error} variant="error" onClose={() => setError('')} />

      <MobileDayPlanner
        dayHeaders={dayHeaders}
        zones={zones}
        todayIso={todayIso}
        selectedDayIso={activeDayIso}
        onSelectDay={setSelectedDayIso}
        onSwipeDay={shiftDay}
        onItemClick={handlePlannerItemClick}
        onCellContextMenu={handleCellContextMenu}
        onAddInZone={openCreateChoice}
        canEditZone={canEditZone}
        loading={loading}
      />

      {viewMode === 'compact' ? (
        <PlannerCompactWeek
          zones={zones}
          dayHeaders={dayHeaders}
          todayIso={todayIso}
          loading={loading}
          onDayOpen={setDayModalIso}
        />
      ) : (
        <PlannerWeekGrid
          zones={zones}
          dayHeaders={dayHeaders}
          dayIsos={dayIsos}
          todayIso={todayIso}
          loading={loading}
          onItemClick={handlePlannerItemClick}
          onCellContextMenu={handleCellContextMenu}
        />
      )}

      {loading ? (
        <p className="mt-3 hidden text-sm text-ink-muted md:block" aria-live="polite">
          Загрузка…
        </p>
      ) : null}

      <RepairOrderViewModal
        order={viewOrder}
        loading={viewOrderLoading}
        enablePayment
        onOrderChange={(updated) => {
          setViewOrder(updated);
          load();
        }}
        onClose={() => {
          setViewOrder(null);
          setViewOrderLoading(false);
        }}
        onEdit={
          viewOrder && canEditZone(viewOrder.work_zone_id)
            ? (order) => {
                setViewOrder(null);
                navigate(`/autoservice/orders/${order.id}/edit`, { state: withBackTo(location) });
              }
            : undefined
        }
      />

      <PlannerCreateChoiceModal
        open={createChoiceOpen}
        onClose={() => setCreateChoiceOpen(false)}
        canEdit={canEditZone(resolvedCreateContext.zoneId)}
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
        canEdit={contextMenu ? canEditZone(contextMenu.zoneId) : true}
        onCreateInspection={() => beginCreateInspection(contextMenuContext)}
      />

      <PlannerDayModal
        open={Boolean(dayModalIso)}
        dayIso={dayModalIso}
        zones={zones}
        onClose={() => setDayModalIso(null)}
        onItemClick={handlePlannerItemClick}
      />

      <InspectionBookingAddModal
        open={inspectionModalOpen}
        onClose={() => setInspectionModalOpen(false)}
        initialPreferredDate={inspectionPrefillDate}
        workZoneId={inspectionPrefillZoneId}
        zones={zones}
        canEdit={anyEditable}
        onCreated={() => {
          setInspectionModalOpen(false);
          load();
        }}
      />

      <InspectionBookingAddModal
        open={Boolean(viewInspection)}
        onClose={() => setViewInspection(null)}
        zones={zones}
        canEdit={canEditZone(viewInspection?.work_zone_id)}
        onCreateOrder={(booking) => {
          setViewInspection(null);
          navigate('/autoservice/orders/new', {
            state: withBackTo(location, {
              scheduledAtLocal: `${booking.preferred_date}T${booking.preferred_time?.slice(0, 5) || '10:00'}`,
              workZoneId: booking.work_zone_id,
              clientId: booking.client_id,
              vehicleId: booking.garage_vehicle_id,
              clientName: booking.name,
              clientPhone: booking.phone,
              vehicleMake: booking.vehicle_make,
              inspectionBookingId: booking.id,
            }),
          });
        }}
        initialBooking={
          viewInspection
            ? {
                id: viewInspection.id,
                client_id: viewInspection.client_id,
                garage_vehicle_id: viewInspection.garage_vehicle_id,
                name: viewInspection.client_name,
                phone: viewInspection.client_phone,
                preferred_date: toDateInputValue(viewInspection.scheduled_at),
                preferred_time: viewInspection.preferred_time,
                vehicle_make: viewInspection.vehicle_make,
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
        onDeleted={() => {
          setViewInspection(null);
          load();
        }}
      />
    </div>
  );
}
