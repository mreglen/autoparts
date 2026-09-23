import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import { useDebouncedValue } from '../../hooks/useDebouncedCallback';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';

import RepairOrderViewModal, {
  RepairOrderStatusPicker,
  vehicleLabel,
} from '../../components/Autoservice/RepairOrderViewModal';
import { Skeleton, UnderlineTabs } from '../../components/UI';
import { ConfirmDialog } from '../../components/UI/Modal';
import { apiRequest } from '../../utils/apiClient';
import { buildRepairOrderDuplicatePayload } from '../../utils/repairOrderDuplicate';
import { formatServerDate, formatWallClockDateTime } from '../../utils/serverDate';
import { repairOrderNumberLabel } from '../../utils/autoserviceOrderDisplay';
import { canReviewRepairOrders } from '../../utils/autoservicePermissions';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import {
  clearRepairOrderFormDraft,
  listRepairOrderFormDrafts,
} from '../../utils/repairOrderFormDraft';
import AutoserviceOrdersMobileView from './AutoserviceOrdersMobileView';
import {
  autoserviceListTableClass,
  autoserviceListTheadRowClass,
  autoserviceListThClass,
  autoserviceListTbodyClass,
  autoserviceListTrClickableClass,
  autoserviceListTdClass,
} from '../../utils/warehouseListUi';

