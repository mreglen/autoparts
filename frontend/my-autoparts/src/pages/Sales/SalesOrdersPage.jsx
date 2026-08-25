import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';
import { subscribeToPushNotifications } from '../../redux/slices/ChatSlice';
import { fetchSalesMenuCounts } from '../../redux/slices/SalesMenuCountsSlice';
import { AvitoOrderCard } from '../../components/AvitoOrderCard';
import SalesGarageOrderCard from '../../components/SalesOrders/SalesGarageOrderCard';
import SalesOrdersEmptyState from '../../components/SalesOrders/SalesOrdersEmptyState';
import PickupVerifyModal from '../../components/SalesOrders/PickupVerifyModal';
import ItemConfirmScanModal from '../../components/SalesOrders/ItemConfirmScanModal';
import OrderPaymentModal from '../../components/SalesOrders/OrderPaymentModal';
import Modal, { ConfirmDialog } from '../../components/UI/Modal';
import Button from '../../components/UI/Button';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import OrderSourceBadge from '../../components/Orders/OrderSourceBadge';
import {
  warehousePageClass,
  warehousePillControlClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';
import { Skeleton, SkeletonHeaderStats, SkeletonListCards } from '../../components/UI';
import { buildUnifiedOrders, getUnifiedOrderKey } from '../../utils/orderSourceMeta';
import {
  getAvitoBuyerAndDelivery,
  getAvitoDisplayTotal,
  getAvitoMobileDeliveryText,
  getAvitoOrderItems,
  getAvitoLineItemTitle,
  getAvitoWarehouseCanRetry,
  getAvitoWarehouseMismatch,
  getAvitoSkipReasonsForDisplay,
} from './avitoOrderDisplay';
import { useAvitoAccountStatus } from '../../hooks/useAvitoAccountStatus';
import { canUseAvitoProFeatures } from '../../utils/avitoProAccess';
import {
  formatGarageOrderDate,
  formatGarageOrderPrice,
  getGarageDeliveryInfo,
  GARAGE_STATUS_COLORS,
  GARAGE_STATUS_NAMES,
  GARAGE_ACTIVE_STATUSES,
  GARAGE_COMPLETED_STATUSES,
  normalizeNewPartsCustomerStatus,
  AVITO_STATUS_COLORS,
  AVITO_ACTIVE_STATUSES,
  AVITO_COMPLETED_STATUSES,
  AVITO_CANCELED_STATUSES,
} from '../../utils/garageOrderUi';

const STATUS_FILTER_OPTIONS = [
  { id: 'all', label: 'Все' },
  { id: 'active', label: 'В работе' },
  { id: 'completed', label: 'Завершённые' },
  { id: 'rejected', label: 'Отменённые' },
];

const modalFieldClass =
  'mt-1 w-full min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm max-md:text-base text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20';

const statusFilterButtonClass = (active) =>
  `inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium transition ${
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

function matchesGarageStatusFilter(order, filterId, tab = 'used') {
  const code = tab === 'new'
    ? normalizeNewPartsCustomerStatus(order.status_code)
    : (order.status_code || 'pending');
  if (filterId === 'all') return true;
  if (filterId === 'active') return GARAGE_ACTIVE_STATUSES.has(code);
  if (filterId === 'completed') return GARAGE_COMPLETED_STATUSES.has(code);
  if (filterId === 'rejected') return code === 'rejected';
  return true;
}

function matchesAvitoStatusFilter(order, filterId) {
  const code = order.avito_status_code || '';
  if (filterId === 'all') return true;
  if (filterId === 'active') return AVITO_ACTIVE_STATUSES.has(code);
  if (filterId === 'completed') return AVITO_COMPLETED_STATUSES.has(code);
  if (filterId === 'rejected') return AVITO_CANCELED_STATUSES.has(code);
  return true;
}

export default function SalesOrdersPage() {
  const dispatch = useDispatch();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const { status: avitoAccountStatus } = useAvitoAccountStatus(user?.organization_id, {
    enabled: Boolean(user?.organization_id),
  });
  const avitoProActive = canUseAvitoProFeatures(avitoAccountStatus);

  const hasPermission = user?.is_admin || user?.is_seller ||
    (user?.is_employee && permissionCodes && permissionCodes.includes('sales.orders'));

  useEffect(() => {
    if (!hasPermission) return;
    dispatch(subscribeToPushNotifications({ prompt: true }));
  }, [dispatch, hasPermission]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const [usedOrders, setUsedOrders] = useState([]);
  const [newOrders, setNewOrders] = useState([]);
  const [avitoOrders, setAvitoOrders] = useState([]);
  const [expandedOrderKey, setExpandedOrderKey] = useState(null);
  const [canViewNewOrders, setCanViewNewOrders] = useState(false);

  const [editingStatus, setEditingStatus] = useState(null); // garage: {type, orderId, itemId?} | avito: {type, id}
  const [availableStatuses, setAvailableStatuses] = useState([]);
  const [transitionLoadingByOrderId, setTransitionLoadingByOrderId] = useState({});
  const [warehouseRetryLoadingByOrderId, setWarehouseRetryLoadingByOrderId] = useState({});
  const [supplierRefreshLoadingByOrderId, setSupplierRefreshLoadingByOrderId] = useState({});
  const [transitionError, setTransitionError] = useState('');
  const [avitoWarehouseMessage, setAvitoWarehouseMessage] = useState(null);
  const [usedOrderStatusMessage, setUsedOrderStatusMessage] = useState(null);
  const [cncPreparedByOrderId, setCncPreparedByOrderId] = useState({});
  const [receiveCodeModal, setReceiveCodeModal] = useState({
    isOpen: false,
    order: null,
    step: 'hint',
    confirmCode: '',
    error: '',
    isSubmitting: false,
  });
  const [cncPrepareModal, setCncPrepareModal] = useState({
    isOpen: false,
    order: null,
    address: '',
    bookingPeriod: '4',
    details: '',
    error: '',
    isSubmitting: false,
  });
  const [pickupModal, setPickupModal] = useState({
    isOpen: false,
    order: null,
    orderKind: 'used',
    error: '',
    isSubmitting: false,
  });
  const [itemConfirmModal, setItemConfirmModal] = useState({
    isOpen: false,
    order: null,
    item: null,
    orderKind: 'used',
    error: '',
    isSubmitting: false,
    productCard: null,
    productCardLoading: false,
    productCardError: '',
  });
  const [paymentModal, setPaymentModal] = useState({
    isOpen: false,
    order: null,
    item: null,
    methods: [],
    methodsLoading: false,
    methodsError: '',
    error: '',
    isSubmitting: false,
  });
  const [cancelPaymentModal, setCancelPaymentModal] = useState({
    isOpen: false,
    order: null,
    item: null,
    isSubmitting: false,
  });
  const [unpaidIssueModal, setUnpaidIssueModal] = useState({
    isOpen: false,
    order: null,
    orderKind: 'used',
    unpaidItems: [],
  });
  const [unconfirmItemModal, setUnconfirmItemModal] = useState({
    isOpen: false,
    order: null,
    item: null,
  });

  const usedOrderStatusOptions = useMemo(() => {
    if (availableStatuses.length > 0) return availableStatuses;
    return [
      { code: 'pending', name: 'В ожидании' },
      { code: 'confirmed', name: 'Подтверждён' },
      { code: 'rejected', name: 'Не подтверждён' },
      { code: 'assembled', name: 'Сформирован' },
      { code: 'ready_for_pickup', name: 'К выдаче' },
      { code: 'shipped', name: 'Передан в доставку' },
      { code: 'delivered', name: 'Получен' },
      { code: 'closed', name: 'Закрыт' },
    ];
  }, [availableStatuses]);

  const newOrderStatusOptions = useMemo(() => ([
    { code: 'new_waiting_confirmation', name: 'Ждёт подтверждения' },
    { code: 'new_assembling', name: 'Комплектуется' },
    { code: 'new_shipped', name: 'Отгружено' },
    { code: 'new_awaiting_arrival', name: 'Ожидает поступления' },
    { code: 'new_ready_for_pickup', name: 'К выдаче' },
    { code: 'new_received', name: 'Получен' },
  ]), []);

  const formatDate = formatGarageOrderDate;
  const formatPrice = formatGarageOrderPrice;

  const getGarageStatusColor = (statusCode) => GARAGE_STATUS_COLORS[statusCode] || GARAGE_STATUS_COLORS.closed;
  const getGarageStatusName = (statusCode, orderType = 'used') => {
    const code = orderType === 'new' ? normalizeNewPartsCustomerStatus(statusCode) : (statusCode || 'pending');
    return GARAGE_STATUS_NAMES[code] || code;
  };

  const getAvitoStatusColor = (statusCode) => AVITO_STATUS_COLORS[statusCode] || AVITO_STATUS_COLORS.closed;

  const getAvitoStatusName = (statusCode, order = null) => {
    if (order?.id && statusCode === 'on_confirmation' && cncPreparedByOrderId[order.id]?.prepared) {
      return 'Передайте заказ';
    }
    const statusMap = {
      on_confirmation: 'Ожидает подтверждения',
      ready_to_ship: 'Ждет отправки',
      in_transit: 'В пути',
      delivered: 'Доставлен',
      canceled: 'Отменен',
      closed: 'Закрыт',
      on_return: 'На возврате',
      in_dispute: 'Открыт спор',
    };
    return statusMap[statusCode] || statusCode;
  };

  const fetchAll = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const results = await Promise.allSettled([
        apiAxios.get('/sales/used-parts-orders'),
        apiAxios.get('/sales/new-parts-orders'),
        avitoProActive ? apiAxios.get('/sales/avito-orders') : Promise.resolve({ data: [] }),
      ]);

      const [usedRes, newRes, avitoRes] = results;

      if (usedRes.status === 'fulfilled') {
        setUsedOrders(Array.isArray(usedRes.value.data) ? usedRes.value.data : []);
      } else {
        throw usedRes.reason;
      }

      if (avitoRes.status === 'fulfilled') {
        setAvitoOrders(Array.isArray(avitoRes.value.data) ? avitoRes.value.data : []);
      } else if (!avitoProActive) {
        setAvitoOrders([]);
      } else {
        throw avitoRes.reason;
      }

      let canView = false;
      if (newRes.status === 'fulfilled') {
        canView = true;
        setNewOrders(Array.isArray(newRes.value.data) ? newRes.value.data : []);
      } else {
        const statusCode = newRes.reason?.response?.status;
        if (statusCode === 403) {
          setNewOrders([]);
        } else {
          throw newRes.reason;
        }
      }
      setCanViewNewOrders(canView);

      if (canView) {
        apiAxios
          .post('/sales/new-parts-orders/sync-supplier-status')
          .then((response) => {
            setNewOrders(Array.isArray(response.data) ? response.data : []);
          })
          .catch(() => {});
      }
      if (avitoProActive) {
        apiAxios
          .post('/sales/avito-orders/sync')
          .catch(() => {})
          .then(() => apiAxios.get('/sales/avito-orders'))
          .then((response) => {
            setAvitoOrders(Array.isArray(response.data) ? response.data : []);
          })
          .catch(() => {});
      }
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [avitoProActive]);

  useEffect(() => {
    if (!hasPermission) return;
    fetchAll();
  }, [hasPermission, fetchAll]);

  useEffect(() => {
    const onPullRefresh = (event) => {
      const path = event.detail?.pathname || '';
      if (path === '/warehouse-sales' || path.startsWith('/warehouse-sales?')) {
        fetchAll(true);
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [fetchAll]);

  useEffect(() => {
    if (!hasPermission) return;
    apiAxios.get('/orders/statuses/').then((r) => {
      setAvailableStatuses(Array.isArray(r.data) ? r.data : []);
    }).catch(() => {});
  }, [hasPermission]);

  useEffect(() => {
    const preparedMap = {};
    avitoOrders.forEach((order) => {
      const prepared = order?.avito_data?.cncPrepared;
      if (prepared?.prepared) {
        preparedMap[order.id] = {
          prepared: true,
          address: prepared.address || '',
          details: prepared.details || '',
          bookingPeriod: prepared.bookingPeriod || 4,
        };
      }
    });
    if (Object.keys(preparedMap).length > 0) {
      setCncPreparedByOrderId((prev) => ({ ...preparedMap, ...prev }));
    }
  }, [avitoOrders]);

  const formatStatusErrorDetail = (detail) => {
    if (!detail) return 'Не удалось обновить статус заказа';
    if (typeof detail === 'string') return detail;
    if (typeof detail === 'object' && detail.message) {
      const extra = detail.product_id != null
        ? ` (товар №${detail.product_id}, запрошено: ${detail.requested}, доступно: ${detail.available})`
        : '';
      return `${detail.message}${extra}`;
    }
    return 'Не удалось обновить статус заказа';
  };

  const updateUsedOrderStatus = async (orderId, statusCode, itemId = null) => {
    setUsedOrderStatusMessage(null);
    try {
      const url = itemId
        ? `/sales/used-parts-orders/${orderId}/items/${itemId}/status`
        : `/sales/used-parts-orders/${orderId}/status`;
      const response = await apiAxios.put(url, { status_code: statusCode });
      const fulfilled = Array.isArray(response.data?.fulfilled_items)
        ? response.data.fulfilled_items
        : [];
      const orderStatusFromApi = response.data?.order_status_code;

      setUsedOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          if (itemId) {
            const nextItems = (o.items || []).map((item) => {
              if (item.id !== itemId) return item;
              const match = fulfilled.find((f) => f.order_item_id === item.id);
              return {
                ...item,
                status_code: statusCode,
                ...(match
                  ? { stock_out_id: match.stock_out_id }
                  : {}),
              };
            });
            return {
              ...o,
              status_code: orderStatusFromApi ?? o.status_code,
              items: nextItems,
            };
          }
          const nextItems = (o.items || []).map((item) => {
            const match = fulfilled.find((f) => f.order_item_id === item.id);
            if (!match) {
              return { ...item, status_code: statusCode };
            }
            return {
              ...item,
              stock_out_id: match.stock_out_id,
              status_code: statusCode,
            };
          });
          return { ...o, status_code: statusCode, items: nextItems };
        })
      );
      setEditingStatus(null);
      setUsedOrderStatusMessage(null);
      dispatch(fetchSalesMenuCounts());
      return true;
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setUsedOrderStatusMessage({
        type: 'error',
        text: formatStatusErrorDetail(detail),
      });
      return false;
    }
  };

  const updateNewOrderStatus = async (orderId, statusCode, itemId = null) => {
    try {
      const url = itemId
        ? `/sales/new-parts-orders/${orderId}/items/${itemId}/status`
        : `/sales/new-parts-orders/${orderId}/status`;
      const response = await apiAxios.put(url, { status_code: statusCode });
      const orderStatusFromApi = response.data?.order_status_code ?? statusCode;

      setNewOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          if (itemId) {
            return {
              ...o,
              status_code: orderStatusFromApi,
              items: (o.items || []).map((item) =>
                item.id === itemId ? { ...item, status_code: statusCode } : item
              ),
            };
          }
          return {
            ...o,
            status_code: statusCode,
            items: (o.items || []).map((item) => ({ ...item, status_code: statusCode })),
          };
        })
      );
      setEditingStatus(null);
      setUsedOrderStatusMessage(null);
      dispatch(fetchSalesMenuCounts());
      return true;
    } catch (error) {
      setUsedOrderStatusMessage({
        type: 'error',
        text: formatStatusErrorDetail(error?.response?.data?.detail),
      });
      return false;
    }
  };

  const openPickupVerifyDirect = useCallback((order, orderKind) => {
    setPickupModal({
      isOpen: true,
      order,
      orderKind,
      error: '',
      isSubmitting: false,
    });
  }, []);

  const openPickupVerify = useCallback((order, orderKind) => {
    if (orderKind === 'used') {
      const unpaidItems = (order?.items || []).filter(
        (item) => !item.is_paid && (item.status_code || '') !== 'rejected'
      );
      if (unpaidItems.length > 0) {
        setUnpaidIssueModal({
          isOpen: true,
          order,
          orderKind,
          unpaidItems,
        });
        return;
      }
    }
    openPickupVerifyDirect(order, orderKind);
  }, [openPickupVerifyDirect]);

  const closeUnpaidIssueModal = useCallback(() => {
    setUnpaidIssueModal({
      isOpen: false,
      order: null,
      orderKind: 'used',
      unpaidItems: [],
    });
  }, []);

  const confirmUnpaidIssue = useCallback(() => {
    const { order, orderKind } = unpaidIssueModal;
    closeUnpaidIssueModal();
    if (order) {
      openPickupVerifyDirect(order, orderKind);
    }
  }, [unpaidIssueModal, closeUnpaidIssueModal, openPickupVerifyDirect]);

  const closePickupVerify = useCallback(() => {
    setPickupModal({
      isOpen: false,
      order: null,
      orderKind: 'used',
      error: '',
      isSubmitting: false,
    });
  }, []);

  const applyPickupLocalStatus = (orderId, orderKind, statusCode) => {
    const setter = orderKind === 'new' ? setNewOrders : setUsedOrders;
    setter((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          status_code: statusCode,
          items: (o.items || []).map((item) => ({ ...item, status_code: statusCode })),
        };
      })
    );
  };

  const submitPickupVerify = useCallback(async ({ code, qr_payload } = {}) => {
    const order = pickupModal.order;
    const orderKind = pickupModal.orderKind;
    if (!order) return;
    setPickupModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      const base =
        orderKind === 'new'
          ? `/sales/new-parts-orders/${order.id}`
          : `/sales/used-parts-orders/${order.id}`;
      const response = await apiAxios.post(`${base}/verify-pickup`, {
        code: code || undefined,
        qr_payload: qr_payload || undefined,
      });
      const statusCode = response.data?.status_code;
      applyPickupLocalStatus(order.id, orderKind, statusCode);
      closePickupVerify();
      dispatch(fetchSalesMenuCounts());
    } catch (error) {
      setPickupModal((prev) => ({
        ...prev,
        isSubmitting: false,
        error: formatStatusErrorDetail(error?.response?.data?.detail),
      }));
    }
  }, [pickupModal.order, pickupModal.orderKind, closePickupVerify, dispatch]);

  const closeItemConfirmModal = useCallback(() => {
    setItemConfirmModal({
      isOpen: false,
      order: null,
      item: null,
      orderKind: 'used',
      error: '',
      isSubmitting: false,
      productCard: null,
      productCardLoading: false,
      productCardError: '',
    });
  }, []);

  const openItemConfirmScan = useCallback(async (order, item, orderKind) => {
    if (!item?.product_id) return;
    setItemConfirmModal({
      isOpen: true,
      order,
      item,
      orderKind,
      error: '',
      isSubmitting: false,
      productCard: null,
      productCardLoading: true,
      productCardError: '',
    });
    try {
      const response = await apiAxios.get(`/products/qr-card/${item.product_id}`);
      setItemConfirmModal((prev) => ({
        ...prev,
        productCard: response.data,
        productCardLoading: false,
      }));
    } catch (_) {
      setItemConfirmModal((prev) => ({
        ...prev,
        productCardLoading: false,
        productCardError: 'Не удалось загрузить данные склада',
      }));
    }
  }, []);

  const submitItemConfirm = useCallback(async () => {
    const { order, item } = itemConfirmModal;
    if (!order || !item) return;
    setItemConfirmModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    const ok = await updateUsedOrderStatus(order.id, 'confirmed', item.id);
    if (ok) {
      closeItemConfirmModal();
      return;
    }
    setItemConfirmModal((prev) => ({
      ...prev,
      isSubmitting: false,
      error: 'Не удалось обновить статус позиции',
    }));
  }, [itemConfirmModal, closeItemConfirmModal, updateUsedOrderStatus]);

  const rejectItem = useCallback(async (order, item, orderKind) => {
    try {
      if (orderKind === 'new') {
        await updateNewOrderStatus(order.id, 'new_waiting_confirmation', item.id);
      } else {
        await updateUsedOrderStatus(order.id, 'rejected', item.id);
      }
    } catch (error) {
      setUsedOrderStatusMessage({
        type: 'error',
        text: formatStatusErrorDetail(error?.response?.data?.detail),
      });
    }
  }, []);

  const closePaymentModal = useCallback(() => {
    setPaymentModal({
      isOpen: false,
      order: null,
      item: null,
      methods: [],
      methodsLoading: false,
      methodsError: '',
      error: '',
      isSubmitting: false,
    });
  }, []);

  const openPaymentModal = useCallback(async (order, item = null) => {
    const orgId = order?.organization_id || user?.organization_id;
    setPaymentModal({
      isOpen: true,
      order,
      item: item || null,
      methods: [],
      methodsLoading: true,
      methodsError: '',
      error: '',
      isSubmitting: false,
    });
    if (!orgId) {
      setPaymentModal((prev) => ({
        ...prev,
        methodsLoading: false,
        methodsError: 'Не удалось определить организацию',
      }));
      return;
    }
    try {
      const response = await apiAxios.get(`/payment-methods/by-organization/${orgId}`);
      setPaymentModal((prev) => ({
        ...prev,
        methods: Array.isArray(response.data) ? response.data : [],
        methodsLoading: false,
      }));
    } catch (err) {
      setPaymentModal((prev) => ({
        ...prev,
        methodsLoading: false,
        methodsError: formatStatusErrorDetail(err?.response?.data?.detail) || 'Не удалось загрузить способы оплаты',
      }));
    }
  }, [user?.organization_id]);

  const applyUsedOrderPaymentLocal = useCallback((orderId, patchOrder, patchItem) => {
    setUsedOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const items = (o.items || []).map((item) => {
          if (patchItem && item.id === patchItem.id) {
            return { ...item, ...patchItem };
          }
          if (patchOrder?.markAllPaid) {
            if ((item.status_code || '') === 'rejected') return item;
            return {
              ...item,
              is_paid: true,
              payment_method_id: patchOrder.payment_method_id,
              payment_method_name: patchOrder.payment_method_name,
              paid_at: patchOrder.paid_at,
            };
          }
          if (patchOrder?.clearAllPaid) {
            return {
              ...item,
              is_paid: false,
              payment_method_id: null,
              payment_method_name: null,
              paid_at: null,
            };
          }
          return item;
        });
        const billable = items.filter((item) => (item.status_code || '') !== 'rejected');
        const orderIsPaid = billable.length > 0 && billable.every((item) => item.is_paid);
        return {
          ...o,
          ...patchOrder,
          markAllPaid: undefined,
          clearAllPaid: undefined,
          is_paid: patchOrder?.order_is_paid ?? orderIsPaid,
          items,
        };
      })
    );
  }, []);

  const submitOrderPayment = useCallback(async (method) => {
    const order = paymentModal.order;
    const item = paymentModal.item;
    if (!order || !method?.id) return;
    setPaymentModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      const url = item
        ? `/sales/used-parts-orders/${order.id}/items/${item.id}/mark-paid`
        : `/sales/used-parts-orders/${order.id}/mark-paid`;
      const response = await apiAxios.post(url, {
        payment_method_id: method.id,
      });
      const paidAt = response.data?.paid_at || new Date().toISOString();
      const methodName = response.data?.payment_method_name || method.name;
      const methodId = response.data?.payment_method_id ?? method.id;
      const orderIsPaid = response.data?.order_is_paid;
      if (item) {
        applyUsedOrderPaymentLocal(order.id, {
          order_is_paid: orderIsPaid,
          payment_method_id: orderIsPaid ? methodId : null,
          payment_method_name: orderIsPaid ? methodName : null,
          paid_at: orderIsPaid ? paidAt : null,
        }, {
          id: item.id,
          is_paid: true,
          payment_method_id: methodId,
          payment_method_name: methodName,
          paid_at: paidAt,
        });
      } else {
        applyUsedOrderPaymentLocal(order.id, {
          markAllPaid: true,
          order_is_paid: true,
          payment_method_id: methodId,
          payment_method_name: methodName,
          paid_at: paidAt,
        });
      }
      closePaymentModal();
      dispatch(fetchSalesMenuCounts());
    } catch (err) {
      setPaymentModal((prev) => ({
        ...prev,
        isSubmitting: false,
        error: formatStatusErrorDetail(err?.response?.data?.detail) || 'Не удалось подтвердить оплату',
      }));
    }
  }, [paymentModal.order, paymentModal.item, closePaymentModal, dispatch, applyUsedOrderPaymentLocal]);

  const openCancelPaymentModal = useCallback((order, item = null) => {
    setCancelPaymentModal({ isOpen: true, order, item: item || null, isSubmitting: false });
  }, []);

  const closeCancelPaymentModal = useCallback(() => {
    setCancelPaymentModal({ isOpen: false, order: null, item: null, isSubmitting: false });
  }, []);

  const submitCancelPayment = useCallback(async () => {
    const order = cancelPaymentModal.order;
    const item = cancelPaymentModal.item;
    if (!order) return;
    setCancelPaymentModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const url = item
        ? `/sales/used-parts-orders/${order.id}/items/${item.id}/unmark-paid`
        : `/sales/used-parts-orders/${order.id}/unmark-paid`;
      const response = await apiAxios.post(url);
      const orderIsPaid = response.data?.order_is_paid ?? false;
      if (item) {
        applyUsedOrderPaymentLocal(order.id, {
          order_is_paid: orderIsPaid,
          payment_method_id: null,
          payment_method_name: null,
          paid_at: null,
        }, {
          id: item.id,
          is_paid: false,
          payment_method_id: null,
          payment_method_name: null,
          paid_at: null,
        });
      } else {
        applyUsedOrderPaymentLocal(order.id, {
          clearAllPaid: true,
          order_is_paid: false,
          payment_method_id: null,
          payment_method_name: null,
          paid_at: null,
        });
      }
      closeCancelPaymentModal();
      dispatch(fetchSalesMenuCounts());
    } catch (err) {
      setCancelPaymentModal((prev) => ({ ...prev, isSubmitting: false }));
      setUsedOrderStatusMessage({
        type: 'error',
        text: formatStatusErrorDetail(err?.response?.data?.detail) || 'Не удалось отменить оплату',
      });
    }
  }, [cancelPaymentModal.order, cancelPaymentModal.item, closeCancelPaymentModal, dispatch, applyUsedOrderPaymentLocal]);

  const openUnconfirmItemModal = useCallback((order, item) => {
    setUnconfirmItemModal({ isOpen: true, order, item });
  }, []);

  const closeUnconfirmItemModal = useCallback(() => {
    setUnconfirmItemModal({ isOpen: false, order: null, item: null });
  }, []);

  const submitUnconfirmItem = useCallback(async () => {
    const { order, item } = unconfirmItemModal;
    if (!order || !item) return;
    const ok = await updateUsedOrderStatus(order.id, 'pending', item.id);
    if (ok) {
      closeUnconfirmItemModal();
      return;
    }
    setUsedOrderStatusMessage({
      type: 'error',
      text: 'Не удалось отменить статус позиции',
    });
  }, [unconfirmItemModal, closeUnconfirmItemModal, updateUsedOrderStatus]);

  const confirmRosskoItem = useCallback(async (order, item) => {
    try {
      await updateNewOrderStatus(order.id, 'new_assembling', item.id);
    } catch (error) {
      setUsedOrderStatusMessage({
        type: 'error',
        text: formatStatusErrorDetail(error?.response?.data?.detail),
      });
    }
  }, []);

  const refreshSupplierStatus = async (orderId) => {
    setSupplierRefreshLoadingByOrderId((prev) => ({ ...prev, [orderId]: true }));
    try {
      const response = await apiAxios.post(
        `/sales/new-parts-orders/${orderId}/refresh-supplier-status`
      );
      const updated = response.data;
      setNewOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o))
      );
      setUsedOrderStatusMessage(
        updated.rossko_sync_error
          ? {
              type: 'error',
              text: 'Статус поставщика временно недоступен. Показаны данные из базы.',
            }
          : null
      );
    } catch (error) {
      setUsedOrderStatusMessage({
        type: 'error',
        text: formatStatusErrorDetail(error?.response?.data?.detail),
      });
    } finally {
      setSupplierRefreshLoadingByOrderId((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const closeReceiveCodeModal = () => {
    setReceiveCodeModal({
      isOpen: false,
      order: null,
      step: 'hint',
      confirmCode: '',
      error: '',
      isSubmitting: false,
    });
  };

  const closeCncPrepareModal = () => {
    setCncPrepareModal({
      isOpen: false,
      order: null,
      address: '',
      bookingPeriod: '4',
      details: '',
      error: '',
      isSubmitting: false,
    });
  };

  const applyAvitoTransition = async (order, transition, options = {}) => {
    const { confirmCode } = options;
    const orderId = order.id;
    try {
      setTransitionError('');
      setTransitionLoadingByOrderId((prev) => ({ ...prev, [orderId]: true }));
      const avitoData = order.avito_data || {};
      const delivery = avitoData.delivery || {};
      const deliveryType = String(delivery.type || delivery.serviceType || '').toLowerCase();
      const marketplaceId = avitoData.marketplaceId ? String(avitoData.marketplaceId) : null;
      let params;

      if (deliveryType === 'cnc' && transition === 'receive') {
        if (!marketplaceId) {
          throw new Error('Для CNC-заказа не найден marketplaceId. Обновите заказ и повторите.');
        }
        if (!confirmCode || !confirmCode.trim()) {
          throw new Error('Код подтверждения обязателен для CNC-заказа.');
        }
        const normalizedCode = confirmCode.trim();
        params = {
          cnc: {
            marketplaceId,
            confirmCode: normalizedCode,
          },
        };
      }

      await apiAxios.post(`/sales/avito-orders/${orderId}/transition`, {
        transition,
        ...(params ? { params } : {}),
      });
      setAvailableTransitions((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      setEditingStatus(null);
      closeReceiveCodeModal();
      await fetchAll();
    } catch (error) {
      console.error('Ошибка изменения статуса Авито:', error);
      const message = error?.response?.data?.detail || error.message || 'Ошибка изменения статуса';
      if (receiveCodeModal.isOpen) {
        setReceiveCodeModal((prev) => ({ ...prev, error: message }));
      } else {
        setTransitionError(message);
      }
    } finally {
      setTransitionLoadingByOrderId((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleAvitoTransitionSelect = async (order, transition) => {
    if (!transition) return;
    setTransitionError('');

    const avitoData = order.avito_data || {};
    const delivery = avitoData.delivery || {};
    const deliveryType = String(delivery.type || delivery.serviceType || '').toLowerCase();
    const marketplaceId = avitoData.marketplaceId ? String(avitoData.marketplaceId) : null;
    const statusCode = String(order.avito_status_code || '').toLowerCase();

    if (transition === 'prepare_cnc') {
      if (!marketplaceId) {
        setTransitionError('Для CNC-заказа не найден marketplaceId. Обновите заказ и повторите.');
        setEditingStatus(null);
        return;
      }
      setCncPrepareModal({
        isOpen: true,
        order,
        address: '',
        bookingPeriod: '4',
        details: '',
        error: '',
        isSubmitting: false,
      });
      return;
    }

    if (deliveryType === 'cnc' && transition === 'receive') {
      if (!marketplaceId) {
        setTransitionError('Для CNC-заказа не найден marketplaceId. Обновите заказ и повторите.');
        setEditingStatus(null);
        return;
      }
      const needsPrepareStep = statusCode === 'on_confirmation';
      if (needsPrepareStep && !cncPreparedByOrderId[order.id]?.prepared) {
        setTransitionError('Сначала подготовьте CNC заказ, затем подтверждайте получение.');
        return;
      }
      setReceiveCodeModal({
        isOpen: true,
        order,
        step: 'hint',
        confirmCode: '',
        error: '',
        isSubmitting: false,
      });
      return;
    }

    await applyAvitoTransition(order, transition);
  };

  const submitCncPrepare = async () => {
    const modalOrder = cncPrepareModal.order;
    if (!modalOrder) {
      closeCncPrepareModal();
      return;
    }
    const address = cncPrepareModal.address.trim();
    const bookingPeriod = Number(cncPrepareModal.bookingPeriod);
    const details = cncPrepareModal.details.trim();
    if (!address) {
      setCncPrepareModal((prev) => ({ ...prev, error: 'Укажите адрес получения товара.' }));
      return;
    }
    if (!Number.isInteger(bookingPeriod) || bookingPeriod < 1) {
      setCncPrepareModal((prev) => ({ ...prev, error: 'Срок бронирования должен быть целым числом больше 0.' }));
      return;
    }

    setCncPrepareModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      await apiAxios.post(`/sales/avito-orders/${modalOrder.id}/cnc-set-details`, {
        address,
        booking_period: bookingPeriod,
        details: details || null,
      });
      setCncPreparedByOrderId((prev) => ({
        ...prev,
        [modalOrder.id]: {
          prepared: true,
          address,
          details,
          bookingPeriod,
        },
      }));
      closeCncPrepareModal();
      setTransitionError('');
    } catch (error) {
      const message = error?.response?.data?.detail || 'Не удалось подготовить CNC заказ';
      setCncPrepareModal((prev) => ({ ...prev, error: message }));
    } finally {
      setCncPrepareModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const submitReceiveCodeTransition = async () => {
    const modalOrder = receiveCodeModal.order;
    if (!modalOrder) {
      closeReceiveCodeModal();
      return;
    }
    const code = receiveCodeModal.confirmCode.trim();
    if (!code) {
      setReceiveCodeModal((prev) => ({ ...prev, error: 'Введите код подтверждения.' }));
      return;
    }
    if (!/^\d{4}$/.test(code)) {
      setReceiveCodeModal((prev) => ({ ...prev, error: 'Код должен состоять из 4 цифр.' }));
      return;
    }
    setReceiveCodeModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    await applyAvitoTransition(modalOrder, 'receive', { confirmCode: code });
    setReceiveCodeModal((prev) => ({ ...prev, isSubmitting: false }));
  };

  const [availableTransitions, setAvailableTransitions] = useState({}); // {orderId: ['confirm', 'reject', ...]}

  const fetchAvitoTransitions = async (orderId) => {
    if (availableTransitions[orderId]) {
      return availableTransitions[orderId];
    }
    
    try {
      const response = await apiAxios.get(`/sales/avito-orders/${orderId}/transitions`);
      const transitions = response.data?.transitions || [];
      setAvailableTransitions(prev => ({ ...prev, [orderId]: transitions }));
      return transitions;
    } catch (error) {
      console.error('Ошибка получения доступных действий:', error);
      setTransitionError(error?.response?.data?.detail || 'Не удалось получить доступные действия');
      return [];
    }
  };

  const getAvitoTransitionOptions = (order) => {
    const transitions = availableTransitions[order.id] || [];
    const avitoData = order.avito_data || {};
    const delivery = avitoData.delivery || {};
    const deliveryType = String(delivery.type || delivery.serviceType || '').toLowerCase();
    const statusCode = String(order.avito_status_code || '').toLowerCase();
    if (deliveryType !== 'cnc') {
      return transitions;
    }
    const needsPrepareStep = statusCode === 'on_confirmation';
    if (!needsPrepareStep || !transitions.includes('receive') || cncPreparedByOrderId[order.id]?.prepared) {
      return transitions;
    }
    return ['prepare_cnc', ...transitions.filter((transition) => transition !== 'receive')];
  };

  const getCncReceiveHint = (order) => {
    const avitoData = order?.avito_data || {};
    const prepared = cncPreparedByOrderId[order?.id] || {};
    const marketplaceId = avitoData.marketplaceId || order?.avito_order_id;
    const schedules = avitoData.schedules || {};
    const receiveBefore = schedules.deliveryDateMax || schedules.deliveryDateMin || null;
    return {
      marketplaceId: String(marketplaceId || ''),
      receiveBefore,
      address: prepared.address || 'не указан',
      details: prepared.details || 'не указан',
    };
  };

  const getAvitoTransitionLabel = (transition) => {
    const labels = {
      confirm: 'Подтвердить заказ',
      reject: 'Отменить заказ',
      perform: 'Подтвердить отправку',
      receive: 'Подтвердить доставку',
      prepare_cnc: 'Подготовить заказ (CNC)',
    };
    return labels[transition] || transition;
  };

  const retryAvitoWarehouse = async (order) => {
    const orderId = order.id;
    setWarehouseRetryLoadingByOrderId((prev) => ({ ...prev, [orderId]: true }));
    setAvitoWarehouseMessage(null);
    try {
      const response = await apiAxios.post(`/sales/avito-orders/${orderId}/retry-warehouse`);
      const wf = response.data?.warehouse_fulfillment;
      setAvitoOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                closed_processed: wf?.status === 'fulfilled',
                warehouse_fulfillment: wf || o.warehouse_fulfillment,
              }
            : o
        )
      );
      const created = response.data?.created_count ?? 0;
      if (wf?.status === 'fulfilled') {
        setAvitoWarehouseMessage({
          type: 'success',
          text: `Склад проведён${created > 0 ? ` (новых списаний: ${created})` : ''}.`,
        });
      } else if (created > 0) {
        setAvitoWarehouseMessage({
          type: 'success',
          text: `Частично проведено (новых списаний: ${created}). Проверьте причины ниже.`,
        });
      } else {
        setAvitoWarehouseMessage({
          type: 'error',
          text: 'Склад не проведён. Исправьте причины и повторите.',
        });
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setAvitoWarehouseMessage({
        type: 'error',
        text: typeof detail === 'string' ? detail : 'Не удалось провести склад',
      });
    } finally {
      setWarehouseRetryLoadingByOrderId((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  };

  const toggleOrderExpand = (key) => {
    setExpandedOrderKey((prev) => (prev === key ? null : key));
  };

  // Wrapper for setEditingStatus that handles fetchTransitions
  const handleEditStatus = async (status) => {
    if (status?.fetchTransitions) {
      await fetchAvitoTransitions(status.id);
      // Remove the fetchTransitions flag
      const { fetchTransitions, ...rest } = status;
      setEditingStatus(rest);
    } else {
      setEditingStatus(status);
    }
  };

  const allOrdersPool = useMemo(
    () => buildUnifiedOrders(usedOrders, newOrders, avitoOrders, { canViewNewOrders, avitoProActive }),
    [usedOrders, newOrders, avitoOrders, canViewNewOrders, avitoProActive]
  );

  const filterUnifiedEntry = useCallback(
    (entry) => {
      const { source, order } = entry;
      const statusOk =
        source === 'avito'
          ? matchesAvitoStatusFilter(order, statusFilter)
          : matchesGarageStatusFilter(order, statusFilter, source);
      if (!statusOk) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      if (source === 'avito') {
        const { buyerName, buyerPhone, delivery } = getAvitoBuyerAndDelivery(order);
        const haystack = [
          order.id,
          order.avito_order_id,
          buyerName,
          buyerPhone,
          getAvitoMobileDeliveryText(delivery),
          ...getAvitoOrderItems(order).map((item) => getAvitoLineItemTitle(item)),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      }

      const haystack = [
        order.id,
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
    [searchQuery, statusFilter]
  );

  const filteredUnifiedOrders = useMemo(
    () => allOrdersPool.filter(filterUnifiedEntry),
    [allOrdersPool, filterUnifiedEntry]
  );

  const stats = useMemo(() => {
    let activeCount = 0;
    let totalSum = 0;
    allOrdersPool.forEach(({ source, order }) => {
      if (source === 'avito') {
        if (AVITO_ACTIVE_STATUSES.has(order.avito_status_code)) activeCount += 1;
        totalSum += getAvitoDisplayTotal(order);
      } else {
        const code = source === 'new'
          ? normalizeNewPartsCustomerStatus(order.status_code)
          : (order.status_code || 'pending');
        if (GARAGE_ACTIVE_STATUSES.has(code)) activeCount += 1;
        totalSum += Number(order.total_amount || 0);
      }
    });
    return { total: allOrdersPool.length, activeCount, totalSum };
  }, [allOrdersPool]);

  const sourceCounts = useMemo(
    () => ({
      used: usedOrders.length,
      new: canViewNewOrders ? newOrders.length : 0,
      avito: avitoProActive ? avitoOrders.length : 0,
    }),
    [usedOrders.length, newOrders.length, avitoOrders.length, canViewNewOrders, avitoProActive]
  );

  const avitoWarehouseRetryCount = useMemo(
    () => (avitoProActive ? avitoOrders.filter((order) => getAvitoWarehouseCanRetry(order)).length : 0),
    [avitoOrders, avitoProActive],
  );

  if (!hasPermission) {
    return null;
  }

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-4`}>
      <div className="space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Заказы</h1>
            {refreshing ? (
              <span className="text-sm text-gray-500" aria-live="polite">Обновление…</span>
            ) : null}
          </div>
          {loading ? <SkeletonHeaderStats /> : !error ? <OrdersHeaderStats stats={stats} formatPrice={formatPrice} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3" aria-label="Источники заказов">
          {loading ? (
            <>
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </>
          ) : (
            <>
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <OrderSourceBadge source="used" size="sm" />
            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium tabular-nums text-gray-700">
              {sourceCounts.used}
            </span>
          </span>
          {canViewNewOrders && (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <OrderSourceBadge source="rossko" size="sm" />
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium tabular-nums text-gray-700">
                {sourceCounts.new}
              </span>
            </span>
          )}
          {avitoProActive && (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <OrderSourceBadge source="avito" size="sm" />
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium tabular-nums text-gray-700">
                {sourceCounts.avito}
              </span>
            </span>
          )}
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative min-w-0 rounded-full transition focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-400/70">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Покупатель, телефон, № заказа…"
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

      {loading && <SkeletonListCards />}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => fetchAll()}
            className="mt-3 min-h-11 rounded-xl bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700"
          >
            Повторить
          </button>
        </div>
      )}

      {!loading && !error && avitoWarehouseRetryCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {avitoWarehouseRetryCount}{' '}
          {avitoWarehouseRetryCount === 1 ? 'заказ Avito требует' : 'заказов Avito требуют'}
          {' '}
          повторной отправки на склад. Откройте карточку и нажмите «Повторить».
        </div>
      )}

      {!loading && !error && transitionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{transitionError}</div>
      )}

      {!loading && !error && usedOrderStatusMessage?.type === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {usedOrderStatusMessage.text}
        </div>
      )}

      {!loading && !error && avitoWarehouseMessage && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            avitoWarehouseMessage.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {avitoWarehouseMessage.text}
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

              if (entry.source === 'avito') {
                const o = entry.order;
                return (
                  <AvitoOrderCard
                    key={key}
                    order={o}
                    isExpanded={isExpanded}
                    onToggle={() => toggleOrderExpand(key)}
                    editingStatus={editingStatus}
                    onEditStatus={handleEditStatus}
                    onAvitoTransition={handleAvitoTransitionSelect}
                    transitionLoadingByOrderId={transitionLoadingByOrderId}
                    warehouseRetryLoadingByOrderId={warehouseRetryLoadingByOrderId}
                    onRetryWarehouse={retryAvitoWarehouse}
                    getAvitoTransitionOptions={getAvitoTransitionOptions}
                    getAvitoTransitionLabel={getAvitoTransitionLabel}
                    getAvitoStatusColor={getAvitoStatusColor}
                    getAvitoStatusName={getAvitoStatusName}
                    formatDate={formatDate}
                    formatPrice={formatPrice}
                    getAvitoWarehouseMismatch={getAvitoWarehouseMismatch}
                    getAvitoWarehouseCanRetry={getAvitoWarehouseCanRetry}
                    getAvitoSkipReasonsForDisplay={getAvitoSkipReasonsForDisplay}
                  />
                );
              }

              const o = entry.order;
              const isUsed = entry.source === 'used';
              return (
                <SalesGarageOrderCard
                  key={key}
                  order={o}
                  orderType={entry.source}
                  isExpanded={isExpanded}
                  onToggle={() => toggleOrderExpand(key)}
                  editingStatus={editingStatus}
                  onEditStatus={setEditingStatus}
                  onUpdateStatus={isUsed ? updateUsedOrderStatus : updateNewOrderStatus}
                  onOpenPickupVerify={openPickupVerify}
                  onOpenItemConfirm={openItemConfirmScan}
                  onOpenPayment={openPaymentModal}
                  onOpenCancelPayment={openCancelPaymentModal}
                  onOpenItemPayment={(order, item) => openPaymentModal(order, item)}
                  onOpenCancelItemPayment={(order, item) => openCancelPaymentModal(order, item)}
                  onOpenUnconfirmItem={openUnconfirmItemModal}
                  onRejectItem={rejectItem}
                  onConfirmRosskoItem={confirmRosskoItem}
                  getStatusColor={getGarageStatusColor}
                  getStatusName={(code) => getGarageStatusName(code, entry.source)}
                  orderStatusOptions={isUsed ? usedOrderStatusOptions : newOrderStatusOptions}
                  formatDate={formatDate}
                  formatPrice={formatPrice}
                  onRefreshSupplierStatus={!isUsed ? refreshSupplierStatus : undefined}
                  supplierRefreshLoading={Boolean(supplierRefreshLoadingByOrderId[o.id])}
                />
              );
            })}
          </div>

          {filteredUnifiedOrders.length === 0 && (
            <SalesOrdersEmptyState hasAnyOrders={stats.total > 0} />
          )}
        </>
      )}

        <Modal
          open={cncPrepareModal.isOpen}
          onClose={closeCncPrepareModal}
          title="Подготовка CNC заказа"
          size="sm"
          footer={(
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={closeCncPrepareModal} disabled={cncPrepareModal.isSubmitting}>
                Отмена
              </Button>
              <Button variant="accent" onClick={submitCncPrepare} loading={cncPrepareModal.isSubmitting}>
                {cncPrepareModal.isSubmitting ? 'Сохраняем...' : 'Подготовить'}
              </Button>
            </div>
          )}
        >
          <p className="text-sm text-gray-600">
            Заполните данные для передачи заказа покупателю перед подтверждением получения.
          </p>
          <label className="mt-4 block text-sm font-medium text-gray-700" htmlFor="cnc-prepare-address">
            Адрес получения
          </label>
          <input
            id="cnc-prepare-address"
            type="text"
            value={cncPrepareModal.address}
            onChange={(e) => setCncPrepareModal((prev) => ({ ...prev, address: e.target.value, error: '' }))}
            className={modalFieldClass}
            placeholder="г Екатеринбург, ул Фруктовая, 17"
          />
          <label className="mt-3 block text-sm font-medium text-gray-700" htmlFor="cnc-prepare-booking">
            Срок бронирования (дни)
          </label>
          <input
            id="cnc-prepare-booking"
            type="number"
            min="1"
            value={cncPrepareModal.bookingPeriod}
            onChange={(e) => setCncPrepareModal((prev) => ({ ...prev, bookingPeriod: e.target.value, error: '' }))}
            className={modalFieldClass}
          />
          <label className="mt-3 block text-sm font-medium text-gray-700" htmlFor="cnc-prepare-details">
            Комментарий покупателю
          </label>
          <textarea
            id="cnc-prepare-details"
            value={cncPrepareModal.details}
            onChange={(e) => setCncPrepareModal((prev) => ({ ...prev, details: e.target.value, error: '' }))}
            rows={3}
            className={`${modalFieldClass} min-h-[88px] resize-y`}
            placeholder="Могу передать товар с 13:00 до 18:00"
          />
          {cncPrepareModal.error ? (
            <div className="mt-2 text-sm text-red-600">{cncPrepareModal.error}</div>
          ) : null}
        </Modal>

        <Modal
          open={receiveCodeModal.isOpen}
          onClose={closeReceiveCodeModal}
          title="Выдача Avito · 4 цифры"
          size="sm"
          footer={(
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={closeReceiveCodeModal} disabled={receiveCodeModal.isSubmitting}>
                Отмена
              </Button>
              {receiveCodeModal.step === 'hint' ? (
                <Button
                  variant="accent"
                  onClick={() => setReceiveCodeModal((prev) => ({ ...prev, step: 'code', error: '' }))}
                >
                  Ввести код
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setReceiveCodeModal((prev) => ({ ...prev, step: 'hint', error: '' }))}
                    disabled={receiveCodeModal.isSubmitting}
                  >
                    Назад
                  </Button>
                  <Button
                    variant="accent"
                    onClick={submitReceiveCodeTransition}
                    loading={receiveCodeModal.isSubmitting}
                    disabled={String(receiveCodeModal.confirmCode || '').trim().length !== 4}
                  >
                    {receiveCodeModal.isSubmitting ? 'Проверка…' : 'Выдать'}
                  </Button>
                </>
              )}
            </div>
          )}
        >
          {receiveCodeModal.step === 'hint' ? (
            <div className="space-y-1 text-sm text-gray-600">
              {(() => {
                const hint = getCncReceiveHint(receiveCodeModal.order);
                return (
                  <>
                    {hint.marketplaceId ? <p>№ {hint.marketplaceId}</p> : null}
                    {hint.address ? <p>{hint.address}</p> : null}
                    {hint.receiveBefore ? <p>до {formatDate(hint.receiveBefore)}</p> : null}
                  </>
                );
              })()}
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">Код покупателя Avito</p>
              <input
                id="receive-confirm-code"
                type="text"
                inputMode="numeric"
                value={receiveCodeModal.confirmCode}
                onChange={(e) => setReceiveCodeModal((prev) => ({
                  ...prev,
                  confirmCode: e.target.value.replace(/\D/g, '').slice(0, 4),
                  error: '',
                }))}
                className="mt-3 w-full min-h-11 rounded-xl border border-gray-300 px-3 py-3 text-center font-mono text-2xl font-semibold tracking-[0.35em] text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="····"
              />
            </>
          )}
          {receiveCodeModal.error ? (
            <div className="mt-2 text-sm text-red-600">{receiveCodeModal.error}</div>
          ) : null}
        </Modal>

        <PickupVerifyModal
          isOpen={pickupModal.isOpen}
          orderId={pickupModal.order?.id}
          orderKind={pickupModal.orderKind}
          isSubmitting={pickupModal.isSubmitting}
          error={pickupModal.error}
          onClose={closePickupVerify}
          onVerify={submitPickupVerify}
        />

        <ItemConfirmScanModal
          isOpen={itemConfirmModal.isOpen}
          item={itemConfirmModal.item}
          productCard={itemConfirmModal.productCard}
          productCardLoading={itemConfirmModal.productCardLoading}
          productCardError={itemConfirmModal.productCardError}
          isSubmitting={itemConfirmModal.isSubmitting}
          error={itemConfirmModal.error}
          onClose={closeItemConfirmModal}
          onConfirm={submitItemConfirm}
        />

        <OrderPaymentModal
          isOpen={paymentModal.isOpen}
          order={paymentModal.order}
          item={paymentModal.item}
          methods={paymentModal.methods}
          methodsLoading={paymentModal.methodsLoading}
          methodsError={paymentModal.methodsError}
          isSubmitting={paymentModal.isSubmitting}
          error={paymentModal.error}
          formatPrice={formatPrice}
          onClose={closePaymentModal}
          onConfirm={submitOrderPayment}
        />

        <ConfirmDialog
          open={cancelPaymentModal.isOpen}
          onClose={closeCancelPaymentModal}
          onConfirm={submitCancelPayment}
          title="Отмена оплаты"
          message={
            cancelPaymentModal.item
              ? 'Отменить оплату позиции?'
              : 'Отменить оплату заказа?'
          }
          confirmLabel="Отменить"
          cancelLabel="Назад"
          danger
        />

        <Modal
          open={unpaidIssueModal.isOpen}
          onClose={closeUnpaidIssueModal}
          title="Выдать заказ?"
          size="sm"
          footer={(
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={closeUnpaidIssueModal}>
                Назад
              </Button>
              <Button variant="primary" onClick={confirmUnpaidIssue}>
                Выдать
              </Button>
            </div>
          )}
        >
          <p className="text-sm text-gray-600">Есть неоплаченные позиции:</p>
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {unpaidIssueModal.unpaidItems.map((item) => {
              const title = item.product_name || item.name || 'Товар';
              const meta = [item.brand, item.partnumber].filter(Boolean).join(' · ');
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-sm"
                >
                  <div className="font-medium text-gray-900">{title}</div>
                  {meta ? <div className="mt-0.5 text-xs text-gray-500">{meta}</div> : null}
                </li>
              );
            })}
          </ul>
        </Modal>

        <ConfirmDialog
          open={unconfirmItemModal.isOpen}
          onClose={closeUnconfirmItemModal}
          onConfirm={submitUnconfirmItem}
          title="Отмена позиции"
          message="Вы точно хотите отменить позицию?"
          confirmLabel="Да, отменить позицию"
          cancelLabel="Отмена"
          danger
        />
    </div>
  );
}

