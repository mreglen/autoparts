import { useState } from 'react';
import AutoserviceLiveSearchField from './AutoserviceLiveSearchField';
import ActionsDropdown, { ActionsDropdownItem } from '../ActionsDropdown/ActionsDropdown';
import { RepairOrderStatusPicker, vehicleLabel } from './RepairOrderViewModal';
import { Skeleton, UnderlineTabs } from '../UI';
import { formatServerDateTime } from '../../utils/serverDate';
import { repairOrderNumberLabel } from '../../utils/autoserviceOrderDisplay';
import {
  autoserviceListPrimaryButtonClass,
  warehouseEmptyShellClass,
} from '../../utils/warehouseListUi';

function formatDateTime(value) {
  return formatServerDateTime(value);
}

function OrderActionsMenu({
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onApprove,
  duplicating = false,
  approveSaving = false,
  isOpen,
  onOpenChange,
}) {
  return (
    <ActionsDropdown
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      menuClassName="w-52 z-50"
      estimatedMenuHeight={onApprove ? 248 : 204}
      showLabel={false}
      disabled={duplicating || approveSaving}
      buttonClassName="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-wait disabled:opacity-60"
    >
      {onApprove ? (
        <ActionsDropdownItem className="min-h-11" onClick={onApprove} disabled={duplicating || approveSaving}>
          {approveSaving ? 'Принятие…' : 'Принять в работу'}
        </ActionsDropdownItem>
      ) : null}
      <ActionsDropdownItem className="min-h-11" onClick={onView} disabled={duplicating}>
        Просмотр
      </ActionsDropdownItem>
      <ActionsDropdownItem className="min-h-11" onClick={onEdit} disabled={duplicating}>
        Изменить
      </ActionsDropdownItem>
      {onDuplicate ? (
        <ActionsDropdownItem className="min-h-11" onClick={onDuplicate} disabled={duplicating}>
          {duplicating ? 'Копирование…' : 'Скопировать и создать'}
        </ActionsDropdownItem>
      ) : null}
      <ActionsDropdownItem className="min-h-11" onClick={onDelete} disabled={duplicating} danger>
        Удалить
      </ActionsDropdownItem>
    </ActionsDropdown>
  );
}

function OrderMobileCard({
  row,
  statusActions,
  statusSavingId,
  onStatusChange,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onApprove,
  duplicating = false,
  approveSaving = false,
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const menuOpen = statusOpen || actionsOpen;
  const zone = row.work_zone?.name;
  const when = formatDateTime(row.scheduled_at);

  return (
    <article
      className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md ${
        menuOpen ? 'relative z-30' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <button type="button" onClick={onView} className="min-w-0 flex-1 text-left">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="shrink-0 text-base font-semibold tabular-nums text-gray-900">
              {repairOrderNumberLabel(row)}
            </span>
            <RepairOrderStatusPicker
              status={row.status}
              options={statusActions}
              saving={statusSavingId === row.id}
              disabled={statusSavingId === row.id}
              isOpen={statusOpen}
              onOpenChange={setStatusOpen}
              onChange={(nextStatus) => onStatusChange(row.id, nextStatus)}
            />
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-900">{vehicleLabel(row.vehicle)}</p>
          <p className="mt-1 truncate text-sm text-gray-700">{row.client?.name || '—'}</p>
          {row.client?.phone ? (
            <p className="mt-0.5 truncate text-sm text-gray-500">{row.client.phone}</p>
          ) : null}
          <p className="mt-2 text-xs text-gray-500">
            {when}
            {zone ? ` · ${zone}` : ''}
          </p>
        </button>
        <OrderActionsMenu
          onView={onView}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onApprove={onApprove}
          duplicating={duplicating}
          approveSaving={approveSaving}
          isOpen={actionsOpen}
          onOpenChange={setActionsOpen}
        />
      </div>
    </article>
  );
}

function OrderMobileCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-full max-w-[16rem]" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
      </div>
    </div>
  );
}

function emptyMessage(viewHistory, viewReview) {
  if (viewHistory) return 'В истории пока нет заказ-нарядов';
  if (viewReview) return 'Заявок на проверке нет';
  return 'Активных заказ-нарядов нет';
}

export default function AutoserviceOrdersMobileView({
  rows,
  loading,
  pageSubtitle,
  orderTabs,
  tabValue,
  onTabChange,
  q,
  onQueryChange,
  viewHistory,
  viewReview,
  historyStatus,
  onHistoryStatusChange,
  onRefresh,
  onCreate,
  showCreateButton,
  statusActionsForRow,
  onStatusChange,
  statusSavingId,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onApprove,
  duplicatingId,
  approvingId,
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:hidden">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-500">{pageSubtitle}</p>
        {showCreateButton ? (
          <button type="button" onClick={onCreate} className={`${autoserviceListPrimaryButtonClass} min-h-11 w-full`}>
            Новый заказ-наряд
          </button>
        ) : null}
      </div>

      <UnderlineTabs
        ariaLabel="Разделы заказ-нарядов"
        gapClassName="gap-4"
        tabClassName="min-h-11 pb-3 pt-2 text-sm font-medium"
        tabs={orderTabs}
        value={tabValue}
        onChange={onTabChange}
      />

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <AutoserviceLiveSearchField
            value={q}
            onChange={onQueryChange}
            placeholder="Номер, клиент, авто, VIN…"
            ariaLabel="Поиск заказ-нарядов"
          />
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
            title="Обновить"
            aria-label="Обновить"
          >
            <svg
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"
              />
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
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <OrderMobileCardSkeleton key={`order-mobile-sk-${index}`} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className={`${warehouseEmptyShellClass} px-4 py-10 text-sm text-gray-500`}>
          {emptyMessage(viewHistory, viewReview)}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <OrderMobileCard
                row={row}
                statusActions={statusActionsForRow(row)}
                onStatusChange={onStatusChange}
                statusSavingId={statusSavingId}
                onView={() => onView(row)}
                onEdit={() => onEdit(row)}
                onDuplicate={onDuplicate ? () => onDuplicate(row) : undefined}
                onDelete={() => onDelete(row)}
                onApprove={onApprove ? () => onApprove(row) : undefined}
                duplicating={duplicatingId === row.id}
                approveSaving={approvingId === row.id}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