function formatDateTime(value) {
  return formatWallClockDateTime(value);
}

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function orderMatchesList(order, { scope, historyStatus, includeReviewInActive }) {
  const status = order?.status;
  if (scope === 'all') return true;
  if (scope === 'review') return status === 'review';
  if (scope === 'history') {
    if (historyStatus) return status === historyStatus;
    return status === 'completed' || status === 'cancelled';
  }
  if (status === 'pending' || status === 'in_progress' || status === 'done') return true;
  return Boolean(includeReviewInActive && status === 'review');
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
  const viewDrafts = viewParam === 'drafts';
  const viewAll = viewParam === 'all';
  const [drafts, setDrafts] = useState(() => listRepairOrderFormDrafts());

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
  const [deleteConfirmDraft, setDeleteConfirmDraft] = useState(null);
  const [closeConfirmOrder, setCloseConfirmOrder] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const prevScopeKeyRef = useRef(null);

  const scope = viewReview ? 'review' : viewHistory ? 'history' : viewAll ? 'all' : 'active';

  const load = useCallback(async ({ silent = false } = {}) => {
    if (viewDrafts) {
      setRows([]);
      setError('');
      setLoading(false);
      return;
    }
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
  }, [scope, qApplied, viewHistory, viewDrafts, historyStatus, canReview]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    const scopeKey = `${scope}|${historyStatus}`;
    const silent = prevScopeKeyRef.current === scopeKey;
    prevScopeKeyRef.current = scopeKey;
    load({ silent });
  }, [isReady, isAuthenticated, load, scope, historyStatus, qApplied]);

  useEffect(() => {
    const onPullRefresh = (event) => {
      const path = event.detail?.pathname || '';
      if (path === '/autoservice/orders' || path.startsWith('/autoservice/orders?')) {
        setDrafts(listRepairOrderFormDrafts());
        load({ silent: true });
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [load]);

  useEffect(() => {
    if (viewDrafts) setDrafts(listRepairOrderFormDrafts());
  }, [viewDrafts]);

  useEffect(() => {
    if (isReady && viewReview && !canReview) {
      setSearchParams({});
    }
  }, [isReady, viewReview, canReview, setSearchParams]);

  const setListView = (id) => {
    if (id === 'history') setSearchParams({ view: 'history' });
    else if (id === 'review') setSearchParams({ view: 'review' });
    else if (id === 'drafts') setSearchParams({ view: 'drafts' });
    else if (id === 'all') setSearchParams({ view: 'all' });
    else setSearchParams({});
    setViewOrder(null);
    setDrafts(listRepairOrderFormDrafts());
  };

  const applyOrderToList = useCallback(
    (updated) => {
      const belongs = orderMatchesList(updated, {
        scope,
        historyStatus,
        includeReviewInActive: !canReview,
      });
      setRows((prev) => {
        if (!belongs) return prev.filter((row) => row.id !== updated.id);
        return prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row));
      });
      if (viewOrder?.id === updated.id) setViewOrder(updated);
      if (scope === 'review' && updated.status !== 'review') {
        setReviewCount((count) => Math.max(0, count - 1));
      }
    },
    [scope, historyStatus, canReview, viewOrder?.id],
  );

  const updateOrderStatus = async (id, nextStatus) => {
    setStatusSavingId(id);
    setError('');
    try {
      const updated = await apiRequest(`/autoservice/repair-orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      applyOrderToList(updated);
      setCloseConfirmOrder(null);
    } catch (e) {
      setError(e?.message || 'Не удалось сменить статус');
    } finally {
      setStatusSavingId(null);
    }
  };

  const handleStatus = async (id, nextStatus) => {
    if (nextStatus === 'completed') {
      setCloseConfirmOrder(rows.find((row) => row.id === id) || viewOrder || { id });
      return;
    }
    await updateOrderStatus(id, nextStatus);
  };

  const handleApprove = async (id) => {
    setApprovingId(id);
    setError('');
    try {
      const updated = await apiRequest(`/autoservice/repair-orders/${id}/approve`, {
        method: 'POST',
      });
      applyOrderToList(updated);
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
            { value: 'completed', label: 'Закрыт' },
            { value: 'cancelled', label: 'Отменить' },
          ],
    [viewHistory, viewReview],
  );

  const statusActionsForRow = useCallback(() => statusActions, [statusActions]);

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

  const openDraft = useCallback(
    (draft) => {
      if (draft.mode === 'edit' && draft.orderId) {
        navigate(`/autoservice/orders/${draft.orderId}/edit`);
      } else {
        navigate('/autoservice/orders/new');
      }
    },
    [navigate],
  );

  const handleDeleteDraftConfirm = useCallback(() => {
    if (!deleteConfirmDraft) return;
    clearRepairOrderFormDraft(deleteConfirmDraft.mode, deleteConfirmDraft.orderId);
    setDeleteConfirmDraft(null);
    setDrafts(listRepairOrderFormDrafts());
  }, [deleteConfirmDraft]);

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
      applyOrderToList(updated);
    },
    [applyOrderToList],
  );

  const filteredDrafts = useMemo(() => {
    if (!viewDrafts) return drafts;
    const term = qApplied.trim().toLowerCase();
    if (!term) return drafts;
    return drafts.filter((draft) => {
      const title = draft.mode === 'create'
        ? 'новый заказ-наряд'
        : `заказ-наряд #${draft.orderId}`;
      const text = [
        title,
        draft.form?.pendingClientName,
        draft.form?.pendingClientPhone,
        draft.form?.pendingVehicleMake,
        draft.form?.pendingVehicleModel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(term);
    });
  }, [drafts, qApplied, viewDrafts]);

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  const pageTitle = viewHistory
    ? 'История заказ-нарядов'
    : viewReview
      ? 'На проверке'
      : viewDrafts
        ? 'Черновики'
        : viewAll
          ? 'Все заказ-наряды'
          : 'Заказ-наряды';
  const pageSubtitle = loading
    ? 'Загрузка…'
    : viewDrafts
      ? `${drafts.length} черновиков`
      : viewAll
        ? `${rows.length} всего`
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
    { id: 'all', label: 'Все' },
    { id: 'drafts', label: 'Черновики', count: drafts.length || undefined },
    ...(canReview ? [{ id: 'review', label: 'На проверке', shortLabel: 'Проверка', count: reviewCount }] : []),
    { id: 'history', label: 'История' },
  ];
  const tabValue = viewReview
    ? 'review'
    : viewHistory
      ? 'history'
      : viewDrafts
        ? 'drafts'
        : viewAll
          ? 'all'
          : 'active';
  const emptyMessage = viewDrafts
    ? 'Черновиков пока нет'
    : viewHistory
    ? 'В истории пока нет заказ-нарядов'
    : viewReview
      ? 'Заявок на проверке нет'
      : viewAll
        ? 'Заказ-нарядов нет'
        : 'Активных заказ-нарядов нет';

  return (
    <div className="w-full min-w-0">
      <div className="lg:hidden">
        <AutoserviceOrdersMobileView
          onCreate={() => navigate('/autoservice/orders/new')}
          orderTabs={orderTabs}
          tabValue={tabValue}
          onTabChange={setListView}
          q={q}
          onSearchChange={setQ}
          viewHistory={viewHistory}
          historyStatus={historyStatus}
          onHistoryStatusChange={setHistoryStatus}
          loading={loading}
          onRefresh={() => load()}
          error={error}
          rows={rows}
          emptyMessage={emptyMessage}
          statusActionsForRow={statusActionsForRow}
          onStatusChange={handleStatus}
          statusSavingId={statusSavingId}
          onView={setViewOrder}
          onEdit={(row) => navigate(`/autoservice/orders/${row.id}/edit`)}
          onDuplicate={viewReview ? undefined : handleDuplicate}
          onDelete={setDeleteConfirmOrder}
          onApprove={viewReview ? (row) => handleApprove(row.id) : undefined}
          duplicatingId={duplicatingId}
          approvingId={approvingId}
          formatDateTime={formatDateTime}
          drafts={viewDrafts ? filteredDrafts : undefined}
          onDraftOpen={openDraft}
          onDraftDelete={setDeleteConfirmDraft}
        />
      </div>

      <div className="hidden lg:block">
        <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{pageTitle}</h1>
            <p className="mt-0.5 text-sm text-gray-500">{pageSubtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!viewHistory && !viewReview ? (
              <button
                type="button"
                onClick={() => navigate('/autoservice/orders/new')}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 sm:w-auto"
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
          tabClassName="pb-3 pt-1 text-sm font-medium sm:text-[15px]"
          tabs={orderTabs}
          value={tabValue}
          onChange={setListView}
        />

        <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2">
          <AutoserviceLiveSearchField
            value={q}
            onChange={setQ}
            placeholder="Номер, клиент, авто, VIN…"
            ariaLabel="Поиск заказ-нарядов"
          />

          {viewHistory ? (
            <select
              className="h-10 min-w-0 shrink-0 rounded-full border-0 bg-gray-100 px-4 text-sm text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-400/70"
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

        <table className={autoserviceListTableClass}>
          <thead>
            <tr className={autoserviceListTheadRowClass}>
              <th className={`w-28 ${autoserviceListThClass}`}>Заказ</th>
              <th className={`w-28 ${autoserviceListThClass}`}>Дата</th>
              <th className={`min-w-0 ${autoserviceListThClass}`}>Автомобиль</th>
              <th className={`min-w-0 ${autoserviceListThClass}`}>Клиент</th>
              <th className={`w-32 ${autoserviceListThClass}`}>Сумма</th>
              <th className={`w-32 ${autoserviceListThClass}`}>Статус</th>
            </tr>
          </thead>
          <tbody className={autoserviceListTbodyClass}>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-16" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-20" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-36" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-28" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-24" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-6 w-20 rounded-full" /></td>
                </tr>
              ))
            ) : viewDrafts ? (
              filteredDrafts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ink-muted">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                filteredDrafts.map((draft) => (
                  <tr
                    key={draft.key}
                    className={autoserviceListTrClickableClass}
                    onClick={() => openDraft(draft)}
                  >
                    <td className={autoserviceListTdClass}>
                      <span className="font-medium text-ink-muted">
                        {draft.mode === 'create' ? 'Новый' : `#${draft.orderId}`}
                      </span>
                    </td>
                    <td className={autoserviceListTdClass}>
                      <span className="tabular-nums text-ink-muted">
                        {draft.savedAt ? new Date(draft.savedAt).toLocaleString('ru-RU') : '—'}
                      </span>
                    </td>
                    <td className={`${autoserviceListTdClass} font-semibold text-ink`}>
                      {[draft.form?.pendingVehicleMake, draft.form?.pendingVehicleModel]
                        .filter(Boolean)
                        .join(' ') || '—'}
                    </td>
                    <td className={autoserviceListTdClass}>
                      <div className="font-semibold text-ink">
                        {draft.form?.pendingClientName || '—'}
                      </div>
                    </td>
                    <td className={autoserviceListTdClass}>
                      <span className="text-ink-muted">—</span>
                    </td>
                    <td className={autoserviceListTdClass}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          Черновик
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmDraft(draft);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Удалить черновик"
                          aria-label="Удалить черновик"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3m-9 0h10" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-ink-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={autoserviceListTrClickableClass}
                  onClick={(e) => {
                    if (e.target.closest('.actions-dropdown') || e.target.closest('.status-picker')) {
                      return;
                    }
                    setViewOrder(row);
                  }}
                >
                  <td className={autoserviceListTdClass}>
                    <span className="font-medium tabular-nums text-ink-muted">{repairOrderNumberLabel(row)}</span>
                  </td>
                  <td className={autoserviceListTdClass}>
                    <span className="tabular-nums text-ink-muted">{formatServerDate(row.scheduled_at)}</span>
                  </td>
                  <td className={`${autoserviceListTdClass} font-semibold text-ink`}>{vehicleLabel(row.vehicle)}</td>
                  <td className={autoserviceListTdClass}>
                    <div className="font-semibold text-ink">{row.client?.name || '—'}</div>
                  </td>
                  <td className={autoserviceListTdClass}>
                    <div className="tabular-nums font-semibold text-ink">{formatMoney(row.grand_total)} ₽</div>
                  </td>
                  <td className={`${autoserviceListTdClass} [&_span]:ring-0`}>
                    <RepairOrderStatusPicker
                      status={row.status}
                      options={statusActionsForRow(row)}
                      saving={statusSavingId === row.id}
                      disabled={statusSavingId === row.id}
                      onChange={(nextStatus) => handleStatus(row.id, nextStatus)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
        open={Boolean(closeConfirmOrder)}
        onClose={() => {
          if (!statusSavingId) setCloseConfirmOrder(null);
        }}
        onConfirm={() => updateOrderStatus(closeConfirmOrder.id, 'completed')}
        title="Закрыть заказ-наряд?"
        message={
          closeConfirmOrder
            ? `Вы точно хотите закрыть ${repairOrderNumberLabel(closeConfirmOrder)}?${Number(closeConfirmOrder.remaining_amount || 0) > 0.005 ? ` Заказ оплачен не полностью. Осталось ${Number(closeConfirmOrder.remaining_amount).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽.` : ''}`
            : ''
        }
        confirmLabel="Да, закрыть"
        loading={Boolean(statusSavingId)}
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

      <ConfirmDialog
        open={Boolean(deleteConfirmDraft)}
        onClose={() => setDeleteConfirmDraft(null)}
        onConfirm={handleDeleteDraftConfirm}
        title="Удалить черновик?"
        message={
          deleteConfirmDraft
            ? `${deleteConfirmDraft.mode === 'create' ? 'Новый заказ-наряд' : `Заказ-наряд #${deleteConfirmDraft.orderId}`} — несохранённые данные будут удалены безвозвратно.`
            : ''
        }
        confirmLabel="Удалить"
        danger
      />
    </div>
  );
}
