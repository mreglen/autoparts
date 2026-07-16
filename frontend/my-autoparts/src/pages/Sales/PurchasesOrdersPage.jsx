import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';
import { useAuthReady } from '../../hooks/useAuthReady';
import PurchaseOrderCard, { PurchaseOrdersEmptyState } from '../../components/PurchaseOrderCard/PurchaseOrderCard';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { buildUnifiedOrders, getUnifiedOrderKey } from '../../utils/orderSourceMeta';
import { getGarageDeliveryInfo, normalizeNewPartsCustomerStatus, getGarageStatusColor, getGarageStatusName, getUsedOrderBuyerHint, getNewOrderBuyerHint } from '../../utils/garageOrderUi';
import { fetchAvitoChatProductLink } from '../../redux/slices/AvitoChatSlice';
import { isUsedOrderReturnEligible, TERMINAL_RETURN_STATUSES } from '../../utils/returnStatusUi';
import { openOrderItemProductFlow } from '../../utils/avitoProductFlow';
import { subscribeToPushNotifications } from '../../redux/slices/ChatSlice';

const ACTIVE_STATUSES = new Set([
  'pending',
  'confirmed',
  'assembled',
  'ready_for_pickup',
  'shipped',
  'new_waiting_confirmation',
  'new_assembling',
  'new_shipped',
  'new_awaiting_arrival',
  'new_ready_for_pickup',
]);
const COMPLETED_STATUSES = new Set(['delivered', 'closed', 'new_received']);

const STATUS_FILTER_OPTIONS = [
  { id: 'all', label: 'Все' },
  { id: 'active', label: 'В работе' },
  { id: 'completed', label: 'Завершённые' },
  { id: 'rejected', label: 'Отменённые' },
];

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatPrice(amount) {
  return `${Number(amount || 0).toLocaleString('ru-RU')} ₽`;
}

function matchesStatusFilter(order, filterId, source = 'used') {
  const code = source === 'new'
    ? normalizeNewPartsCustomerStatus(order.status_code)
    : (order.status_code || 'pending');
  if (filterId === 'all') return true;
  if (filterId === 'active') return ACTIVE_STATUSES.has(code);
  if (filterId === 'completed') return COMPLETED_STATUSES.has(code);
  if (filterId === 'rejected') return code === 'rejected';
  return true;
}

