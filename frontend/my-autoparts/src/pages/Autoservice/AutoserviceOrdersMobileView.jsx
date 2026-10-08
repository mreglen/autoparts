import { useCallback, useRef, useState } from 'react';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import {
  RepairOrderStatusPicker,
  REPAIR_ORDER_STATUS_LABELS,
  vehicleMakeModelLabel,
} from '../../components/Autoservice/RepairOrderViewModal';
import { Skeleton, UnderlineTabs } from '../../components/UI';
import Toast from '../../components/UI/Toast';
import { repairOrderNumberLabel } from '../../utils/autoserviceOrderDisplay';
import { formatServerDate } from '../../utils/serverDate';

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function DraftMobileRow({ draft, onOpen }) {
  const form = draft.form || {};
  const title = draft.mode === 'create'
    ? 'Новый заказ-наряд'
    : `Заказ-наряд №${draft.orderId}`;
  const client = form.clientName || form.pendingClientName?.trim();
  const vehicle = (form.vehicleName
    || [form.pendingVehicleMake, form.pendingVehicleModel]
      .filter(Boolean)
      .join(' '))
    .trim();
  const draftTotal = form.draftTotal != null && !Number.isNaN(Number(form.draftTotal))
    ? Number(form.draftTotal)
    : null;

  return (
    <div className="py-3">
      <button type="button" onClick={onOpen} className="flex w-full min-w-0 items-center gap-3 text-left">
        <span className="w-12 shrink-0 self-center text-center text-base font-semibold tabular-nums text-gray-900">
          {draft.orderId ? `№${draft.orderId}` : '+'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-medium text-gray-900">{title}</span>
            <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              Черновик
            </span>
          </span>
          {vehicle ? (
            <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-800">{vehicle}</p>
          ) : null}
          {client ? <p className="mt-0.5 truncate text-sm text-gray-800">{client}</p> : null}
          {draftTotal != null ? (
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900">
              {formatMoney(draftTotal)} ₽
            </p>
          ) : null}
        </span>
      </button>
    </div>
  );
}

function OrderMobileRow({
  row,
  statusActions,
  statusSavingId,
  onStatusChange,
  onView,
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const when = formatServerDate(row.scheduled_at);

  return (
    <div className={`py-3 ${statusOpen ? 'relative z-30' : ''}`}>
      <button type="button" onClick={onView} className="flex w-full min-w-0 items-center gap-3 text-left">
        <span className="w-12 shrink-0 self-center text-center text-base font-semibold tabular-nums text-gray-900">
          {repairOrderNumberLabel(row)}
        </span>
        <span className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium text-gray-800">{vehicleMakeModelLabel(row.vehicle)}</p>
          <p className="mt-0.5 truncate text-sm text-gray-800">{row.client?.name || '—'}</p>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 self-center">
          <span className="text-xs tabular-nums text-gray-500">{when}</span>
          <RepairOrderStatusPicker
            status={row.status}
            options={statusActions}
            saving={statusSavingId === row.id}
            disabled={statusSavingId === row.id}
            isOpen={statusOpen}
            onOpenChange={setStatusOpen}
            noRing
            onChange={(nextStatus) => onStatusChange(row.id, nextStatus)}
          />
        </span>
      </button>
    </div>
  );
}

/**
 * Mobile shell for /autoservice/orders — horizontal padding from cabinet layout (same as clients).
 */
export default function AutoserviceOrdersMobileView({
  onCreate,
  orderTabs,
  tabValue,
  onTabChange,
  q,
  onSearchChange,
  viewHistory,
  historyStatus,
  onHistoryStatusChange,
  loading,
  error,
  onErrorClose,
  rows,
  hasMore = false,
  loadingMore = false,
  sentinelRef,
  emptyMessage,
  statusActionsForRow,
  onStatusChange,
  statusSavingId,
  onView,
  drafts,
  onDraftOpen,
  dateFrom = '',
  dateTo = '',
  onDateFromChange,
  onDateToChange,
  statusFilter = '',
  onStatusFilterChange,
}) {
  const isDrafts = Array.isArray(drafts);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const swipeStartRef = useRef({ x: 0, y: 0 });
  const handleSwipeStart = useCallback((event) => {
    const touch = event.targetTouches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);
  const handleSwipeEnd = useCallback((event) => {
    const { x, y } = swipeStartRef.current;
    swipeStartRef.current = { x: 0, y: 0 };
    if (!x && !y) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - x;
    const dy = touch.clientY - y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const order = (orderTabs || []).map((tab) => tab.id);
    const index = order.indexOf(tabValue);
    const next = dx < 0 ? index + 1 : index - 1;
    if (index >= 0 && next >= 0 && next < order.length) {
      onTabChange?.(order[next]);
    }
  }, [orderTabs, tabValue, onTabChange]);

  return (
    <div className="-mx-3 min-w-0 px-1.5">
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        Новый заказ-наряд
      </button>

      <UnderlineTabs
        className="mt-4"
        ariaLabel="Разделы заказ-нарядов"
        gapClassName="gap-4"
        tabClassName="min-h-11 pb-3 pt-2 text-sm font-medium"
        tabs={orderTabs}
        value={tabValue}
        onChange={onTabChange}
      />

      <div className="mt-4 flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          <AutoserviceLiveSearchField
            value={q}
            onChange={onSearchChange}
            placeholder="Номер, клиент, авто, VIN…"
            ariaLabel="Поиск заказ-нарядов"
          />
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${filtersOpen ? 'bg-white text-gray-700 ring-2 ring-indigo-400/70' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            aria-expanded={filtersOpen}
          >
            Фильтры
            <svg
              className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        {viewHistory ? (
          <select
            className="h-11 w-full rounded-full border-0 bg-gray-100 px-4 text-base text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-400/70"
            value={historyStatus}
            onChange={(e) => onHistoryStatusChange(e.target.value)}
            aria-label="Фильтр по статусу"
          >
            <option value="">Все статусы</option>
            <option value="completed">Завершён</option>
            <option value="cancelled">Отменён</option>
          </select>
        ) : null}
        {filtersOpen ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="block w-36 min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-medium text-gray-500">Период с</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => onDateFromChange?.(e.target.value)}
                className="h-11 w-full rounded-full border-0 bg-gray-100 px-4 text-base text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-400/70"
              />
            </label>
            <label className="block w-36 min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-medium text-gray-500">Период по</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => onDateToChange?.(e.target.value)}
                className="h-11 w-full rounded-full border-0 bg-gray-100 px-4 text-base text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-400/70"
              />
            </label>
            <label className="block w-full min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-gray-500">Статус</span>
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange?.(e.target.value)}
                className="h-11 w-full rounded-full border-0 bg-gray-100 px-4 text-base text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-400/70"
                aria-label="Фильтр по статусу"
              >
                <option value="">Все статусы</option>
                {['pending', 'in_progress', 'done', 'completed', 'cancelled', 'review'].map((value) => (
                  <option key={value} value={value}>{REPAIR_ORDER_STATUS_LABELS[value]}</option>
                ))}
              </select>
            </label>
            {dateFrom || dateTo || statusFilter ? (
              <button
                type="button"
                onClick={() => {
                  onDateFromChange?.('');
                  onDateToChange?.('');
                  onStatusFilterChange?.('');
                }}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-gray-100 px-4 text-sm font-medium text-gray-500 transition hover:bg-gray-200"
              >
                Сбросить
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Toast message={error} variant="error" onClose={onErrorClose} />

      <div
        className="mt-4 border-t border-gray-100"
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
      >
        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`msk-${i}`} className="flex items-center gap-3 py-3">
                <Skeleton className="h-4 w-12 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : isDrafts ? (
          drafts.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">{emptyMessage}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {drafts.map((draft) => (
                <DraftMobileRow
                  key={draft.key}
                  draft={draft}
                  onOpen={() => onDraftOpen?.(draft)}
                />
              ))}
            </div>
          )
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{emptyMessage}</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((row) => (
              <OrderMobileRow
                key={row.id}
                row={row}
                statusActions={statusActionsForRow(row)}
                onStatusChange={onStatusChange}
                statusSavingId={statusSavingId}
                onView={() => onView(row)}
              />
            ))}
          </div>
        )}
        {!loading && !isDrafts && hasMore ? (
          <div ref={sentinelRef} className="flex justify-center py-3" aria-hidden="true">
            {loadingMore ? <Skeleton className="h-4 w-40" /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
