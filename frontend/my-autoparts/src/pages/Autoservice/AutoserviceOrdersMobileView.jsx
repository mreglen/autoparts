import { useState } from 'react';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';
import { RepairOrderStatusPicker, vehicleLabel } from '../../components/Autoservice/RepairOrderViewModal';
import { Skeleton, UnderlineTabs } from '../../components/UI';
import { repairOrderNumberLabel } from '../../utils/autoserviceOrderDisplay';

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
      buttonClassName="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-wait disabled:opacity-60"
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

function OrderMobileRow({
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
  formatDateTime,
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const menuOpen = statusOpen || actionsOpen;
  const zone = row.work_zone?.name;
  const when = formatDateTime(row.scheduled_at);

  return (
    <div className={`py-3 ${menuOpen ? 'relative z-30' : ''}`}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={onView} className="min-w-0 flex-1 text-left">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
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
          <p className="mt-1.5 line-clamp-2 text-sm font-medium text-gray-800">{vehicleLabel(row.vehicle)}</p>
          <p className="mt-0.5 truncate text-sm text-gray-800">{row.client?.name || '—'}</p>
          {row.client?.phone ? (
            <p className="mt-0.5 truncate text-sm text-gray-500">{row.client.phone}</p>
          ) : null}
          <p className="mt-1 text-xs text-gray-500">
            {when}
            {zone ? ` · ${zone}` : ''}
          </p>
        </button>
        <div className="shrink-0">
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
      </div>
    </div>
  );
}

/**
 * Mobile shell for /autoservice/orders — horizontal padding from cabinet layout (same as clients).
 */
export default function AutoserviceOrdersMobileView({
  pageSubtitle,
  showCreateButton,
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
  onRefresh,
  error,
  rows,
  emptyMessage,
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
  formatDateTime,
}) {
  return (
    <div className="w-full min-w-0">
      <p className="text-sm text-gray-500">{pageSubtitle}</p>

      {showCreateButton ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Новый заказ-наряд
        </button>
      ) : null}

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
            onClick={onRefresh}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
            title="Обновить"
            aria-label="Обновить"
          >
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
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

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 border-t border-gray-100">
        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`msk-${i}`} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-11 w-11 rounded-lg" />
              </div>
            ))}
          </div>
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
                onEdit={() => onEdit(row)}
                onDuplicate={onDuplicate ? () => onDuplicate(row) : undefined}
                onDelete={() => onDelete(row)}
                onApprove={onApprove ? () => onApprove(row) : undefined}
                duplicating={duplicatingId === row.id}
                approveSaving={approvingId === row.id}
                formatDateTime={formatDateTime}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
