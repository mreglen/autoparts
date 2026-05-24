import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';
import { AvitoOrderCard } from '../../components/AvitoOrderCard';
import SalesGarageOrderCard from '../../components/SalesOrders/SalesGarageOrderCard';
import SalesOrdersEmptyState from '../../components/SalesOrders/SalesOrdersEmptyState';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
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

function sortOrdersNewestFirst(orders) {
  return [...orders].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function matchesGarageStatusFilter(order, filterId) {
  const code = order.status_code || 'pending';
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
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const { status: avitoAccountStatus } = useAvitoAccountStatus(user?.organization_id, {
    enabled: Boolean(user?.organization_id),
  });
  const avitoProActive = canUseAvitoProFeatures(avitoAccountStatus);

  const hasPermission = user?.is_admin || user?.is_seller ||
    (user?.is_employee && permissionCodes && permissionCodes.includes('sales.orders'));

  const [activeTab, setActiveTab] = useState('used'); // used | new | avito
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [usedOrders, setUsedOrders] = useState([]);
  const [newOrders, setNewOrders] = useState([]);
  const [avitoOrders, setAvitoOrders] = useState([]);
  const [expandedAvitoOrderId, setExpandedAvitoOrderId] = useState(null);
  const [expandedUsedOrderId, setExpandedUsedOrderId] = useState(null);
  const [expandedNewOrderId, setExpandedNewOrderId] = useState(null);
  const [canViewNewOrders, setCanViewNewOrders] = useState(true);

  const [editingStatus, setEditingStatus] = useState(null); // {type:'used'|'new'|'avito', id:number} | null
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

  const getOrderStatusOptions = useMemo(() => {
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

  const formatDate = formatGarageOrderDate;
  const formatPrice = formatGarageOrderPrice;

  const getGarageStatusColor = (statusCode) => GARAGE_STATUS_COLORS[statusCode] || GARAGE_STATUS_COLORS.closed;
  const getGarageStatusName = (statusCode) => GARAGE_STATUS_NAMES[statusCode] || statusCode || 'pending';

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

      if (newRes.status === 'fulfilled') {
        setCanViewNewOrders(true);
        setNewOrders(Array.isArray(newRes.value.data) ? newRes.value.data : []);
      } else {
        const statusCode = newRes.reason?.response?.status;
        if (statusCode === 403) {
          setCanViewNewOrders(false);
          setNewOrders([]);
          setActiveTab((t) => (t === 'new' ? 'used' : t));
        } else {
          throw newRes.reason;
        }
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
    if (!avitoProActive && activeTab === 'avito') {
      setActiveTab('used');
    }
  }, [avitoProActive, activeTab]);

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

  const updateUsedOrderStatus = async (orderId, statusCode) => {
    setUsedOrderStatusMessage(null);
    try {
      const response = await apiAxios.put(
        `/sales/used-parts-orders/${orderId}/status`,
        { status_code: statusCode }
      );
      const fulfilled = Array.isArray(response.data?.fulfilled_items)
        ? response.data.fulfilled_items
        : [];
      const createdCount = fulfilled.filter((item) => item.created).length;
      setUsedOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          const nextItems = (o.items || []).map((item) => {
            const match = fulfilled.find((f) => f.order_item_id === item.id);
            if (!match) return item;
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
      }
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setUsedOrderStatusMessage({
        type: 'error',
        text: formatStatusErrorDetail(detail),
      });
    }
  };

  const updateNewOrderStatus = async (orderId, statusCode) => {
    await apiAxios.put(`/sales/new-parts-orders/${orderId}/status`, { status_code: statusCode });
    setNewOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status_code: statusCode } : o)));
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

  const toggleAvitoOrderExpand = (orderId) => {
    setExpandedAvitoOrderId((prev) => (prev === orderId ? null : orderId));
  };
  const toggleUsedOrderExpand = (orderId) => {
    setExpandedUsedOrderId((prev) => (prev === orderId ? null : orderId));
  };
  const toggleNewOrderExpand = (orderId) => {
    setExpandedNewOrderId((prev) => (prev === orderId ? null : orderId));
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

  const filterOrders = useCallback(
    (orders, tab) => {
      const q = searchQuery.trim().toLowerCase();
      return sortOrdersNewestFirst(orders).filter((order) => {
        const statusOk =
          tab === 'avito'
            ? matchesAvitoStatusFilter(order, statusFilter)
            : matchesGarageStatusFilter(order, statusFilter);
        if (!statusOk) return false;
        if (!q) return true;

        if (tab === 'avito') {
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
      });
    },
    [searchQuery, statusFilter]
  );

  const filteredUsedOrders = useMemo(() => filterOrders(usedOrders, 'used'), [filterOrders, usedOrders]);
  const filteredNewOrders = useMemo(() => filterOrders(newOrders, 'new'), [filterOrders, newOrders]);
  const filteredAvitoOrders = useMemo(() => filterOrders(avitoOrders, 'avito'), [filterOrders, avitoOrders]);

  const activeOrders =
    activeTab === 'used' ? filteredUsedOrders : activeTab === 'new' ? filteredNewOrders : filteredAvitoOrders;
  const totalInTab =
    activeTab === 'used' ? usedOrders.length : activeTab === 'new' ? newOrders.length : avitoOrders.length;

  const stats = useMemo(() => {
    const pool = activeTab === 'used' ? usedOrders : activeTab === 'new' ? newOrders : avitoOrders;
    let activeCount = 0;
    let totalSum = 0;
    pool.forEach((order) => {
      if (activeTab === 'avito') {
        if (AVITO_ACTIVE_STATUSES.has(order.avito_status_code)) activeCount += 1;
        totalSum += getAvitoDisplayTotal(order);
      } else {
        if (GARAGE_ACTIVE_STATUSES.has(order.status_code || 'pending')) activeCount += 1;
        totalSum += Number(order.total_amount || 0);
      }
    });
    return { total: pool.length, activeCount, totalSum };
  }, [activeTab, usedOrders, newOrders, avitoOrders]);

  const tabLabel = activeTab === 'used' ? 'Б/У' : activeTab === 'new' ? 'Новые' : 'Авито';
  const isAvitoTab = activeTab === 'avito';

  if (!hasPermission) {
    return null;
  }

  return (
    <div className="min-w-0 space-y-6">
      <header
        className={`relative overflow-hidden rounded-2xl border border-white/80 p-5 shadow-sm ring-1 ring-gray-200/60 sm:p-6 ${
          isAvitoTab
            ? 'bg-gradient-to-br from-white via-white to-teal-50/80'
            : 'bg-gradient-to-br from-white via-white to-indigo-50/70'
        }`}
      >
        <div
          className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl ${
            isAvitoTab ? 'bg-teal-400/15' : 'bg-indigo-400/10'
          }`}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p
              className={`text-xs font-semibold uppercase tracking-wider ${
                isAvitoTab ? 'text-teal-700' : 'text-indigo-600'
              }`}
            >
              Продажи
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Заказы</h1>
            <p className="mt-2 max-w-xl text-sm text-gray-600">
              {isAvitoTab
                ? 'Заказы с Авито: статусы, оплата, состав и проводка склада. Синхронизация при обновлении списка.'
                : 'Входящие заказы с сайта и Авито: статусы, оплата, состав и проводка склада.'}
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
              <dt className="text-xs font-medium text-gray-500">Всего · {tabLabel}</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{stats.total}</dd>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs font-medium text-gray-500">В работе</dt>
              <dd
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  isAvitoTab ? 'text-teal-700' : 'text-indigo-700'
                }`}
              >
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
        <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Тип заказов">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'used'}
              onClick={() => setActiveTab('used')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                activeTab === 'used' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Б/У
              <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === 'used' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
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
                  activeTab === 'new' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Новые
                <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === 'new' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                  {newOrders.length}
                </span>
              </button>
            )}
            {avitoProActive && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'avito'}
                onClick={() => setActiveTab('avito')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  activeTab === 'avito'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-teal-50 hover:text-teal-900'
                }`}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white/20 text-[10px] font-bold">
                  <img src="/logos/avito.png" alt="Avito" className="w-5 h-5 object-contain" />
                </span>
                Авито
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    activeTab === 'avito' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {avitoOrders.length}
                </span>
              </button>
            )}
          </div>

          <div className="relative min-w-0 flex-1 lg:max-w-sm">
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

        <div className="flex flex-wrap gap-2 border-t border-gray-100 px-3 py-3">
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

      {!loading && !error && activeTab === 'avito' && avitoWarehouseMessage && (
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
          {totalInTab > 0 && activeOrders.length !== totalInTab && (
            <p className="text-sm text-gray-500">
              Показано {activeOrders.length} из {totalInTab} заказов
            </p>
          )}

          <div className="space-y-4">
            {activeTab === 'used' &&
              filteredUsedOrders.map((o) => (
                <SalesGarageOrderCard
                  key={o.id}
                  order={o}
                  orderType="used"
                  isExpanded={expandedUsedOrderId === o.id}
                  onToggle={toggleUsedOrderExpand}
                  editingStatus={editingStatus}
                  onEditStatus={setEditingStatus}
                  onUpdateStatus={updateUsedOrderStatus}
                  getStatusColor={getGarageStatusColor}
                  getStatusName={getGarageStatusName}
                  orderStatusOptions={getOrderStatusOptions}
                  formatDate={formatDate}
                  formatPrice={formatPrice}
                />
              ))}

            {activeTab === 'new' &&
              canViewNewOrders &&
              filteredNewOrders.map((o) => (
                <SalesGarageOrderCard
                  key={o.id}
                  order={o}
                  orderType="new"
                  isExpanded={expandedNewOrderId === o.id}
                  onToggle={toggleNewOrderExpand}
                  editingStatus={editingStatus}
                  onEditStatus={setEditingStatus}
                  onUpdateStatus={updateNewOrderStatus}
                  getStatusColor={getGarageStatusColor}
                  getStatusName={getGarageStatusName}
                  orderStatusOptions={getOrderStatusOptions}
                  formatDate={formatDate}
                  formatPrice={formatPrice}
                />
              ))}

            {activeTab === 'avito' &&
              avitoProActive &&
              filteredAvitoOrders.map((o) => (
                <AvitoOrderCard
                  key={o.id}
                  order={o}
                  isExpanded={expandedAvitoOrderId === o.id}
                  onToggle={toggleAvitoOrderExpand}
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
              ))}
          </div>

          {activeOrders.length === 0 && (
            <SalesOrdersEmptyState tabLabel={tabLabel} variant={isAvitoTab ? 'avito' : 'default'} />
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

