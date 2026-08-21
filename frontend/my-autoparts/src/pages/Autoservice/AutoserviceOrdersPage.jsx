import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import { useDebouncedValue } from '../../hooks/useDebouncedCallback';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';
import RepairOrderViewModal, { OrderStatusBadge, vehicleLabel } from '../../components/Autoservice/RepairOrderViewModal';
import { Skeleton, UnderlineTabs } from '../../components/UI';
import { ConfirmDialog } from '../../components/UI/Modal';
import { apiRequest } from '../../utils/apiClient';
import { buildRepairOrderDuplicatePayload } from '../../utils/repairOrderDuplicate';
import { formatServerDateTime } from '../../utils/serverDate';
import { repairOrderNumberLabel } from '../../utils/autoserviceOrderDisplay';
import { canReviewRepairOrders } from '../../utils/autoservicePermissions';
import { buildActionsDropdownMenuClassName } from '../../utils/actionsDropdownPlacement';

function formatDateTime(value) {
  return formatServerDateTime(value);
}

function normalizeStatus(status) {
  if (status === 'accepted' || status === 'open') return 'pending';
  if (status === 'ready' || status === 'issued') return 'completed';
  return status;
}

function StatusPicker({ status, options, disabled, saving, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const normalized = normalizeStatus(status);
  const available = options.filter((option) => option.value !== normalized);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (available.length === 0) {
    return <OrderStatusBadge status={status} />;
  }

  return (
    <div ref={rootRef} className="status-picker relative inline-block">
      <button
        type="button"
        disabled={disabled || saving}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((value) => !value);
        }}
        className="rounded-full transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-wait disabled:opacity-60"
        title="Сменить статус"
      >
        <OrderStatusBadge status={status} className={saving ? 'opacity-70' : ''} />
      </button>
      {open ? (
        <div className={buildActionsDropdownMenuClassName(false, 'w-44 z-50')}>
          {available.map((option) => (
            <ActionsDropdownItem
              key={option.value}
              disabled={option.disabled}
              title={option.disabled ? option.disabledTitle : undefined}
              onClick={() => {
                if (option.disabled) return;
                setOpen(false);
                onChange(option.value);
              }}
            >
              {option.label}
            </ActionsDropdownItem>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OrderActionsMenu({
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onApprove,
  duplicating = false,
  approveSaving = false,
  showLabel = true,
}) {
  return (
    <ActionsDropdown
      menuClassName="w-52 z-50"
      estimatedMenuHeight={onApprove ? 248 : 204}
      showLabel={showLabel}
      disabled={duplicating || approveSaving}
      buttonClassName="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-wait disabled:opacity-60"
    >
      {onApprove ? (
        <ActionsDropdownItem onClick={onApprove} disabled={duplicating || approveSaving}>
          {approveSaving ? 'Принятие…' : 'Принять в работу'}
        </ActionsDropdownItem>
      ) : null}
      <ActionsDropdownItem onClick={onView} disabled={duplicating}>Просмотр</ActionsDropdownItem>
      <ActionsDropdownItem onClick={onEdit} disabled={duplicating}>Изменить</ActionsDropdownItem>
      {onDuplicate ? (
        <ActionsDropdownItem onClick={onDuplicate} disabled={duplicating}>
          {duplicating ? 'Копирование…' : 'Скопировать и создать'}
        </ActionsDropdownItem>
      ) : null}
      <ActionsDropdownItem onClick={onDelete} disabled={duplicating} danger>
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
  return (
    <div className="border-b border-gray-100 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onView} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{repairOrderNumberLabel(row)}</span>
            <StatusPicker
              status={row.status}
              options={statusActions}
              saving={statusSavingId === row.id}
              disabled={statusSavingId === row.id}
              onChange={(nextStatus) => onStatusChange(row.id, nextStatus)}
            />
          </div>
          <p className="mt-1 truncate text-sm font-medium text-gray-800">{vehicleLabel(row.vehicle)}</p>
          <p className="mt-0.5 truncate text-sm text-gray-500">
            {row.client?.name || '—'}
            {row.client?.phone ? ` · ${row.client.phone}` : ''}
          </p>
          <p className="mt-1 text-xs text-gray-500">{formatDateTime(row.scheduled_at)}</p>
          {row.work_zone?.name ? (
            <p className="mt-0.5 text-xs text-gray-500">Зона: {row.work_zone.name}</p>
          ) : null}
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
            showLabel={false}
          />
        </div>
      </div>
    </div>
  );
}

export default function AutoserviceOrdersPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const permissionCodes = useSelector((state) => state.auth.permissionCodes);
  const canReview = canReviewRepairOrders(user, permissionCodes || []);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const viewHistory = viewParam === 'history';
  const viewReview = viewParam === 'review';

  const [rows, setRows] = useState([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const qApplied = useDebouncedValue(q);
  const [historyStatus, setHistoryStatus] = useState('');
  const [viewOrder, setViewOrder] = useState(null);
  const [statusSavingId, setStatusSavingId] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const prevScopeKeyRef = useRef(null);

  const scope = viewReview ? 'review' : viewHistory ? 'history' : 'active';

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ scope });
      if (qApplied.trim()) params.set('q', qApplied.trim());
      if (viewHistory && historyStatus) params.set('status', historyStatus);
      const data = await apiRequest(`/autoservice/repair-orders?${params.toString()}`);
      const nextRows = Array.isArray(data) ? data : [];
      setRows(nextRows);
      if (scope === 'review') {
        setReviewCount(nextRows.length);
      } else if (canReview) {
        try {
          const reviewData = await apiRequest('/autoservice/repair-orders?scope=review');
          setReviewCount(Array.isArray(reviewData) ? reviewData.length : 0);
        } catch {
          /* count is optional */
        }
      }
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить записи');
      setRows([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [scope, qApplied, viewHistory, historyStatus, canReview]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    const scopeKey = `${scope}|${historyStatus}`;
    const silent = prevScopeKeyRef.current === scopeKey;
    prevScopeKeyRef.current = scopeKey;
    load({ silent });
  }, [isReady, isAuthenticated, load, scope, historyStatus, qApplied]);

  useEffect(() => {
    if (isReady && viewReview && !canReview) {
      setSearchParams({});
    }
  }, [isReady, viewReview, canReview, setSearchParams]);

  const setListView = (id) => {
    if (id === 'history') setSearchParams({ view: 'history' });
    else if (id === 'review') setSearchParams({ view: 'review' });
    else setSearchParams({});
    setViewOrder(null);
  };

  const handleStatus = async (id, nextStatus) => {
    setStatusSavingId(id);
    setError('');
    try {
      await apiRequest(`/autoservice/repair-orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await load();
    } catch (e) {
      setError(e?.message || 'Не удалось сменить статус');
    } finally {
      setStatusSavingId(null);
    }
  };

  const handleApprove = async (id) => {
    setApprovingId(id);
    setError('');
    try {
      const updated = await apiRequest(`/autoservice/repair-orders/${id}/approve`, {
        method: 'POST',
      });
      if (viewOrder?.id === id) setViewOrder(updated);
      await load();
    } catch (e) {
      setError(e?.message || 'Не удалось принять заявку');
    } finally {
      setApprovingId(null);
    }
  };

  const statusActions = useMemo(
    () =>
      viewReview
        ? [{ value: 'cancelled', label: 'Отклонить' }]
        : viewHistory
        ? [
            { value: 'pending', label: 'Ожидание' },
            { value: 'in_progress', label: 'В работу' },
            { value: 'done', label: 'Выполнен' },
          ]
        : [
            { value: 'pending', label: 'Ожидание' },
            { value: 'in_progress', label: 'В работу' },
            { value: 'done', label: 'Выполнен' },
            { value: 'completed', label: 'Завершить' },
            { value: 'cancelled', label: 'Отменить' },
          ],
    [viewHistory, viewReview],
  );

  const statusActionsForRow = useCallback(
    (row) => {
      const unpaid = row?.is_paid === false || Number(row?.remaining_amount ?? 0) > 0.005;
      return statusActions.map((option) =>
        option.value === 'completed' && unpaid
          ? {
              ...option,
              disabled: true,
              disabledTitle: 'Сначала оплатите заказ-наряд полностью',
            }
          : option,
      );
    },
    [statusActions],
  );

  const handleDuplicate = async (row) => {
    setDuplicatingId(row.id);
    setError('');
    try {
      const order = await apiRequest(`/autoservice/repair-orders/${row.id}`);
      const created = await apiRequest('/autoservice/repair-orders', {
        method: 'POST',
        body: JSON.stringify(buildRepairOrderDuplicatePayload(order)),
      });
      if (viewHistory) {
        setSearchParams({});
      } else if (viewReview) {
        setSearchParams({});
      } else {
        await load();
      }
      setViewOrder(created);
    } catch (e) {
      setError(e?.message || 'Не удалось скопировать заказ-наряд');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmOrder) return;
    setDeletingId(deleteConfirmOrder.id);
    setError('');
    try {
      await apiRequest(`/autoservice/repair-orders/${deleteConfirmOrder.id}`, {
        method: 'DELETE',
      });
      if (viewOrder?.id === deleteConfirmOrder.id) {
        setViewOrder(null);
      }
      setDeleteConfirmOrder(null);
      await load();
    } catch (e) {
      setError(e?.message || 'Не удалось удалить заказ-наряд');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOrderUpdated = useCallback(
    (updated) => {
      setViewOrder(updated);
      setRows((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
      if (updated.status === 'completed' || updated.status === 'cancelled' || updated.status === 'pending') {
        load();
      }
    },
    [load],
  );

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  const pageTitle = viewHistory
    ? 'История заказ-нарядов'
    : viewReview
      ? 'На проверке'
      : 'Заказ-наряды';
  const pageSubtitle = loading
    ? 'Загрузка…'
    : viewHistory
      ? canReview
        ? `${rows.length} завершённых и отменённых`
        : `${rows.length} ваших завершённых и отменённых`
      : viewReview
        ? `${rows.length} заявок от сотрудников`
        : canReview
          ? `${rows.length} активных`
          : `${rows.length} ваших активных`;
  const orderTabs = [
    { id: 'active', label: 'Активные' },
    ...(canReview ? [{ id: 'review', label: 'На проверке', count: reviewCount }] : []),
    { id: 'history', label: 'История' },
  ];
  const tabValue = viewReview ? 'review' : viewHistory ? 'history' : 'active';

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            {pageTitle}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {pageSubtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!viewHistory && !viewReview ? (
            <button
              type="button"
              onClick={() => navigate('/autoservice/orders/new')}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Новый заказ-наряд
            </button>
          ) : null}
        </div>
      </div>

      <UnderlineTabs
        className="mb-4"
        ariaLabel="Разделы заказ-нарядов"
        gapClassName="gap-4"
        tabs={orderTabs}
        value={tabValue}
        onChange={setListView}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <AutoserviceLiveSearchField
          value={q}
          onChange={setQ}
          placeholder="Номер, клиент, авто, VIN или госномер"
          ariaLabel="Поиск заказ-нарядов"
        />

        {viewHistory ? (
          <select
            className="h-10 shrink-0 rounded-full border-0 bg-gray-100 px-4 text-sm text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-400/70"
            value={historyStatus}
            onChange={(e) => setHistoryStatus(e.target.value)}
            aria-label="Фильтр по статусу"
          >
            <option value="">Все статусы</option>
            <option value="completed">Завершён</option>
            <option value="cancelled">Отменён</option>
          </select>
        ) : null}

        <button
          type="button"
          onClick={() => load()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
          title="Обновить"
          aria-label="Обновить"
        >
          <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {/* Desktop table */}
      <div className="hidden md:block min-w-0">
        <table className="min-w-full table-fixed divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="w-28 py-3 pr-3">Заказ</th>
              <th className="py-3 pr-3">Автомобиль</th>
              <th className="py-3 pr-3">Клиент</th>
              <th className="w-32 py-3 pr-3">Статус</th>
              <th className="w-28 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td className="py-3 pr-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="py-3 pr-3"><Skeleton className="h-4 w-36" /></td>
                  <td className="py-3 pr-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="mt-1 h-3 w-20" />
                  </td>
                  <td className="py-3 pr-3"><Skeleton className="h-6 w-20 rounded-full" /></td>
                  <td className="py-3 text-right"><Skeleton className="ml-auto h-8 w-16 rounded-lg" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-500">
                  {viewHistory ? 'В истории пока нет заказ-нарядов' : viewReview ? 'Заявок на проверке нет' : 'Активных заказ-нарядов нет'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="group cursor-pointer transition-colors hover:bg-gray-50/70"
                  onClick={(e) => {
                    if (e.target.closest('.actions-dropdown') || e.target.closest('.status-picker')) {
                      return;
                    }
                    setViewOrder(row);
                  }}
                >
                  <td className="py-3 pr-3 align-middle">
                    <span className="font-semibold tabular-nums text-gray-900">{repairOrderNumberLabel(row)}</span>
                  </td>
                  <td className="py-3 pr-3 align-middle font-medium text-gray-900">{vehicleLabel(row.vehicle)}</td>
                  <td className="py-3 pr-3 align-middle">
                    <div className="font-medium text-gray-900">{row.client?.name || '—'}</div>
                    {row.client?.phone ? <div className="mt-0.5 text-xs text-gray-500">{row.client.phone}</div> : null}
                  </td>
                  <td className="py-3 pr-3 align-middle">
                    <StatusPicker
                      status={row.status}
                      options={statusActionsForRow(row)}
                      saving={statusSavingId === row.id}
                      disabled={statusSavingId === row.id}
                      onChange={(nextStatus) => handleStatus(row.id, nextStatus)}
                    />
                  </td>
                  <td className="py-3 text-right align-middle">
                    <OrderActionsMenu
                      onView={() => setViewOrder(row)}
                      onEdit={() => navigate(`/autoservice/orders/${row.id}/edit`)}
                      onDuplicate={viewReview ? undefined : () => handleDuplicate(row)}
                      onDelete={() => setDeleteConfirmOrder(row)}
                      onApprove={viewReview ? () => handleApprove(row.id) : undefined}
                      duplicating={duplicatingId === row.id}
                      approveSaving={approvingId === row.id}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="md:hidden">
        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`msk-${i}`} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            {viewHistory ? 'В истории пока нет заказ-нарядов' : viewReview ? 'Заявок на проверке нет' : 'Активных заказ-нарядов нет'}
          </p>
        ) : (
          rows.map((row) => (
            <OrderMobileCard
              key={row.id}
              row={row}
              statusActions={statusActionsForRow(row)}
              statusSavingId={statusSavingId}
              onStatusChange={handleStatus}
              onView={() => setViewOrder(row)}
              onEdit={() => navigate(`/autoservice/orders/${row.id}/edit`)}
              onDuplicate={viewReview ? undefined : () => handleDuplicate(row)}
              onDelete={() => setDeleteConfirmOrder(row)}
              onApprove={viewReview ? () => handleApprove(row.id) : undefined}
              duplicating={duplicatingId === row.id}
              approveSaving={approvingId === row.id}
            />
          ))
        )}
      </div>

      <RepairOrderViewModal
        order={viewOrder}
        enablePayment={!viewReview && viewOrder?.status !== 'review'}
        onOrderChange={handleOrderUpdated}
        onClose={() => setViewOrder(null)}
        onEdit={(order) => {
          setViewOrder(null);
          navigate(`/autoservice/orders/${order.id}/edit`);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteConfirmOrder)}
        onClose={() => {
          if (!deletingId) setDeleteConfirmOrder(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Удалить заказ-наряд?"
        message={
          deleteConfirmOrder
            ? `${repairOrderNumberLabel(deleteConfirmOrder)} будет удалён безвозвратно. Запчасти исполнителя вернутся на склад автосервиса.`
            : ''
        }
        confirmLabel="Удалить"
        danger
        loading={Boolean(deletingId)}
      />
    </div>
  );
}
