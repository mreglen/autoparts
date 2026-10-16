import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import { withBackTo } from '../../hooks/useHistoryBack';
import { useDebouncedValue } from '../../hooks/useDebouncedCallback';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import PillMultiSelect from '../../components/PillDropdown/PillMultiSelect';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';

import RepairOrderViewModal, {
  RepairOrderStatusPicker,
  REPAIR_ORDER_STATUS_LABELS,
  vehicleMakeModelLabel,
} from '../../components/Autoservice/RepairOrderViewModal';
import { Skeleton } from '../../components/UI';
import Toast from '../../components/UI/Toast';
import { ConfirmDialog } from '../../components/UI/Modal';
import { apiRequest } from '../../utils/apiClient';
import { formatServerDate } from '../../utils/serverDate';
import { repairOrderNumberLabel } from '../../utils/autoserviceOrderDisplay';
import { buildOrderZoneFilterOptions } from '../../utils/autoserviceOrderZoneFilter';
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

const DRAFT_STATUS = 'draft';
const ORDER_STATUS_VALUES = ['pending', 'in_progress', 'done', 'review', 'completed', 'cancelled'];
const DEFAULT_STATUS_FILTER = ['pending', 'in_progress', 'done', 'review'];
const STATUS_OPTIONS = [
  ...ORDER_STATUS_VALUES.map((value) => ({ value, label: REPAIR_ORDER_STATUS_LABELS[value] })),
  { value: DRAFT_STATUS, label: 'Черновик' },
];

const STATUS_ACTIONS = [
  { value: 'pending', label: 'Ожидание' },
  { value: 'in_progress', label: 'В работу' },
  { value: 'done', label: 'Выполнен' },
  { value: 'completed', label: 'Закрыт' },
  { value: 'cancelled', label: 'Отменить' },
];

