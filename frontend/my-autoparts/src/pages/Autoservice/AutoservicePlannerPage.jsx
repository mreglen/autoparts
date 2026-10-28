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
  plannerHeadShift,
  plannerInspectionSegment,
  sortDayOrders,
  toIsoDate,
} from '../../utils/autoservicePlannerLayout';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const PLANNER_VIEW_STORAGE_KEY = 'plannerViewMode';
// Календарь на месяц скрыт по просьбе заказчика — переключатель и месячный режим возвращаются этим флагом.
const PLANNER_MONTH_VIEW_ENABLED = false;

function readPlannerViewMode() {
  if (typeof localStorage === 'undefined' || !PLANNER_MONTH_VIEW_ENABLED) return 'week';
  return localStorage.getItem(PLANNER_VIEW_STORAGE_KEY) === 'month' ? 'month' : 'week';
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

function plannerInspectionTitleLabel(item) {
  const date = parseWallClockDate(item?.inspection_scheduled_at);
  if (!date) return '';
  const clock = date.getHours() || date.getMinutes()
    ? date.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : '';
  return `Осмотр ${[formatDayHeader(toIsoDate(date)), clock].filter(Boolean).join(' ')}`;
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

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatMonthLabel(date) {
  const label = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function buildMonthGridIsos(monthStartDate) {
  const first = getMonthStart(monthStartDate);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const gridEnd = addDays(last, (6 - last.getDay() + 7) % 7);
  const isos = [];
  for (let cursor = getWeekStart(first); cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    isos.push(toIsoDate(cursor));
  }
  return isos;
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

function PlannerZoneWeekRow({
  zone,
  dayIsos,
  todayIso,
  onItemClick,
  onCellContextMenu,
  highlightKey,
  onClearHighlight,
}) {
  const entries = useMemo(
    () => assignPlannerLanes((zone.days || []).flatMap((day) => day.orders || []), dayIsos),
    [zone.days, dayIsos],
  );
  const dimmed = Boolean(highlightKey);

  const handleCellContextMenu = (dayIso) => (event) => {
    event.preventDefault();
    if (dimmed) {
      onClearHighlight?.();
      return;
    }
    onCellContextMenu?.({ x: event.clientX, y: event.clientY, dayIso, zoneId: zone.id ?? null });
  };

  const handleCellClick = (dayIso) => (event) => {
    if (dimmed) {
      onClearHighlight?.();
      return;
    }
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
      <div
        className={`sticky left-0 z-10 border-b border-r border-line bg-surface px-3 py-2.5 text-sm font-medium leading-snug text-ink transition-opacity ${
          dimmed ? 'opacity-45' : ''
        }`}
      >
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
                } ${dimmed ? 'opacity-45' : ''}`}
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
              const segment = plannerInspectionSegment(entry);
              const itemTitle = [
                item.kind === 'inspection' ? 'Осмотр' : `№ ${item.order_number}`,
                clientName,
                titleVehicle,
                segment ? plannerInspectionTitleLabel(item) : '',
              ].filter(Boolean).join(' · ');
              const isHighlighted = dimmed && plannerItemKey(item) === highlightKey;
              const isFaded = dimmed && !isHighlighted;
              return (
                <button
                  key={plannerItemKey(item)}
                  data-planner-key={plannerItemKey(item)}
                  type="button"
                  onClick={() => {
                    if (isFaded) {
                      onClearHighlight?.();
                      return;
                    }
                    onItemClick(item);
                  }}
                  className={`pointer-events-auto relative mx-0.5 my-px min-w-0 overflow-hidden rounded-sg-sm px-2 py-1.5 text-left text-[11px] font-semibold leading-tight transition sm:mx-1 sm:my-0.5 sm:text-xs ${styleClass} ${
                    entry.continuesPastWeek ? 'rounded-r-none' : ''
                  } ${entry.continuesFromPrevWeek ? 'rounded-l-none' : ''} ${
                    isFaded ? 'opacity-30' : ''
                  } ${isHighlighted ? 'z-10 ring-2 ring-ink' : ''}`}
                  style={{
                    gridColumn: `${entry.subStart + 1} / ${entry.subEnd + 2}`,
                    gridRow: entry.lane + 1,
                  }}
                  title={itemTitle}
                >
                  {segment ? (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 bg-success-600/55"
                      style={{ left: `${segment.leftPercent}%`, width: `${segment.widthPercent}%` }}
                    />
                  ) : null}
                  <span className="relative block truncate tabular-nums">{plannerBarTimeLabel(entry, dayIsos)}</span>
                  <span className="relative mt-0.5 block truncate font-normal">{nameWithVehicle}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const MONTH_MAX_BARS = 5;
const UNASSIGNED_ZONE_LABEL = 'Без рабочей зоны';

function PlannerWeekGrid({
  zones,
  dayHeaders,
  dayIsos,
  todayIso,
  loading,
  onItemClick,
  onCellContextMenu,
  highlightKey,
  onClearHighlight,
}) {
  const gridRef = useRef(null);
  const zoneHeadRef = useRef(null);
  const chromeRef = useRef(null);

  // Горизонтальный скролл-контейнер ниже блокировал бы CSS sticky, поэтому шапку сдвигает transform.
  useEffect(() => {
    const grid = gridRef.current;
    const zoneHead = zoneHeadRef.current;
    const chrome = chromeRef.current;
    if (!grid || !zoneHead || !chrome) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const shift = plannerHeadShift({
        chromeHeight: chrome.offsetHeight,
        gridTop: grid.getBoundingClientRect().top,
        gridHeight: grid.offsetHeight,
        headHeight: zoneHead.offsetHeight,
      });
      grid.style.setProperty('--sg-planner-head-shift', `${shift}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [dayIsos, zones]);

  const headTransform = 'translateY(var(--sg-planner-head-shift, 0px))';

  return (
    <div className="hidden overflow-x-auto md:block">
      <div
        ref={chromeRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 h-[var(--sg-mobile-header-h)] w-0 lg:h-[var(--sg-desktop-header-h)]"
      />
      <div className="min-w-[52rem] overflow-hidden rounded-sg-lg border border-line bg-surface shadow-sm">
        <div
          ref={gridRef}
          className="grid w-full"
          style={{ gridTemplateColumns: 'minmax(5rem, 7.3rem) repeat(7, minmax(6.5rem, 1fr))' }}
        >
          <div
            ref={zoneHeadRef}
            style={{ transform: headTransform }}
            className={`sticky left-0 z-30 border-b border-r border-line bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted transition-opacity ${
              highlightKey ? 'opacity-45' : ''
            }`}
          >
            Зона
          </div>
          {dayHeaders.map((day, index) => {
            const iso = String(day.date).slice(0, 10);
            const isToday = iso === todayIso;
            const isWeekend = index >= 5;
            return (
              <div
                key={iso}
                style={{ transform: headTransform }}
                className={`z-20 border-b border-r border-line px-2 py-2 text-center transition-opacity ${
                  highlightKey ? 'opacity-45' : ''
                } ${
                  isToday
                    ? 'bg-brand-50 text-brand-800'
                    : isWeekend
                      ? 'bg-danger-50 text-ink-muted'
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
                highlightKey={highlightKey}
                onClearHighlight={onClearHighlight}
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

function PlannerMonthCalendar({
  dayIsos,
  itemsByDay,
  monthIso,
  todayIso,
  onDayOpen,
  highlightKey,
  highlightDayIso,
  onClearHighlight,
}) {
  return (
    <div className="overflow-hidden rounded-sg-lg border border-line bg-surface shadow-sm">
      <div className="grid grid-cols-7 border-b border-line bg-surface-muted">
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            className={`py-2 text-center text-xs font-semibold uppercase tracking-wide ${
              index >= 5 ? 'text-danger-700' : 'text-ink-muted'
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dayIsos.map((iso, index) => {
          const items = itemsByDay[iso] || [];
          const bars = items.slice(0, MONTH_MAX_BARS);
          const hiddenCount = items.length - bars.length;
          const isToday = iso === todayIso;
          const inMonth = iso.slice(0, 7) === monthIso;
          const isWeekend = index % 7 >= 5;
          const isHighlightDay = Boolean(highlightKey) && highlightDayIso === iso;
          const isFadedDay = Boolean(highlightKey) && !isHighlightDay;
          const background = isToday
            ? 'bg-brand-50/60'
            : !inMonth
              ? 'bg-surface-muted/50'
              : isWeekend
                ? 'bg-danger-50/40'
                : 'bg-surface';
          return (
            <button
              key={iso}
              type="button"
              onClick={() => {
                if (isFadedDay) {
                  onClearHighlight?.();
                  return;
                }
                onDayOpen(iso);
              }}
              title={`${formatDayModalTitle(iso)} · ${items.length ? `${items.length} на этот день` : 'свободно'}`}
              className={`flex min-h-16 flex-col gap-1 border-b border-r border-line-soft p-1.5 text-left transition hover:bg-surface-subtle/70 md:min-h-20 ${background} ${
                isFadedDay ? 'opacity-40' : ''
              } ${isHighlightDay ? 'bg-brand-50/70 ring-2 ring-inset ring-ink' : ''}`}
            >
              <span
                className={`text-xs font-semibold leading-none tabular-nums ${
                  isToday ? 'text-brand-800' : inMonth ? 'text-ink-soft' : 'text-ink-faint'
                }`}
              >
                {Number(iso.slice(8, 10))}
              </span>
              <span className="flex flex-col gap-[3px]">
                {bars.map((item) => (
                  <span
                    key={plannerItemKey(item)}
                    className={`h-[3px] w-full rounded-full transition-opacity ${plannerItemBarColor(item)} ${
                      highlightKey && plannerItemKey(item) !== highlightKey ? 'opacity-25' : ''
                    }`}
                  />
                ))}
                {hiddenCount > 0 ? (
                  <span className="text-[10px] leading-none text-ink-faint">+{hiddenCount}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function plannerMonthZoneSections(items) {
  const sections = new Map();
  items.forEach((item) => {
    const key = item.work_zone_id ?? 'unassigned';
    if (!sections.has(key)) {
      sections.set(key, {
        key,
        name: item.work_zone_name || UNASSIGNED_ZONE_LABEL,
        items: [],
      });
    }
    sections.get(key).items.push(item);
  });
  return [...sections.values()];
}

function PlannerDayModal({ open, dayIso, sections, onClose, onItemClick }) {
  const visibleSections = (sections || []).filter((section) => section.items.length > 0);

  return (
    <Modal open={open} onClose={onClose} title={dayIso ? formatDayModalTitle(dayIso) : ''} size="md">
      {visibleSections.length === 0 ? (
        <p className="rounded-sg border border-dashed border-line-strong bg-surface px-4 py-8 text-center text-sm text-ink-muted">
          На этот день ничего нет
        </p>
      ) : (
        <div className="space-y-4">
          {visibleSections.map(({ key, name, items }) => (
            <section key={key}>
              <h3 className="text-sm font-semibold text-ink">{name}</h3>
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
      id: 'month',
      label: 'Календарь на месяц',
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
      className="relative ml-0.5 inline-flex shrink-0 items-center rounded-sg-sm bg-surface p-0.5 ring-1 ring-line/80"
      role="group"
      aria-label="Вид планировщика"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0.5 top-0.5 h-7 w-7 rounded-sg-sm bg-brand-600 shadow-sg-sm transition-transform duration-200"
        style={{ transform: viewMode === 'month' ? 'translateX(100%)' : 'translateX(0)' }}
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

const PLANNER_SEARCH_MIN_CHARS = 2;
const PLANNER_SEARCH_DEBOUNCE_MS = 250;

function plannerItemVehicleLabel(item) {
  const fromParts = [item?.vehicle_make, item?.vehicle_model].filter(Boolean).join(' ');
  if (fromParts) return fromParts;
  return item?.vehicle && item.vehicle !== '—' ? item.vehicle : '';
}

function plannerSearchDateLabel(item) {
  const start = parseWallClockDate(item?.scheduled_at);
  if (!start) return '—';
  const day = start.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  const clock = item.kind === 'inspection'
    ? item.preferred_time?.slice(0, 5)
    : start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return clock ? `${day} · ${clock}` : day;
}

function PlannerSearchBox({ query, onQueryChange, onPick, highlightKey, open, setOpen }) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef(null);
  const requestIdRef = useRef(0);
  const term = query.trim();

  useEffect(() => {
    if (term.length < PLANNER_SEARCH_MIN_CHARS) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setSearching(true);
    setOpen(true);
    const timer = setTimeout(async () => {
      let data = [];
      try {
        data = await apiRequest(`/autoservice/planner/search?q=${encodeURIComponent(term)}`);
      } catch {
        data = [];
      }
      if (requestIdRef.current !== requestId) return;
      setResults(data || []);
      setSearching(false);
    }, PLANNER_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [setOpen, term]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [setOpen]);

  const showDropdown = open && term.length >= PLANNER_SEARCH_MIN_CHARS;

  return (
    <div ref={boxRef} className="relative min-w-0 flex-1 md:max-w-sm">
      <div className="flex h-11 items-center gap-2 rounded-sg bg-surface px-3 shadow-sm ring-1 ring-line/80 transition focus-within:ring-brand md:h-10">
        <svg className="h-4 w-4 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Поиск по клиенту или автомобилю"
          aria-label="Поиск по планировщику"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        {searching ? <span className="shrink-0 text-xs text-ink-faint">…</span> : null}
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="Очистить поиск"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-faint transition hover:bg-surface-subtle hover:text-ink"
          >
            ×
          </button>
        ) : null}
      </div>

      {showDropdown ? (
        <div
          data-planner-search="dropdown"
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-sg-lg border border-line bg-surface shadow-lg"
        >
          {!searching && results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted">Ничего не найдено</p>
          ) : null}
          {searching && results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-muted" aria-live="polite">Поиск…</p>
          ) : null}
          {results.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((item) => {
                const key = plannerItemKey(item);
                const vehicle = plannerItemVehicleLabel(item);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => onPick(item)}
                      className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition hover:bg-brand-50/60 ${
                        key === highlightKey ? 'bg-brand-50/70' : ''
                      }`}
                    >
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${plannerItemBarColor(item)}`} />
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
                          {[vehicle, item.work_zone_name].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </span>
                      <span className="shrink-0 pt-0.5 text-xs font-medium tabular-nums text-ink-soft">
                        {plannerSearchDateLabel(item)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function WeekToolbar({
  periodLabel,
  selectedDateIso,
  viewMode,
  onViewModeChange,
  onPrev,
  onNext,
  onToday,
  onJumpDate,
}) {
  const periodWord = viewMode === 'month' ? 'месяц' : 'неделя';
  return (
    <div className="inline-flex w-full items-center gap-1 rounded-sg bg-surface-subtle p-1 md:w-auto">
      <button
        type="button"
        onClick={onPrev}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sg-sm text-ink-muted transition hover:bg-surface hover:text-ink md:h-9 md:w-9"
        aria-label={`Предыдущий ${periodWord}`}
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
        {periodLabel}
      </span>
      <span className="hidden min-w-[9rem] px-2 text-center text-sm font-medium text-ink md:inline">
        {periodLabel}
      </span>
      <button
        type="button"
        onClick={onNext}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sg-sm text-ink-muted transition hover:bg-surface hover:text-ink md:h-9 md:w-9"
        aria-label={`Следующий ${periodWord}`}
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
          aria-label={`Перейти к ${periodWord === 'месяц' ? 'месяцу' : 'неделе'} по дате`}
        />
      </label>
      {PLANNER_MONTH_VIEW_ENABLED ? (
        <PlannerViewModeSwitch viewMode={viewMode} onChange={onViewModeChange} />
      ) : null}
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
  highlightKey,
  onClearHighlight,
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
                          data-planner-key={plannerItemKey(order)}
                          onClick={() => {
                            if (highlightKey && plannerItemKey(order) !== highlightKey) {
                              onClearHighlight?.();
                              return;
                            }
                            onItemClick(order);
                          }}
                          className={`flex w-full min-h-11 items-start gap-3 rounded-sg px-3 py-2.5 text-left transition ${plannerItemStyle(order)} ${
                            highlightKey && plannerItemKey(order) !== highlightKey ? 'opacity-40' : ''
                          } ${
                            highlightKey && plannerItemKey(order) === highlightKey
                              ? 'ring-2 ring-ink ring-offset-1 ring-offset-surface'
                              : ''
                          }`}
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
  const [monthStart, setMonthStart] = useState(() => getMonthStart(today));
  const [plannerData, setPlannerData] = useState(null);
  const [monthData, setMonthData] = useState(null);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [highlight, setHighlight] = useState(null);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [pendingFocusKey, setPendingFocusKey] = useState(null);

  const changeViewMode = (next) => {
    setViewMode(next);
    setDayModalIso(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PLANNER_VIEW_STORAGE_KEY, next);
    }
  };

  const weekStartIso = toIsoDate(weekStart);
  const monthStartIso = toIsoDate(monthStart);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (viewMode === 'month') {
        const data = await apiRequest(`/autoservice/planner/month?month_start=${monthStartIso}`);
        setMonthData(data);
      } else {
        const data = await apiRequest(`/autoservice/planner/week?week_start=${weekStartIso}`);
        setPlannerData(data);
      }
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить планировщик');
      if (viewMode === 'month') setMonthData(null);
      else setPlannerData(null);
    } finally {
      setLoading(false);
    }
  }, [viewMode, weekStartIso, monthStartIso]);

  useEffect(() => {
    if (isReady && isAuthenticated) load();
  }, [isReady, isAuthenticated, load]);

  // Выбор из поиска: подстраиваем страницу под нужную полосу, а выпадающий список
  // закрываем только когда он оказывается прямо над подсвеченной позицией.
  useEffect(() => {
    if (!pendingFocusKey || loading || highlight?.key !== pendingFocusKey) return undefined;
    const bars = Array.from(document.querySelectorAll(`[data-planner-key="${pendingFocusKey}"]`));
    const bar = bars.find((el) => el.offsetHeight > 0);
    if (!bar) return undefined;
    setPendingFocusKey(null);
    bar.scrollIntoView({ block: 'center', inline: 'nearest' });
    const dropdown = document.querySelector('[data-planner-search="dropdown"]');
    if (!dropdown) return undefined;
    const overlay = dropdown.getBoundingClientRect();
    const target = bar.getBoundingClientRect();
    const covered = target.left < overlay.right
      && target.right > overlay.left
      && target.top < overlay.bottom
      && target.bottom > overlay.top;
    if (covered) setSearchDropdownOpen(false);
    return undefined;
  }, [pendingFocusKey, loading, highlight]);

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
    setHighlight(null);
    const nextWeekStart = addDays(weekStart, delta * 7);
    setWeekStart(nextWeekStart);
    const startIso = toIsoDate(nextWeekStart);
    const endIso = toIsoDate(addDays(nextWeekStart, 6));
    setSelectedDayIso(todayIso >= startIso && todayIso <= endIso ? todayIso : startIso);
  };

  const shiftMonth = (delta) => {
    setDayModalIso(null);
    setHighlight(null);
    const nextMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + delta, 1);
    setMonthStart(nextMonthStart);
    const firstIso = toIsoDate(nextMonthStart);
    const lastIso = toIsoDate(new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth() + 1, 0));
    setSelectedDayIso(todayIso >= firstIso && todayIso <= lastIso ? todayIso : firstIso);
  };

  const shiftPeriod = (delta) => {
    if (viewMode === 'month') shiftMonth(delta);
    else shiftWeek(delta);
  };

  const goToday = () => {
    setDayModalIso(null);
    setHighlight(null);
    setWeekStart(getWeekStart(today));
    setMonthStart(getMonthStart(today));
    setSelectedDayIso(todayIso);
  };

  const jumpToDate = (isoDate) => {
    if (!isoDate) return;
    setDayModalIso(null);
    setHighlight(null);
    const [y, m, d] = String(isoDate).split('-').map(Number);
    if (!y || !m || !d) return;
    const target = new Date(y, m - 1, d);
    setWeekStart(getWeekStart(target));
    setMonthStart(getMonthStart(target));
    setSelectedDayIso(isoDate);
  };

  const handleSearchQueryChange = (value) => {
    setSearchQuery(value);
    setHighlight(null);
  };

  const clearPlannerHighlight = () => {
    setSearchQuery('');
    setHighlight(null);
  };

  const handleSearchPick = (item) => {
    const iso = String(item.scheduled_at).slice(0, 10);
    jumpToDate(iso);
    const key = plannerItemKey(item);
    setHighlight({ key, dayIso: iso });
    setPendingFocusKey(key);
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
  const dayIsos = dayHeaders.map((day) => String(day.date).slice(0, 10));

  const monthGrid = monthData?.days || [];
  const monthDayIsos = monthGrid.length
    ? monthGrid.map((day) => String(day.date).slice(0, 10))
    : buildMonthGridIsos(monthStart);
  const monthItems = monthGrid.flatMap((day) => day.orders || []);
  const monthItemsByDay = {};
  monthDayIsos.forEach((iso) => {
    monthItemsByDay[iso] = sortDayOrders(
      monthItems.filter((item) => plannerItemCoversDay(item, iso)),
    );
  });

  const highlightExists = viewMode === 'month'
    ? monthItems.some((item) => plannerItemKey(item) === highlight?.key)
    : zones.some((zone) => (zone.days || []).some((day) => (day.orders || [])
      .some((item) => plannerItemKey(item) === highlight?.key)));
  const activeHighlight = highlight && highlightExists ? highlight : null;

  const visibleDayIsos = viewMode === 'month' ? monthDayIsos : dayIsos;
  const activeDayIso = visibleDayIsos.includes(selectedDayIso)
    ? selectedDayIso
    : (visibleDayIsos.includes(todayIso) ? todayIso : visibleDayIsos[0]);
  const selectedDateIso = viewMode === 'month' ? activeDayIso : toIsoDate(weekStart);
  const periodLabel = viewMode === 'month' ? formatMonthLabel(monthStart) : weekRangeLabel;
  const zonesForForms = viewMode === 'month'
    ? (monthData?.zones || []).map((zone) => ({ id: zone.id, name: zone.name }))
    : zones;

  const dayModalSections = !dayModalIso
    ? []
    : viewMode === 'month'
      ? plannerMonthZoneSections(monthItemsByDay[dayModalIso] || [])
      : zones.map((zone) => ({
          key: zone.id ?? 'unassigned',
          name: zone.name,
          items: plannerZoneDayItems(zone, dayModalIso),
        }));

  const openMonthDay = (iso) => {
    setSelectedDayIso(iso);
    setDayModalIso(iso);
  };

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
        <PlannerSearchBox
          query={searchQuery}
          onQueryChange={handleSearchQueryChange}
          onPick={handleSearchPick}
          highlightKey={activeHighlight?.key || null}
          open={searchDropdownOpen}
          setOpen={setSearchDropdownOpen}
        />

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
            periodLabel={periodLabel}
            selectedDateIso={selectedDateIso}
            viewMode={viewMode}
            onViewModeChange={changeViewMode}
            onPrev={() => shiftPeriod(-1)}
            onNext={() => shiftPeriod(1)}
            onToday={goToday}
            onJumpDate={jumpToDate}
          />
        </div>
      </div>

      <Toast message={error} variant="error" onClose={() => setError('')} />

      {viewMode === 'month' ? (
        <>
          <PlannerMonthCalendar
            dayIsos={monthDayIsos}
            itemsByDay={monthItemsByDay}
            monthIso={monthStartIso}
            todayIso={todayIso}
            onDayOpen={openMonthDay}
            highlightKey={activeHighlight?.key || null}
            highlightDayIso={activeHighlight?.dayIso || null}
            onClearHighlight={clearPlannerHighlight}
          />
          {loading ? (
            <p className="mt-3 text-sm text-ink-muted" aria-live="polite">
              Загрузка…
            </p>
          ) : null}
        </>
      ) : (
        <>
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
            highlightKey={activeHighlight?.key || null}
            onClearHighlight={clearPlannerHighlight}
          />

          <PlannerWeekGrid
            zones={zones}
            dayHeaders={dayHeaders}
            dayIsos={dayIsos}
            todayIso={todayIso}
            loading={loading}
            onItemClick={handlePlannerItemClick}
            onCellContextMenu={handleCellContextMenu}
            highlightKey={activeHighlight?.key || null}
            onClearHighlight={clearPlannerHighlight}
          />

          {loading ? (
            <p className="mt-3 hidden text-sm text-ink-muted md:block" aria-live="polite">
              Загрузка…
            </p>
          ) : null}
        </>
      )}

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
        sections={dayModalSections}
        onClose={() => setDayModalIso(null)}
        onItemClick={handlePlannerItemClick}
      />

      <InspectionBookingAddModal
        open={inspectionModalOpen}
        onClose={() => setInspectionModalOpen(false)}
        initialPreferredDate={inspectionPrefillDate}
        workZoneId={inspectionPrefillZoneId}
        zones={zonesForForms}
        canEdit={anyEditable}
        onCreated={() => {
          setInspectionModalOpen(false);
          load();
        }}
      />

      <InspectionBookingAddModal
        open={Boolean(viewInspection)}
        onClose={() => setViewInspection(null)}
        zones={zonesForForms}
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
              staffComment: booking.notes || '',
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
