import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';
import { useAuthReady } from '../../hooks/useAuthReady';
import PurchaseOrderCard, { PurchaseOrdersEmptyState } from '../../components/PurchaseOrderCard/PurchaseOrderCard';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import RepairOrderPickerModal from '../../components/Autoservice/RepairOrderPickerModal';
import { buildUnifiedOrders, getUnifiedOrderKey } from '../../utils/orderSourceMeta';
import { getGarageDeliveryInfo, normalizeNewPartsCustomerStatus, getGarageStatusColor, getGarageStatusName, getUsedOrderBuyerHint, getNewOrderBuyerHint } from '../../utils/garageOrderUi';
import { fetchAvitoChatProductLink } from '../../redux/slices/AvitoChatSlice';
import { isUsedOrderReturnEligible, TERMINAL_RETURN_STATUSES } from '../../utils/returnStatusUi';
import { openOrderItemProductFlow } from '../../utils/avitoProductFlow';
import { subscribeToPushNotifications } from '../../redux/slices/ChatSlice';
import { isOrganizationStaff } from '../../utils/clientMarkupUtils';
import { userHasAutoserviceOrganization } from '../../utils/sellerAutoserviceMode';
import {
  groupPurchaseSelections,
  linkedRepairOrderFromItems,
  purchaseSelectionKey,
  saveLinkedRepairOrder,
} from '../../utils/repairOrderPurchaseDraft';
import {
  warehousePageClass,
  warehousePillControlClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';

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

const statusFilterButtonClass = (active) =>
  `inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition ${
    active
      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
      : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
  }`;

function OrdersHeaderStats({ stats, formatPrice }) {
  return (
    <div className="grid grid-cols-3 gap-4 sm:flex sm:shrink-0 sm:gap-8">
      <div className="text-center">
        <div className="text-2xl font-bold tabular-nums text-gray-900 leading-none sm:text-[1.75rem]">{stats.total}</div>
        <div className="mt-1.5 text-xs text-gray-500 sm:text-sm">Всего</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold tabular-nums text-indigo-600 leading-none sm:text-[1.75rem]">{stats.activeCount}</div>
        <div className="mt-1.5 text-xs text-gray-500 sm:text-sm">В работе</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-bold tabular-nums text-gray-900 leading-none sm:text-[1.75rem]">{formatPrice(stats.totalSum)}</div>
        <div className="mt-1.5 text-xs text-gray-500 sm:text-sm">Сумма</div>
      </div>
    </div>
  );
}

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
  const user = useSelector((state) => state.auth.user);
  const canLinkRepairOrder = isOrganizationStaff(user) && userHasAutoserviceOrganization(user);
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
  const [selectedItemKeys, setSelectedItemKeys] = useState(new Set());
  const [repairPickerOpen, setRepairPickerOpen] = useState(false);
  const [pickerLinkedOrder, setPickerLinkedOrder] = useState(null);

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

  const [pickerGroups, setPickerGroups] = useState([]);

  const buildEntriesForOrder = useCallback((orderType, orderId, items) => {
    const entries = [];
    (items || []).forEach((item) => {
      const key = purchaseSelectionKey(orderType, orderId, item.id);
      if (!selectedItemKeys.has(key)) return;
      entries.push({
        orderType,
        orderId,
        itemId: item.id,
        brand: item.brand || '',
        partnumber: item.partnumber || '',
        name: item.name || item.product_name || '',
        quantity: item.quantity || 1,
        price: item.price || 0,
        product_id: item.product_id || null,
        repairOrderId: item.repair_order_id || null,
        repairOrderNumber: item.repair_order_number || null,
      });
    });
    return entries;
  }, [selectedItemKeys]);

  const handleTogglePurchaseItem = (orderType, orderId, item) => {
    const key = purchaseSelectionKey(orderType, orderId, item.id);
    setSelectedItemKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleToggleAllPurchaseItems = (orderType, orderId, items) => {
    const keys = items.map((item) => purchaseSelectionKey(orderType, orderId, item.id));
    const allSelected = keys.length > 0 && keys.every((key) => selectedItemKeys.has(key));
    setSelectedItemKeys((prev) => {
      const next = new Set(prev);
      if (allSelected) keys.forEach((key) => next.delete(key));
      else keys.forEach((key) => next.add(key));
      return next;
    });
  };

  const handleAddToRepairOrder = (orderType, orderId, items) => {
    const entries = buildEntriesForOrder(orderType, orderId, items);
    const groups = groupPurchaseSelections(entries);
    if (!groups.length) return;
    setPickerGroups(groups);
    setPickerLinkedOrder(linkedRepairOrderFromItems(entries));
    setRepairPickerOpen(true);
  };

  const handleRepairImported = (order) => {
    if (order?.id) {
      saveLinkedRepairOrder(order);
    }
    setPickerLinkedOrder(order?.id
      ? { id: order.id, order_number: order.order_number || null }
      : null);
    setSelectedItemKeys(new Set());
    setPickerGroups([]);
    setRepairPickerOpen(false);
    fetchAll(true);
  };

  if (!isReady || !isAuthenticated) {
    return <AuthLoadingScreen className="min-h-[16rem]" />;
  }

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-4`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Мои заказы</h1>
        {!loading && !error ? <OrdersHeaderStats stats={stats} formatPrice={formatPrice} /> : null}
      </div>

      <div className="space-y-3">
        <div className="relative min-w-0 rounded-full transition focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-400/70">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по номеру, продавцу, товару…"
            className={`${warehousePillControlClass} pr-10`}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600"
              aria-label="Очистить поиск"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>

        <div className={warehouseToolbarClass} aria-label="Фильтр по статусу">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={statusFilterButtonClass(statusFilter === opt.id)}
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
              const selectedItems = (order.items || []).filter((item) => (
                selectedItemKeys.has(purchaseSelectionKey(entry.source, order.id, item.id))
              ));
              const repairOrderActionLabel = selectedItems.some((item) => item.repair_order_id)
                ? 'Изменить заказ-наряд'
                : 'Добавить к заказ-наряду';

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
                  selectable={canLinkRepairOrder}
                  selectedItemKeys={selectedItemKeys}
                  onToggleItem={handleTogglePurchaseItem}
                  onToggleAllItems={handleToggleAllPurchaseItems}
                  repairOrderActionLabel={repairOrderActionLabel}
                  onAddToRepairOrder={handleAddToRepairOrder}
                />
              );
            })}
          </div>

          {filteredUnifiedOrders.length === 0 && (
            <PurchaseOrdersEmptyState hasAnyOrders={stats.total > 0} />
          )}
        </>
      )}

      <RepairOrderPickerModal
        open={repairPickerOpen}
        onClose={() => {
          setRepairPickerOpen(false);
          setPickerGroups([]);
        }}
        groups={pickerGroups}
        linkedRepairOrder={pickerLinkedOrder}
        onImported={handleRepairImported}
      />
    </div>
  );
}
