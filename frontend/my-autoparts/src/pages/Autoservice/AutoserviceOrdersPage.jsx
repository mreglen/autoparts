import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import { withBackTo } from '../../hooks/useHistoryBack';
import { useDebouncedValue } from '../../hooks/useDebouncedCallback';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';

import RepairOrderViewModal, {
  RepairOrderStatusPicker,
  REPAIR_ORDER_STATUS_LABELS,
  vehicleMakeModelLabel,
} from '../../components/Autoservice/RepairOrderViewModal';
import { Skeleton, UnderlineTabs } from '../../components/UI';
import Toast from '../../components/UI/Toast';
import { ConfirmDialog } from '../../components/UI/Modal';
import { apiRequest } from '../../utils/apiClient';
import { formatServerDate } from '../../utils/serverDate';
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

const PAGE_SIZE = 50;

const pillButtonClass =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-gray-100 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30';

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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const viewHistory = viewParam === 'history';
  const viewReview = viewParam === 'review';
  const viewDrafts = viewParam === 'drafts';
  const viewAll = viewParam === 'all';
  const [drafts, setDrafts] = useState(() => listRepairOrderFormDrafts());

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const qApplied = useDebouncedValue(q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const [viewOrder, setViewOrder] = useState(null);
  const [statusSavingId, setStatusSavingId] = useState(null);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState(null);
  const [deleteConfirmDraft, setDeleteConfirmDraft] = useState(null);
  const [closeConfirmOrder, setCloseConfirmOrder] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const prevScopeKeyRef = useRef(null);
  const offsetRef = useRef(0);
  const loadSeqRef = useRef(0);
  const sentinelRef = useRef(null);

  const scope = viewReview ? 'review' : viewHistory ? 'history' : viewAll ? 'all' : 'active';

  const buildParams = useCallback(
    (offset) => {
      const params = new URLSearchParams({
        scope,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (qApplied.trim()) params.set('q', qApplied.trim());
      const statusParam = viewHistory ? historyStatus || statusFilter : statusFilter;
      if (statusParam) params.set('status', statusParam);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      return params;
    },
    [scope, qApplied, viewHistory, historyStatus, statusFilter, dateFrom, dateTo],
  );

  const load = useCallback(async ({ silent = false } = {}) => {
    if (viewDrafts) {
      setRows([]);
      setTotal(0);
      setHasMore(false);
      setError('');
      setLoading(false);
      return;
    }
    const seq = ++loadSeqRef.current;
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/autoservice/repair-orders?${buildParams(0).toString()}`);
      if (seq !== loadSeqRef.current) return;
      const items = Array.isArray(data?.items) ? data.items : [];
      setRows(items);
      setTotal(Number(data?.total) || items.length);
      setHasMore(Boolean(data?.has_more));
      offsetRef.current = items.length;
      if (scope === 'review') {
        setReviewCount(Number(data?.total) || items.length);
      } else if (canReview) {
        apiRequest('/autoservice/repair-orders?scope=review&limit=1')
          .then((d) => {
            if (loadSeqRef.current === seq) setReviewCount(Number(d?.total) || 0);
          })
          .catch(() => {});
      }
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(e?.message || 'Не удалось загрузить записи');
      setRows([]);
      setHasMore(false);
    } finally {
      if (seq === loadSeqRef.current && !silent) setLoading(false);
    }
  }, [viewDrafts, buildParams, scope, canReview]);

  const loadMore = useCallback(async () => {
    if (viewDrafts || loading || loadingMore || !hasMore) return;
    const seq = loadSeqRef.current;
    setLoadingMore(true);
    try {
      const data = await apiRequest(
        `/autoservice/repair-orders?${buildParams(offsetRef.current).toString()}`,
      );
      if (seq !== loadSeqRef.current) return;
      const items = Array.isArray(data?.items) ? data.items : [];
      setRows((prev) => {
        const seen = new Set(prev.map((row) => row.id));
        return [...prev, ...items.filter((row) => !seen.has(row.id))];
      });
      offsetRef.current += items.length;
      setTotal(Number(data?.total) || 0);
      setHasMore(Boolean(data?.has_more));
    } catch {
      /* keep already loaded rows */
    } finally {
      if (seq === loadSeqRef.current) setLoadingMore(false);
    }
  }, [viewDrafts, loading, loadingMore, hasMore, buildParams]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || viewDrafts || !hasMore) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: '300px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, viewDrafts]);

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

  const openDraft = useCallback(
    (draft) => {
      if (draft.mode === 'edit' && draft.orderId) {
        navigate(`/autoservice/orders/${draft.orderId}/edit`, { state: withBackTo(location) });
      } else {
        navigate('/autoservice/orders/new', { state: withBackTo(location) });
      }
    },
    [navigate, location],
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
        ? `${total} всего`
        : viewHistory
      ? canReview
        ? `${total} завершённых и отменённых`
        : `${total} ваших завершённых и отменённых`
      : viewReview
        ? `${total} заявок от сотрудников`
        : canReview
          ? `${total} активных`
          : `${total} ваших активных`;
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
          onCreate={() => navigate('/autoservice/orders/new', { state: withBackTo(location) })}
          orderTabs={orderTabs}
          tabValue={tabValue}
          onTabChange={setListView}
          q={q}
          onSearchChange={setQ}
          viewHistory={viewHistory}
          historyStatus={historyStatus}
          onHistoryStatusChange={setHistoryStatus}
          loading={loading}
          error={error}
          onErrorClose={() => setError('')}
          rows={rows}
          hasMore={hasMore}
          loadingMore={loadingMore}
          sentinelRef={sentinelRef}
          emptyMessage={emptyMessage}
          statusActionsForRow={statusActionsForRow}
          onStatusChange={handleStatus}
          statusSavingId={statusSavingId}
          onView={setViewOrder}
          drafts={viewDrafts ? filteredDrafts : undefined}
          onDraftOpen={openDraft}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
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
                onClick={() => navigate('/autoservice/orders/new', { state: withBackTo(location) })}
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

          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`${pillButtonClass} shrink-0 ${filtersOpen ? 'bg-white ring-2 ring-indigo-400/70' : ''}`}
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

        </div>

        {filtersOpen ? (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="block min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">Период с</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 rounded-full border-0 bg-gray-100 px-4 text-sm text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-400/70"
              />
            </label>
            <label className="block min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">Период по</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 rounded-full border-0 bg-gray-100 px-4 text-sm text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-400/70"
              />
            </label>
            <label className="block w-40 min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">Статус</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 w-full rounded-full border-0 bg-gray-100 px-4 text-sm text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-400/70"
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
                  setDateFrom('');
                  setDateTo('');
                  setStatusFilter('');
                }}
                className={`${pillButtonClass} shrink-0 text-gray-500`}
              >
                Сбросить
              </button>
            ) : null}
          </div>
        ) : null}

        <Toast message={error} variant="error" onClose={() => setError('')} />

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
                  <td className={`${autoserviceListTdClass} font-semibold text-ink`}>{vehicleMakeModelLabel(row.vehicle)}</td>
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
        {!loading && !viewDrafts && hasMore ? (
          <div ref={sentinelRef} className="flex justify-center py-3" aria-hidden="true">
            {loadingMore ? <Skeleton className="h-4 w-40" /> : null}
          </div>
        ) : null}
      </div>

      <RepairOrderViewModal
        order={viewOrder}
        enablePayment={!viewReview && viewOrder?.status !== 'review'}
        onOrderChange={handleOrderUpdated}
        onClose={() => setViewOrder(null)}
        onEdit={(order) => {
          setViewOrder(null);
          navigate(`/autoservice/orders/${order.id}/edit`, { state: withBackTo(location) });
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
