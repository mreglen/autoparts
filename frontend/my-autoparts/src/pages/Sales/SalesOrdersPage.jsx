import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';
import { subscribeToPushNotifications } from '../../redux/slices/ChatSlice';
import { AvitoOrderCard } from '../../components/AvitoOrderCard';
import SalesGarageOrderCard from '../../components/SalesOrders/SalesGarageOrderCard';
import SalesOrdersEmptyState from '../../components/SalesOrders/SalesOrdersEmptyState';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import OrderSourceBadge from '../../components/Orders/OrderSourceBadge';
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
  const [statusFilter, setStatusFilter] = useState('all');

  const [usedOrders, setUsedOrders] = useState([]);
  const [newOrders, setNewOrders] = useState([]);
  const [avitoOrders, setAvitoOrders] = useState([]);
  const [expandedOrderKey, setExpandedOrderKey] = useState(null);
  const [canViewNewOrders, setCanViewNewOrders] = useState(false);

  const [editingStatus, setEditingStatus] = useState(null); // garage: {type, orderId, itemId?} | avito: {type, id}
  const [availableStatuses, setAvailableStatuses] = useState([]);
  const [transitionLoadingByOrderId, setTransitionLoadingByOrderId] = useState({});
  const [warehouseRetryLoadingByOrderId, setWarehouseRetryLoadingByOrderId] = useState({});
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

  const usedOrderStatusOptions = useMemo(() => {
    if (availableStatuses.length > 0) return availableStatuses;
    return [
      { code: 'pending', name: 'В ожидании' },
      { code: 'confirmed', name: 'Подтверждён' },
      { code: 'rejected', name: 'Не подтверждён' },
      { code: 'assembled', name: 'Сформирован' },
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

      // Keep Avito orders cache fresh before reading it.
      // If sync fails (e.g., integration not configured), we still render from existing cache.
      if (avitoProActive) {
        await apiAxios.post('/sales/avito-orders/sync').catch(() => {});
      }

      const results = await Promise.allSettled([
        apiAxios.get('/sales/used-parts-orders'),
        apiAxios.get('/sales/new-parts-orders/can-view'),
        avitoProActive ? apiAxios.get('/sales/avito-orders') : Promise.resolve({ data: [] }),
      ]);

      const [usedRes, canViewRes, avitoRes] = results;

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
      if (canViewRes.status === 'fulfilled') {
        canView = Boolean(canViewRes.value.data?.can_view);
      } else {
        const statusCode = canViewRes.reason?.response?.status;
        if (statusCode !== 403) {
          throw canViewRes.reason;
        }
      }
      setCanViewNewOrders(canView);

      if (canView) {
        const newRes = await apiAxios.get('/sales/new-parts-orders');
        setNewOrders(Array.isArray(newRes.data) ? newRes.data : []);
      } else {
        setNewOrders([]);
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
      const createdCount = fulfilled.filter((item) => item.created).length;
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
      if (createdCount > 0) {
        setUsedOrderStatusMessage({
          type: 'success',
          text: `Списано со склада: ${createdCount} поз.`,
        });
      } else {
        setUsedOrderStatusMessage({
          type: 'success',
          text: itemId ? 'Статус позиции обновлён.' : 'Статус заказа обновлён.',
        });
      }
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setUsedOrderStatusMessage({
        type: 'error',
        text: formatStatusErrorDetail(detail),
      });
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
      setUsedOrderStatusMessage({
        type: 'success',
        text: itemId
          ? 'Статус позиции обновлён. Покупатель увидит его в «Мои заказы».'
          : 'Статус заказа обновлён. Покупатель увидит его в «Мои заказы».',
      });
    } catch (error) {
      setUsedOrderStatusMessage({
        type: 'error',
        text: formatStatusErrorDetail(error?.response?.data?.detail),
      });
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

  if (!hasPermission) {
    return null;
  }

  return (
    <div className="min-w-0 space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-white via-white to-indigo-50/70 p-5 shadow-sm ring-1 ring-gray-200/60 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-indigo-400/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-md:hidden">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Продажи
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Заказы</h1>
            <p className="mt-2 max-w-xl text-sm text-gray-600">
              Статусы, оплата и проводка склада
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
              <dd className="mt-1 text-2xl font-bold tabular-nums text-indigo-700">
                {stats.activeCount}
              </dd>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs font-medium text-gray-500">Сумма</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{formatPrice(stats.totalSum)}</dd>
            </div>
          </dl>
        )}
      </header>

      <div className="rounded-2xl border border-gray-200/80 bg-white p-1 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 px-3 pt-3" aria-label="Источники заказов">
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <OrderSourceBadge source="used" size="sm" />
            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium tabular-nums text-gray-700">
              {sourceCounts.used}
            </span>
          </span>
          {canViewNewOrders && (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <OrderSourceBadge source="new" size="sm" />
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
        </div>

        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === opt.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
              placeholder="Покупатель, телефон, № заказа…"
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

      {!loading && !error && transitionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{transitionError}</div>
      )}

      {!loading && !error && usedOrderStatusMessage && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            usedOrderStatusMessage.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
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
                  getStatusColor={getGarageStatusColor}
                  getStatusName={(code) => getGarageStatusName(code, entry.source)}
                  orderStatusOptions={isUsed ? usedOrderStatusOptions : newOrderStatusOptions}
                  formatDate={formatDate}
                  formatPrice={formatPrice}
                />
              );
            })}
          </div>

          {filteredUnifiedOrders.length === 0 && (
            <SalesOrdersEmptyState hasAnyOrders={stats.total > 0} />
          )}
        </>
      )}

        {cncPrepareModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900">Подготовка CNC заказа</h3>
              <p className="mt-2 text-sm text-gray-600">
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
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="г Екатеринбург, ул Фруктовая, 17"
                autoFocus
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
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
              <label className="mt-3 block text-sm font-medium text-gray-700" htmlFor="cnc-prepare-details">
                Комментарий покупателю
              </label>
              <textarea
                id="cnc-prepare-details"
                value={cncPrepareModal.details}
                onChange={(e) => setCncPrepareModal((prev) => ({ ...prev, details: e.target.value, error: '' }))}
                rows={3}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="Могу передать товар с 13:00 до 18:00"
              />
              {cncPrepareModal.error && (
                <div className="mt-2 text-sm text-red-600">{cncPrepareModal.error}</div>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={closeCncPrepareModal}
                  disabled={cncPrepareModal.isSubmitting}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={submitCncPrepare}
                  disabled={cncPrepareModal.isSubmitting}
                >
                  {cncPrepareModal.isSubmitting ? 'Сохраняем...' : 'Подготовить'}
                </button>
              </div>
            </div>
          </div>
        )}
        {receiveCodeModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900">Подтверждение получения заказа</h3>
              {receiveCodeModal.step === 'hint' && (
                <div className="mt-2 space-y-2 text-sm text-gray-700">
                  {(() => {
                    const hint = getCncReceiveHint(receiveCodeModal.order);
                    return (
                      <>
                        {hint.receiveBefore && <p>Передайте заказ до {formatDate(hint.receiveBefore)}.</p>}
                        <p>Попросите номер заказа: {hint.marketplaceId}.</p>
                        <p>Адрес: {hint.address}.</p>
                        <p>Комментарий: {hint.details}.</p>
                        <p>После выдачи нажмите «Ввести код».</p>
                      </>
                    );
                  })()}
                </div>
              )}
              {receiveCodeModal.step === 'code' && (
                <>
                  <p className="mt-2 text-sm text-gray-600">
                    Введите 4-значный код покупателя.
                  </p>
                  <label className="mt-4 block text-sm font-medium text-gray-700" htmlFor="receive-confirm-code">
                    Код подтверждения
                  </label>
                  <input
                    id="receive-confirm-code"
                    type="text"
                    value={receiveCodeModal.confirmCode}
                    onChange={(e) => setReceiveCodeModal((prev) => ({ ...prev, confirmCode: e.target.value, error: '' }))}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="Введите код"
                    autoFocus
                  />
                </>
              )}
              {receiveCodeModal.error && (
                <div className="mt-2 text-sm text-red-600">{receiveCodeModal.error}</div>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={closeReceiveCodeModal}
                  disabled={receiveCodeModal.isSubmitting}
                >
                  Отмена
                </button>
                {receiveCodeModal.step === 'hint' ? (
                  <button
                    type="button"
                    className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                    onClick={() => setReceiveCodeModal((prev) => ({ ...prev, step: 'code', error: '' }))}
                  >
                    Ввести код
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setReceiveCodeModal((prev) => ({ ...prev, step: 'hint', error: '' }))}
                      disabled={receiveCodeModal.isSubmitting}
                    >
                      Назад
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={submitReceiveCodeTransition}
                      disabled={receiveCodeModal.isSubmitting}
                    >
                      {receiveCodeModal.isSubmitting ? 'Проверяем...' : 'Подтвердить'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