function isDefaultStatusFilter(values) {
  return (
    values.length === DEFAULT_STATUS_FILTER.length &&
    DEFAULT_STATUS_FILTER.every((value) => values.includes(value))
  );
}

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SortableDateTh({ label, column, sort, onSort, className = 'w-36' }) {
  const active = sort.by === column;
  return (
    <th
      className={`${className} ${autoserviceListThClass}`}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-bold uppercase tracking-wide text-ink-muted transition hover:text-ink"
      >
        {label}
        <svg
          className={`h-3 w-3 shrink-0 transition-transform ${
            active && sort.dir === 'asc' ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </th>
  );
}

export default function AutoserviceOrdersPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [drafts, setDrafts] = useState(() => listRepairOrderFormDrafts());

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const qApplied = useDebouncedValue(q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => {
    const raw = searchParams.get('status');
    return raw
      ? raw.split(',').map((value) => value.trim()).filter(Boolean)
      : DEFAULT_STATUS_FILTER;
  });
  const [zoneFilter, setZoneFilter] = useState([]);
  const [sort, setSort] = useState({ by: 'scheduled_at', dir: 'desc' });
  const [workZones, setWorkZones] = useState([]);
  const [viewOrder, setViewOrder] = useState(null);
  const [statusSavingId, setStatusSavingId] = useState(null);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState(null);
  const [deleteConfirmDraft, setDeleteConfirmDraft] = useState(null);
  const [closeConfirmOrder, setCloseConfirmOrder] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const prevStatusKeyRef = useRef(null);
  const offsetRef = useRef(0);
  const loadSeqRef = useRef(0);
  const sentinelRef = useRef(null);

  const viewDrafts = statusFilter.includes(DRAFT_STATUS);
  const draftOnly = viewDrafts && statusFilter.length === 1;

  const handleSort = useCallback((column) => {
    setSort((prev) => (prev.by === column
      ? { by: column, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      : { by: column, dir: 'desc' }));
  }, []);

  const buildParams = useCallback(
    (offset) => {
      const params = new URLSearchParams({
        scope: 'all',
        limit: String(PAGE_SIZE),
        offset: String(offset),
        sort_by: sort.by,
        sort_dir: sort.dir,
      });
      if (qApplied.trim()) params.set('q', qApplied.trim());
      statusFilter
        .filter((value) => value !== DRAFT_STATUS)
        .forEach((value) => params.append('status', value));
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (zoneFilter.length) {
        zoneFilter.forEach((zoneId) => params.append('work_zone_id', zoneId));
      }
      return params;
    },
    [qApplied, statusFilter, dateFrom, dateTo, zoneFilter, sort],
  );

  const load = useCallback(async ({ silent = false } = {}) => {
    if (draftOnly) {
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
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(e?.message || 'Не удалось загрузить записи');
      setRows([]);
      setHasMore(false);
    } finally {
      if (seq === loadSeqRef.current && !silent) setLoading(false);
    }
  }, [draftOnly, buildParams]);

  const loadMore = useCallback(async () => {
    if (draftOnly || loading || loadingMore || !hasMore) return;
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
  }, [draftOnly, loading, loadingMore, hasMore, buildParams]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || draftOnly || !hasMore) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: '300px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, draftOnly]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    const statusKey = statusFilter.join(',');
    const silent = prevStatusKeyRef.current === statusKey;
    prevStatusKeyRef.current = statusKey;
    load({ silent });
  }, [isReady, isAuthenticated, load, statusFilter, qApplied]);

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
    if (isReady && viewDrafts) setDrafts(listRepairOrderFormDrafts());
  }, [isReady, viewDrafts]);

  const applyOrderToList = useCallback(
    (updated) => {
      const belongs = statusFilter.includes(updated.status);
      setRows((prev) => {
        if (!belongs) return prev.filter((row) => row.id !== updated.id);
        return prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row));
      });
      if (viewOrder?.id === updated.id) setViewOrder(updated);
    },
    [statusFilter, viewOrder?.id],
  );

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    let cancelled = false;
    apiRequest('/autoservice/repair-orders/work-zones-meta')
      .then((data) => {
        if (!cancelled) setWorkZones(Array.isArray(data?.work_zones) ? data.work_zones : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isReady, isAuthenticated]);

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
        : `заказ-наряд ${draft.orderId}`;
      const text = [
        title,
        draft.orderId,
        draft.form?.clientName,
        draft.form?.vehicleName,
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

  const pageTitle = draftOnly ? 'Черновики' : 'Заказ-наряды';
  const pageSubtitle = loading
    ? 'Загрузка…'
    : draftOnly
      ? `${drafts.length} черновиков`
      : viewDrafts
        ? `${total} заказ-нарядов · ${drafts.length} черновиков`
        : `${total} заказ-нарядов`;
  const emptyMessage = draftOnly
    ? 'Черновиков пока нет'
    : viewDrafts
      ? 'Ничего не найдено'
      : 'Заказ-нарядов нет';
  const filtersActive =
    Boolean(dateFrom || dateTo) || zoneFilter.length > 0 || !isDefaultStatusFilter(statusFilter);
  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setStatusFilter(DEFAULT_STATUS_FILTER);
    setZoneFilter([]);
  };

  return (
    <div className="w-full min-w-0">
      <div className="lg:hidden">
        <AutoserviceOrdersMobileView
          onCreate={() => navigate('/autoservice/orders/new', { state: withBackTo(location) })}
          q={q}
          onSearchChange={setQ}
          loading={loading}
          error={error}
          onErrorClose={() => setError('')}
          rows={rows}
          hasMore={hasMore}
          loadingMore={loadingMore}
          sentinelRef={sentinelRef}
          emptyMessage={emptyMessage}
          statusActions={STATUS_ACTIONS}
          onStatusChange={handleStatus}
          statusSavingId={statusSavingId}
          onView={setViewOrder}
          drafts={viewDrafts ? filteredDrafts : undefined}
          draftsOnly={draftOnly}
          onDraftOpen={openDraft}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          statusOptions={STATUS_OPTIONS}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          workZones={workZones}
          zoneFilter={zoneFilter}
          onZoneFilterChange={setZoneFilter}
          filtersActive={filtersActive}
          onResetFilters={resetFilters}
        />
      </div>

      <div className="hidden lg:block">
        <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{pageTitle}</h1>
            <p className="mt-0.5 text-sm text-gray-500">{pageSubtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/autoservice/orders/new', { state: withBackTo(location) })}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 sm:w-auto"
            >
              Новый заказ-наряд
            </button>
          </div>
        </div>

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
            <div className="w-44 min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">Статус</span>
              <PillMultiSelect
                values={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
                placeholder="Все статусы"
                ariaLabel="Фильтр по статусу"
              />
            </div>
            <div className="w-44 min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">Рабочая зона</span>
              <PillMultiSelect
                values={zoneFilter}
                onChange={setZoneFilter}
                options={buildOrderZoneFilterOptions(workZones)}
                placeholder="Все зоны"
                ariaLabel="Фильтр по рабочей зоне"
              />
            </div>
            {filtersActive ? (
              <button
                type="button"
                onClick={resetFilters}
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
              {!draftOnly ? (
                <>
                  <SortableDateTh
                    label="Дата начала"
                    column="scheduled_at"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableDateTh
                    label="Дата конца"
                    column="scheduled_end_at"
                    sort={sort}
                    onSort={handleSort}
                  />
                </>
              ) : null}
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
                  {!draftOnly ? (
                    <>
                      <td className={autoserviceListTdClass}><Skeleton className="h-4 w-20" /></td>
                      <td className={autoserviceListTdClass}><Skeleton className="h-4 w-20" /></td>
                    </>
                  ) : null}
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-36" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-28" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-24" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-6 w-20 rounded-full" /></td>
                </tr>
              ))
            ) : (
              <>
                {viewDrafts ? filteredDrafts.map((draft) => {
                  const form = draft.form || {};
                  const clientName = form.clientName || form.pendingClientName || '—';
                  const vehicleName = form.vehicleName
                    || [form.pendingVehicleMake, form.pendingVehicleModel].filter(Boolean).join(' ')
                    || '—';
                  const draftTotal = form.draftTotal != null && !Number.isNaN(Number(form.draftTotal))
                    ? Number(form.draftTotal)
                    : null;
                  return (
                    <tr
                      key={draft.key}
                      className={autoserviceListTrClickableClass}
                      onClick={() => openDraft(draft)}
                    >
                      <td className={autoserviceListTdClass}>
                        <span className="font-medium tabular-nums text-ink-muted">
                          {draft.mode === 'create' ? 'Новый' : `№ ${draft.orderId}`}
                        </span>
                      </td>
                      {!draftOnly ? (
                        <>
                          <td className={autoserviceListTdClass}>
                            <span className="tabular-nums text-ink-muted">
                              {form.scheduledAt ? formatServerDate(form.scheduledAt) : '—'}
                            </span>
                          </td>
                          <td className={autoserviceListTdClass}>
                            <span className="tabular-nums text-ink-muted">
                              {form.scheduledEndAt ? formatServerDate(form.scheduledEndAt) : '—'}
                            </span>
                          </td>
                        </>
                      ) : null}
                      <td className={`${autoserviceListTdClass} font-semibold text-ink`}>
                        {vehicleName}
                      </td>
                      <td className={autoserviceListTdClass}>
                        <div className="font-semibold text-ink">
                          {clientName}
                        </div>
                      </td>
                      <td className={autoserviceListTdClass}>
                        <span className="tabular-nums font-semibold text-ink">
                          {draftTotal != null ? `${formatMoney(draftTotal)} ₽` : '—'}
                        </span>
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
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-600"
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
                  );
                }) : null}
                {!draftOnly ? rows.map((row) => (
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
                    <td className={autoserviceListTdClass}>
                      <span className="tabular-nums text-ink-muted">
                        {row.scheduled_end_at ? formatServerDate(row.scheduled_end_at) : '—'}
                      </span>
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
                        options={STATUS_ACTIONS}
                        saving={statusSavingId === row.id}
                        disabled={statusSavingId === row.id}
                        onChange={(nextStatus) => handleStatus(row.id, nextStatus)}
                      />
                    </td>
                  </tr>
                )) : null}
                {(viewDrafts ? filteredDrafts.length === 0 : true) && (draftOnly || rows.length === 0) ? (
                  <tr>
                    <td colSpan={draftOnly ? 5 : 7} className="py-12 text-center text-ink-muted">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : null}
              </>
            )}
          </tbody>
        </table>
        {!loading && !draftOnly && hasMore ? (
          <div ref={sentinelRef} className="flex justify-center py-3" aria-hidden="true">
            {loadingMore ? <Skeleton className="h-4 w-40" /> : null}
          </div>
        ) : null}
      </div>

      <RepairOrderViewModal
        order={viewOrder}
        enablePayment={viewOrder?.status !== 'review'}
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