export default function PurchasesOrdersPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isReady, isAuthenticated } = useAuthReady();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [usedOrders, setUsedOrders] = useState([]);
  const [newOrders, setNewOrders] = useState([]);
  const [expandedOrderKey, setExpandedOrderKey] = useState(null);
  const [newOrdersLoadFailed, setNewOrdersLoadFailed] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeReturnOrderIds, setActiveReturnOrderIds] = useState(new Set());

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    dispatch(subscribeToPushNotifications({ prompt: true }));
  }, [dispatch, isReady, isAuthenticated]);

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      navigate('/auth', { replace: true });
    }
  }, [isReady, isAuthenticated, navigate]);

  const fetchAll = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const results = await Promise.allSettled([
        apiAxios.get('/sales/purchases/used-orders'),
        apiAxios.get('/sales/purchases/new-orders'),
        apiAxios.get('/sales/purchases/returns'),
      ]);

      const [usedRes, newRes, returnsRes] = results;

      if (usedRes.status === 'fulfilled') {
        setUsedOrders(Array.isArray(usedRes.value.data) ? usedRes.value.data : []);
      } else {
        throw usedRes.reason;
      }

      if (newRes.status === 'fulfilled') {
        setNewOrdersLoadFailed(false);
        setNewOrders(Array.isArray(newRes.value.data) ? newRes.value.data : []);
      } else {
        setNewOrders([]);
        setNewOrdersLoadFailed(true);
      }

      if (returnsRes.status === 'fulfilled') {
        const ids = new Set();
        (returnsRes.value.data || []).forEach((r) => {
          if (!TERMINAL_RETURN_STATUSES.has(r.status_code)) ids.add(r.order_id);
        });
        setActiveReturnOrderIds(ids);
      }
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Не удалось загрузить заказы');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      fetchAll();
    }
  }, [isReady, isAuthenticated, fetchAll]);

  // Обновлять статусы позиций после подтверждения продавцом на /sales/orders
  useEffect(() => {
    if (!isReady || !isAuthenticated) return undefined;

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        fetchAll(true);
      }
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [isReady, isAuthenticated, fetchAll]);

  const allOrdersPool = useMemo(
    () => buildUnifiedOrders(usedOrders, newOrders, [], { canViewNewOrders: true, avitoProActive: false }),
    [usedOrders, newOrders],
  );

  const filterUnifiedEntry = useCallback(
    (entry) => {
      const { source, order } = entry;
      if (!matchesStatusFilter(order, statusFilter, source)) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const haystack = [
        order.id,
        ...(source === 'used' ? [order.organization_name, order.seller] : [order.organization_name]),
        order.buyer_name,
        order.buyer_phone,
        getGarageDeliveryInfo(order),
        ...(order.items || []).flatMap((item) => [item.name, item.brand, item.partnumber]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    },
    [searchQuery, statusFilter],
  );

  const filteredUnifiedOrders = useMemo(
    () => allOrdersPool.filter(filterUnifiedEntry),
    [allOrdersPool, filterUnifiedEntry],
  );

  const stats = useMemo(() => {
    let activeCount = 0;
    let totalSum = 0;
    allOrdersPool.forEach(({ source, order }) => {
      const code = source === 'new'
        ? normalizeNewPartsCustomerStatus(order.status_code)
        : (order.status_code || 'pending');
      if (ACTIVE_STATUSES.has(code)) activeCount += 1;
      totalSum += Number(order.total_amount || 0);
    });
    return { total: allOrdersPool.length, activeCount, totalSum };
  }, [allOrdersPool]);

  const handleProductClick = useCallback(async (item, e, orderType = 'used') => {
    e?.stopPropagation?.();
    await openOrderItemProductFlow({
      item,
      orderType,
      dispatch,
      navigate,
      fetchLinkThunk: fetchAvitoChatProductLink,
    });
  }, [dispatch, navigate]);

  const toggleOrderExpand = (key) => {
    setExpandedOrderKey((prev) => (prev === key ? null : key));
  };

  if (!isReady || !isAuthenticated) {
    return <AuthLoadingScreen className="min-h-[16rem]" />;
  }

  return (
    <div className="min-w-0 space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-white via-white to-indigo-50/70 p-5 shadow-sm ring-1 ring-gray-200/60 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-indigo-400/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Личный кабинет</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Мои заказы</h1>
            <p className="mt-2 max-w-xl text-sm text-gray-600">
              История покупок, статусы и состав заказов. Отслеживайте доставку и оплату в одном месте.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchAll(true)}
            disabled={loading || refreshing}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
          >
            <svg
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? 'Обновление…' : 'Обновить'}
          </button>
        </div>

        {!loading && !error && (
          <dl className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs font-medium text-gray-500">Всего заказов</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{stats.total}</dd>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs font-medium text-gray-500">В работе</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-indigo-700">{stats.activeCount}</dd>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs font-medium text-gray-500">Сумма покупок</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{formatPrice(stats.totalSum)}</dd>
            </div>
          </dl>
        )}
      </header>

      <div className="rounded-2xl border border-gray-200/80 bg-white p-1 shadow-sm">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === opt.id
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-0 w-full sm:max-w-xs sm:flex-1 lg:max-w-sm">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по номеру, продавцу, товару…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center">
          <AuthLoadingScreen className="h-24" />
          <p className="mt-4 text-sm text-gray-600">Загружаем заказы…</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => fetchAll()}
            className="mt-4 inline-flex rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Попробовать снова
          </button>
        </div>
      )}

      {!loading && !error && newOrdersLoadFailed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Не удалось загрузить заказы новых запчастей. Показаны только заказы б/у — попробуйте обновить страницу.
        </div>
      )}

      {!loading && !error && (
        <>
          {stats.total > 0 && filteredUnifiedOrders.length !== stats.total && (
            <p className="text-sm text-gray-500">
              Показано {filteredUnifiedOrders.length} из {stats.total} заказов
            </p>
          )}

          <div className="space-y-4">
            {filteredUnifiedOrders.map((entry) => {
              const key = getUnifiedOrderKey(entry);
              const isExpanded = expandedOrderKey === key;
              const isUsed = entry.source === 'used';
              const order = entry.order;

              return (
                <PurchaseOrderCard
                  key={key}
                  order={{
                    ...order,
                    ...(entry.source === 'new'
                      ? { status_code: normalizeNewPartsCustomerStatus(order.status_code) }
                      : {}),
                  }}
                  orderType={entry.source}
                  isExpanded={isExpanded}
                  onToggle={() => toggleOrderExpand(key)}
                  formatDate={formatDate}
                  formatPrice={formatPrice}
                  getStatusColor={getGarageStatusColor}
                  getStatusName={getGarageStatusName}
                  getBuyerHint={isUsed ? getUsedOrderBuyerHint : getNewOrderBuyerHint}
                  getDeliveryInfo={getGarageDeliveryInfo}
                  onProductClick={handleProductClick}
                  canRequestReturn={
                    isUsed
                    && isUsedOrderReturnEligible(order)
                    && !activeReturnOrderIds.has(order.id)
                  }
                  onReturnRequest={(o) => navigate(`/purchases/returns?create=1&orderId=${o.id}`)}
                />
              );
            })}
          </div>

          {filteredUnifiedOrders.length === 0 && (
            <PurchaseOrdersEmptyState hasAnyOrders={stats.total > 0} />
          )}
        </>
      )}
    </div>
  );
}
