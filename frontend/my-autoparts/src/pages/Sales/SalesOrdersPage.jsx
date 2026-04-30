import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { apiAxios } from '../../utils/apiClient';
import { AvitoOrderCard } from '../../components/AvitoOrderCard';
import { GarageOrderCard } from '../../components/GarageOrderCard';
import { fetchAvitoChatProductLink } from '../../redux/slices/AvitoChatSlice';
import { openAvitoProductFlow } from '../../utils/avitoProductFlow';
import {
  getAvitoBuyerAndDelivery,
  getAvitoDisplayTotal,
  getAvitoMobileDeliveryText,
  getAvitoOrderItems,
  getAvitoLineItemTitle,
  getAvitoLineItemTotal,
  getAvitoLineItemQty,
} from './avitoOrderDisplay';

export default function SalesOrdersPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, permissionCodes } = useSelector((state) => state.auth);

  const hasPermission = user?.is_admin || user?.is_seller ||
    (user?.is_employee && permissionCodes && permissionCodes.includes('sales.orders'));

  const [activeTab, setActiveTab] = useState('used'); // used | new | avito
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  const [transitionError, setTransitionError] = useState('');
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

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('ru-RU');
  const formatPrice = (amount) => `${Number(amount || 0).toLocaleString('ru-RU')} ₽`;

  const getAvitoStatusColor = (statusCode) => {
    const colorMap = {
      on_confirmation: 'bg-yellow-100 text-yellow-800',
      ready_to_ship: 'bg-blue-100 text-blue-800',
      in_transit: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      canceled: 'bg-red-100 text-red-800',
      closed: 'bg-gray-100 text-gray-800',
      on_return: 'bg-orange-100 text-orange-800',
      in_dispute: 'bg-pink-100 text-pink-800',
    };
    return colorMap[statusCode] || 'bg-gray-100 text-gray-800';
  };

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

  const handleProductClick = async (item, e) => {
    e?.stopPropagation?.();
    await openAvitoProductFlow({
      item,
      dispatch,
      navigate,
      fetchLinkThunk: fetchAvitoChatProductLink,
    });
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);

      // Keep Avito orders cache fresh before reading it.
      // If sync fails (e.g., integration not configured), we still render from existing cache.
      await apiAxios.post('/sales/avito-orders/sync').catch(() => {});

      const results = await Promise.allSettled([
        apiAxios.get('/sales/used-parts-orders'),
        apiAxios.get('/sales/new-parts-orders'),
        apiAxios.get('/sales/avito-orders'),
      ]);

      const [usedRes, newRes, avitoRes] = results;

      if (usedRes.status === 'fulfilled') {
        setUsedOrders(Array.isArray(usedRes.value.data) ? usedRes.value.data : []);
      } else {
        throw usedRes.reason;
      }

      if (avitoRes.status === 'fulfilled') {
        setAvitoOrders(Array.isArray(avitoRes.value.data) ? avitoRes.value.data : []);
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
    }
  };

  useEffect(() => {
    if (!hasPermission) return;
    fetchAll();
  }, [hasPermission]);

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

  const updateUsedOrderStatus = async (orderId, statusCode) => {
    await apiAxios.put(`/sales/used-parts-orders/${orderId}/status`, { status_code: statusCode });
    setUsedOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status_code: statusCode } : o)));
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
        await apiAxios.post(`/sales/avito-orders/${orderId}/check-confirmation-code`, {
          confirm_code: normalizedCode,
          marketplace_id: marketplaceId,
        });
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
      if (!cncPreparedByOrderId[order.id]?.prepared) {
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
    if (deliveryType !== 'cnc') {
      return transitions;
    }
    if (!transitions.includes('receive') || cncPreparedByOrderId[order.id]?.prepared) {
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

  const getGarageStatusColor = (statusCode) => {
    const colorMap = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      assembled: 'bg-indigo-100 text-indigo-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    return colorMap[statusCode] || 'bg-gray-100 text-gray-800';
  };

  const getGarageStatusName = (statusCode) => {
    const statusMap = {
      pending: 'В ожидании',
      confirmed: 'Подтверждён',
      rejected: 'Не подтверждён',
      assembled: 'Сформирован',
      shipped: 'Передан в доставку',
      delivered: 'Получен',
      closed: 'Закрыт',
    };
    return statusMap[statusCode] || statusCode || 'pending';
  };

  if (!hasPermission) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Заказы</h1>
          <button onClick={fetchAll} className="text-sm px-3 py-2 border rounded bg-white hover:bg-gray-50">
            Обновить
          </button>
        </div>

        <div className="bg-white shadow-sm rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('used')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'used' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Б/У <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800">{usedOrders.length}</span>
              </button>
              {canViewNewOrders && (
                <button
                  onClick={() => setActiveTab('new')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'new' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  Новые <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800">{newOrders.length}</span>
                </button>
              )}
              <button
                onClick={() => setActiveTab('avito')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'avito' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                Авито <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800">{avitoOrders.length}</span>
              </button>
            </nav>
          </div>
        </div>

        {loading && <div className="text-gray-600">Загрузка…</div>}
        {error && <div className="text-red-600">{error}</div>}
        {!error && transitionError && <div className="text-red-600">{transitionError}</div>}

        {!loading && !error && activeTab === 'used' && (
          <div className="space-y-4">
            <div className="hidden md:block space-y-4">
              {usedOrders.map((o) => (
                <GarageOrderCard
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
            </div>
            <div className="md:hidden space-y-5">
              {usedOrders.map((o) => (
                <div key={o.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="mb-4 space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-mono">
                        Б/У #{o.id}
                      </span>
                      <span className="text-sm text-gray-400">•</span>
                      <span className="text-sm text-gray-500">{formatDate(o.created_at)}</span>
                    </div>
                    <div className="text-sm text-gray-800 break-words">{o.buyer_name}</div>
                    <div className="text-sm text-gray-600 break-all">{o.buyer_phone}</div>
                    <div className="pt-3 border-t border-gray-100 flex flex-col gap-2 min-w-0">
                      <div className="text-lg font-bold text-gray-900">{formatPrice(o.total_amount)}</div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${o.is_paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {o.is_paid ? 'Оплачен' : 'Не оплачено'}
                        </span>
                        {/* Статус заказа - редактируемый */}
                        {editingStatus?.type === 'used' && editingStatus?.id === o.id ? (
                          <select
                            value={o.status_code || 'pending'}
                            onChange={(e) => {
                              updateUsedOrderStatus(o.id, e.target.value);
                            }}
                            onBlur={() => setEditingStatus(null)}
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-0.5 text-xs font-medium border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[120px]"
                            autoFocus
                          >
                            {getOrderStatusOptions.map((status) => (
                              <option key={status.code} value={status.code}>
                                {status.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 ${getGarageStatusColor(o.status_code)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingStatus({ type: 'used', id: o.id });
                            }}
                          >
                            {getGarageStatusName(o.status_code)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900">Товары ({(o.items || []).length})</h3>
                    {(o.items || []).map((item, idx) => (
                      <div key={`${o.id}-${idx}`} className="bg-gray-50 rounded-lg p-3">
                        <button onClick={(e) => handleProductClick(item, e)} className="text-sm font-medium text-gray-900 underline text-left">
                          {item.name}
                        </button>
                        <div className="text-xs text-gray-600 mt-1">{item.quantity} шт.</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">{formatPrice((item.price || 0) * (item.quantity || 0))}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {usedOrders.length === 0 && <div className="text-gray-600">Заказов Б/У нет</div>}
          </div>
        )}

        {!loading && !error && canViewNewOrders && activeTab === 'new' && (
          <div className="space-y-4">
            <div className="hidden md:block space-y-4">
              {newOrders.map((o) => (
                <GarageOrderCard
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
            </div>
            <div className="md:hidden space-y-5">
              {newOrders.map((o) => (
                <div key={o.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="mb-4 space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-mono">
                        Новый #{o.id}
                      </span>
                      <span className="text-sm text-gray-400">•</span>
                      <span className="text-sm text-gray-500">{formatDate(o.created_at)}</span>
                    </div>
                    <div className="text-sm text-gray-800 break-words">{o.buyer_name}</div>
                    <div className="text-sm text-gray-600 break-all">{o.buyer_phone}</div>
                    <div className="pt-3 border-t border-gray-100 flex flex-col gap-2 min-w-0">
                      <div className="text-lg font-bold text-gray-900">{formatPrice(o.total_amount)}</div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${o.is_paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {o.is_paid ? 'Оплачен' : 'Не оплачено'}
                        </span>
                        {/* Статус заказа - редактируемый */}
                        {editingStatus?.type === 'new' && editingStatus?.id === o.id ? (
                          <select
                            value={o.status_code || 'pending'}
                            onChange={(e) => {
                              updateNewOrderStatus(o.id, e.target.value);
                            }}
                            onBlur={() => setEditingStatus(null)}
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-0.5 text-xs font-medium border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[120px]"
                            autoFocus
                          >
                            {getOrderStatusOptions.map((status) => (
                              <option key={status.code} value={status.code}>
                                {status.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 ${getGarageStatusColor(o.status_code)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingStatus({ type: 'new', id: o.id });
                            }}
                          >
                            {getGarageStatusName(o.status_code)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900">Товары ({(o.items || []).length})</h3>
                    {(o.items || []).map((item, idx) => (
                      <div key={`${o.id}-${idx}`} className="bg-gray-50 rounded-lg p-3">
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-600 mt-1">{item.quantity} шт.</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">{formatPrice((item.price || 0) * (item.quantity || 0))}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {newOrders.length === 0 && <div className="text-gray-600">Заказов новых товаров нет</div>}
          </div>
        )}

        {!loading && !error && activeTab === 'avito' && (
          <div className="space-y-4">
            <div className="hidden md:block space-y-4">
              {avitoOrders.map((o) => (
                <AvitoOrderCard
                  key={o.id}
                  order={o}
                  isExpanded={expandedAvitoOrderId === o.id}
                  onToggle={toggleAvitoOrderExpand}
                  editingStatus={editingStatus}
                  onEditStatus={handleEditStatus}
                  onAvitoTransition={handleAvitoTransitionSelect}
                  transitionLoadingByOrderId={transitionLoadingByOrderId}
                  getAvitoTransitionOptions={getAvitoTransitionOptions}
                  getAvitoTransitionLabel={getAvitoTransitionLabel}
                  getAvitoStatusColor={getAvitoStatusColor}
                  getAvitoStatusName={getAvitoStatusName}
                  formatDate={formatDate}
                  formatPrice={formatPrice}
                />
              ))}
            </div>
            <div className="md:hidden space-y-5">
              {avitoOrders.map((order) => (
                <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  {(() => {
                    const { delivery, buyerName, buyerPhone } = getAvitoBuyerAndDelivery(order);
                    const displayTotal = getAvitoDisplayTotal(order);
                    const deliveryText = getAvitoMobileDeliveryText(delivery);
                    return (
                      <>
                        <div className="mb-4 space-y-2 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-mono">
                              Авито #{order.avito_order_id}
                            </span>
                            <span className="text-sm text-gray-400">•</span>
                            <span className="text-sm text-gray-500">{formatDate(order.created_at)}</span>
                          </div>
                          <div className="text-sm text-gray-800 break-words">{buyerName}</div>
                          <div className="text-sm text-gray-600 break-all">{buyerPhone}</div>
                          <div className="text-sm text-gray-600 break-words">{deliveryText}</div>
                          <div className="pt-3 border-t border-gray-100 flex flex-col gap-2 min-w-0">
                            <div className="text-lg font-bold text-gray-900">{formatPrice(displayTotal)}</div>
                            <div className="flex flex-wrap gap-2 items-center">
                              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${order.is_paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {order.is_paid ? 'Оплачен' : 'Не оплачено'}
                              </span>
                              {/* Статус заказа - редактируемый */}
                              {editingStatus?.type === 'avito' && editingStatus?.id === order.id ? (
                                <select
                                  value=""
                                  onChange={(e) => {
                                    handleAvitoTransitionSelect(order, e.target.value);
                                  }}
                                  disabled={Boolean(transitionLoadingByOrderId[order.id]) || getAvitoTransitionOptions(order).length === 0}
                                  onBlur={() => setEditingStatus(null)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-2 py-0.5 text-xs font-medium border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[140px]"
                                  autoFocus
                                >
                                <option value="" disabled>
                                  {transitionLoadingByOrderId[order.id] ? 'Выполняем...' : 'Выберите действие'}
                                </option>
                                  {getAvitoTransitionOptions(order).map((transition) => (
                                    <option key={transition} value={transition}>
                                      {getAvitoTransitionLabel(transition)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span
                                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 ${getAvitoStatusColor(order.avito_status_code)}`}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    // Fetch available transitions before showing dropdown
                                    await fetchAvitoTransitions(order.id);
                                    setEditingStatus({ type: 'avito', id: order.id });
                                  }}
                                >
                                  {getAvitoStatusName(order.avito_status_code, order)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-gray-900">Товары ({getAvitoOrderItems(order).length})</h3>
                          {getAvitoOrderItems(order).map((item, idx) => (
                            <div key={`${order.id}-${idx}`} className="bg-gray-50 rounded-lg p-3">
                              <button onClick={(e) => handleProductClick(item, e)} className="text-sm font-medium text-gray-900 underline text-left">
                                {getAvitoLineItemTitle(item)}
                              </button>
                              <div className="text-xs text-gray-600 mt-1">{getAvitoLineItemQty(item)} шт.</div>
                              <div className="text-sm font-semibold text-gray-900 mt-1">{formatPrice(getAvitoLineItemTotal(item))}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              ))}
              {avitoOrders.length === 0 && <div className="text-gray-600">Заказов Авито нет</div>}
            </div>
          </div>
        )}
        {cncPrepareModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
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
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <label className="mt-3 block text-sm font-medium text-gray-700" htmlFor="cnc-prepare-details">
                Комментарий покупателю
              </label>
              <textarea
                id="cnc-prepare-details"
                value={cncPrepareModal.details}
                onChange={(e) => setCncPrepareModal((prev) => ({ ...prev, details: e.target.value, error: '' }))}
                rows={3}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Могу передать товар с 13:00 до 18:00"
              />
              {cncPrepareModal.error && (
                <div className="mt-2 text-sm text-red-600">{cncPrepareModal.error}</div>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={closeCncPrepareModal}
                  disabled={cncPrepareModal.isSubmitting}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
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
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                    onClick={() => setReceiveCodeModal((prev) => ({ ...prev, step: 'code', error: '' }))}
                  >
                    Ввести код
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setReceiveCodeModal((prev) => ({ ...prev, step: 'hint', error: '' }))}
                      disabled={receiveCodeModal.isSubmitting}
                    >
                      Назад
                    </button>
                    <button
                      type="button"
                      className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
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
    </div>
  );
}

