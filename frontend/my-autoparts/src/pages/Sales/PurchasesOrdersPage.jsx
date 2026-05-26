import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiAxios } from '../../utils/apiClient';
import { useAuthReady } from '../../hooks/useAuthReady';
import PurchaseOrderCard, { PurchaseOrdersEmptyState } from '../../components/PurchaseOrderCard/PurchaseOrderCard';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { getGarageDeliveryInfo } from '../../utils/garageOrderUi';

const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'assembled', 'shipped']);
const COMPLETED_STATUSES = new Set(['delivered', 'closed']);

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

function getGarageStatusColor(statusCode) {
  const colorMap = {
    pending: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
    confirmed: 'bg-blue-50 text-blue-800 ring-1 ring-blue-100',
    rejected: 'bg-red-50 text-red-800 ring-1 ring-red-100',
    assembled: 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100',
    shipped: 'bg-violet-50 text-violet-800 ring-1 ring-violet-100',
    delivered: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100',
    closed: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200',
  };
  return colorMap[statusCode] || 'bg-gray-100 text-gray-700 ring-1 ring-gray-200';
}

function getGarageStatusName(statusCode) {
  const statusMap = {
    pending: 'В ожидании',
    confirmed: 'Подтверждён',
    rejected: 'Не подтверждён',
    assembled: 'Сформирован',
    shipped: 'В доставке',
    delivered: 'Получен',
    closed: 'Закрыт',
  };
  return statusMap[statusCode] || statusCode || 'В ожидании';
}

function matchesStatusFilter(order, filterId) {
  const code = order.status_code || 'pending';
  if (filterId === 'all') return true;
  if (filterId === 'active') return ACTIVE_STATUSES.has(code);
  if (filterId === 'completed') return COMPLETED_STATUSES.has(code);
  if (filterId === 'rejected') return code === 'rejected';
  return true;
}

function sortOrdersNewestFirst(orders) {
  return [...orders].sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });
}

export default function PurchasesOrdersPage() {
  const navigate = useNavigate();
  const { isReady, isAuthenticated } = useAuthReady();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [usedOrders, setUsedOrders] = useState([]);
  const [newOrders, setNewOrders] = useState([]);
  const [expandedUsedOrderId, setExpandedUsedOrderId] = useState(null);
  const [expandedNewOrderId, setExpandedNewOrderId] = useState(null);
  const [canViewNewOrders, setCanViewNewOrders] = useState(true);
  const [newOrdersLoadFailed, setNewOrdersLoadFailed] = useState(false);
  const [activeTab, setActiveTab] = useState('used');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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
      ]);

      const [usedRes, newRes] = results;

      if (usedRes.status === 'fulfilled') {
        setUsedOrders(Array.isArray(usedRes.value.data) ? usedRes.value.data : []);
      } else {
        throw usedRes.reason;
      }

      if (newRes.status === 'fulfilled') {
        setCanViewNewOrders(true);
        setNewOrdersLoadFailed(false);
        setNewOrders(Array.isArray(newRes.value.data) ? newRes.value.data : []);
      } else {
        setCanViewNewOrders(true);
        setNewOrders([]);
        setNewOrdersLoadFailed(true);
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

  const filterOrders = useCallback(
    (orders, { includeOrganization = true } = {}) => {
      const q = searchQuery.trim().toLowerCase();
      return sortOrdersNewestFirst(orders).filter((order) => {
        if (!matchesStatusFilter(order, statusFilter)) return false;
        if (!q) return true;
        const haystack = [
          order.id,
          ...(includeOrganization ? [order.organization_name, order.seller] : []),
          order.buyer_name,
          order.buyer_phone,
          getGarageDeliveryInfo(order),
          ...(order.items || []).flatMap((item) => [
            item.name,
            item.brand,
            item.partnumber,
          ]),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    },
    [searchQuery, statusFilter]
  );

  const filteredUsedOrders = useMemo(() => filterOrders(usedOrders), [filterOrders, usedOrders]);
  const filteredNewOrders = useMemo(() => filterOrders(newOrders), [filterOrders, newOrders]);

  const activeOrders = activeTab === 'used' ? filteredUsedOrders : filteredNewOrders;
  const totalInTab = activeTab === 'used' ? usedOrders.length : newOrders.length;

  const stats = useMemo(() => {
    const pool = activeTab === 'used' ? usedOrders : newOrders;
    const activeCount = pool.filter((o) => ACTIVE_STATUSES.has(o.status_code || 'pending')).length;
    const totalSum = pool.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    return { total: pool.length, activeCount, totalSum };
  }, [activeTab, usedOrders, newOrders]);

  const handleProductClick = (item, e) => {
    e?.stopPropagation?.();
    if (item.product_id) {
      navigate(`/part/${item.product_id}`);
    }
  };

  const toggleUsedOrderExpand = (orderId) => {
    setExpandedUsedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const toggleNewOrderExpand = (orderId) => {
    setExpandedNewOrderId((prev) => (prev === orderId ? null : orderId));
  };

  if (!isReady || !isAuthenticated) {
    return <AuthLoadingScreen className="min-h-[16rem]" />;
  }

  const catalogHref = activeTab === 'used' ? '/autoparts/used' : '/autoparts/new';

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
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Тип заказов">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'used'}
              onClick={() => setActiveTab('used')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                activeTab === 'used'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Б/У запчасти
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  activeTab === 'used' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {usedOrders.length}
              </span>
            </button>
            {canViewNewOrders && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'new'}
                onClick={() => setActiveTab('new')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  activeTab === 'new'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Новые
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    activeTab === 'new' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {newOrders.length}
                </span>
              </button>
            )}
          </div>

          <div className="relative min-w-0 flex-1 sm:max-w-xs">
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
              placeholder={
                activeTab === 'used'
                  ? 'Поиск по номеру, продавцу, товару…'
                  : 'Поиск по номеру, товару…'
              }
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 px-3 py-3">
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

      {!loading && !error && newOrdersLoadFailed && activeTab === 'new' && (
        <p className="text-sm text-amber-700">
          Не удалось загрузить заказы новых запчастей. Попробуйте обновить страницу.
        </p>
      )}

      {!loading && !error && (
        <>
          {totalInTab > 0 && activeOrders.length !== totalInTab && (
            <p className="text-sm text-gray-500">
              Показано {activeOrders.length} из {totalInTab} заказов
            </p>
          )}

          <div className="space-y-4">
            {activeOrders.map((order) => (
              <PurchaseOrderCard
                key={order.id}
                order={{
                  ...order,
                  delivery_method_name: getGarageDeliveryInfo(order),
                }}
                orderType={activeTab === 'used' ? 'used' : 'new'}
                isExpanded={
                  activeTab === 'used'
                    ? expandedUsedOrderId === order.id
                    : expandedNewOrderId === order.id
                }
                onToggle={activeTab === 'used' ? toggleUsedOrderExpand : toggleNewOrderExpand}
                formatDate={formatDate}
                formatPrice={formatPrice}
                getStatusColor={getGarageStatusColor}
                getStatusName={getGarageStatusName}
                getDeliveryInfo={getGarageDeliveryInfo}
                onProductClick={handleProductClick}
              />
            ))}
          </div>

          {activeOrders.length === 0 && (
            <PurchaseOrdersEmptyState
              orderType={activeTab === 'used' ? 'used' : 'new'}
              catalogHref={catalogHref}
            />
          )}
        </>
      )}
    </div>
  );
}
