import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiAxios } from '../../utils/apiClient';
import { GarageOrderCard } from '../../components/GarageOrderCard';
import { useAuthReady } from '../../hooks/useAuthReady';

export default function PurchasesOrdersPage() {
  const navigate = useNavigate();
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [usedOrders, setUsedOrders] = useState([]);
  const [newOrders, setNewOrders] = useState([]);
  const [expandedUsedOrderId, setExpandedUsedOrderId] = useState(null);
  const [expandedNewOrderId, setExpandedNewOrderId] = useState(null);
  const [canViewNewOrders, setCanViewNewOrders] = useState(true);

  const [activeTab, setActiveTab] = useState('used'); // used | new

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      navigate('/auth', { replace: true });
    }
  }, [isReady, isAuthenticated, navigate]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      fetchAll();
    }
  }, [isReady, isAuthenticated]);

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('ru-RU');
  const formatPrice = (amount) => `${Number(amount || 0).toLocaleString('ru-RU')} ₽`;

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

  const getDeliveryInfo = (order) => {
    if (order.delivery_type === 'pickup') {
      return `Самовывоз: ${order.pickup_address || 'Адрес не указан'}`;
    } else if (order.delivery_type === 'transport') {
      return order.transport_company
        ? `${order.transport_company}: ${order.delivery_address || 'Адрес не указан'}`
        : `Доставка: ${order.delivery_address || 'Адрес не указан'}`;
    }
    return 'Способ доставки не указан';
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled([
        apiAxios.get('/sales/purchases/used-orders'),
        apiAxios.get('/sales/purchases/new-orders'),
      ]);

      const [usedRes, newRes] = results;

      if (usedRes.status === 'fulfilled') {
        const allOrders = Array.isArray(usedRes.value.data) ? usedRes.value.data : [];
        console.log('=== USED ORDERS FROM API ===');
        console.log('Total orders:', allOrders.length);
        console.log('Orders:', allOrders);
        if (allOrders.length > 0) {
          console.log('First order:', allOrders[0]);
          console.log('User info:', { 
            name: `${user.last_name} ${user.first_name}`, 
            phone: user.phone, 
            email: user.email 
          });
        }
        // Показываем ВСЕ заказы без фильтрации
        setUsedOrders(allOrders);
      } else {
        console.error('Failed to fetch used orders:', usedRes.reason);
        throw usedRes.reason;
      }

      if (newRes.status === 'fulfilled') {
        const allOrders = Array.isArray(newRes.value.data) ? newRes.value.data : [];
        console.log('=== NEW ORDERS FROM API ===');
        console.log('Total orders:', allOrders.length);
        console.log('Orders:', allOrders);
        // Показываем ВСЕ заказы без фильтрации
        setCanViewNewOrders(true);
        setNewOrders(allOrders);
      } else {
        const statusCode = newRes.reason?.response?.status;
        if (statusCode === 403) {
          setCanViewNewOrders(false);
          setNewOrders([]);
          setActiveTab((t) => (t === 'new' ? 'used' : t));
        } else {
          console.error('Failed to fetch new orders:', newRes.reason);
          throw newRes.reason;
        }
      }
    } catch (e) {
      console.error('FetchAll error:', e);
      setError(e?.response?.data?.detail || e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  const toggleUsedOrderExpand = (orderId) => {
    setExpandedUsedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const toggleNewOrderExpand = (orderId) => {
    setExpandedNewOrderId((prev) => (prev === orderId ? null : orderId));
  };

  // Обработчик клика по товару для перехода на страницу товара
  const handleProductClick = (item, e) => {
    e?.stopPropagation?.();
    
    // Если есть product_id - переходим на /part/
    if (item.product_id) {
      navigate(`/part/${item.product_id}`);
    }
  };

  // Показываем загрузку пока не загрузился auth
  if (!isReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Мои заказы</h1>
          <button onClick={fetchAll} className="text-sm px-3 py-2 border rounded bg-white hover:bg-gray-50">
            Обновить
          </button>
        </div>

        {/* Табы */}
        <div className="bg-white shadow-sm rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('used')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'used'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Б/У <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800">{usedOrders.length}</span>
              </button>
              {canViewNewOrders && (
                <button
                  onClick={() => setActiveTab('new')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'new'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Новые <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800">{newOrders.length}</span>
                </button>
              )}
            </nav>
          </div>
        </div>

        {loading && <div className="text-gray-600">Загрузка…</div>}
        {error && <div className="text-red-600">{error}</div>}

        {/* Б/У заказы */}
        {!loading && !error && activeTab === 'used' && (
          <div className="space-y-4">
            {/* Десктопная версия */}
            <div className="hidden md:block space-y-4">
              {usedOrders.map((o) => (
                <GarageOrderCard
                  key={o.id}
                  order={{
                    ...o,
                    delivery_method_name: getDeliveryInfo(o),
                  }}
                  orderType="used"
                  isExpanded={expandedUsedOrderId === o.id}
                  onToggle={toggleUsedOrderExpand}
                  editingStatus={null}
                  onEditStatus={() => {}}
                  onUpdateStatus={() => {}}
                  getStatusColor={getGarageStatusColor}
                  getStatusName={getGarageStatusName}
                  orderStatusOptions={[]}
                  formatDate={formatDate}
                  formatPrice={formatPrice}
                />
              ))}
            </div>

            {/* Мобильная версия */}
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
                    <div className="text-sm font-medium text-gray-900 break-words">{o.organization_name}</div>
                    <div className="text-sm text-gray-800 break-words">{o.buyer_name}</div>
                    <div className="text-sm text-gray-600 break-all">{o.buyer_phone}</div>
                    <div className="text-sm text-gray-600 break-words">{getDeliveryInfo(o)}</div>
                    <div className="pt-3 border-t border-gray-100 flex flex-col gap-2 min-w-0">
                      <div className="text-lg font-bold text-gray-900">{formatPrice(o.total_amount)}</div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${o.is_paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {o.is_paid ? 'Оплачен' : 'Не оплачено'}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getGarageStatusColor(o.status_code)}`}>
                          {getGarageStatusName(o.status_code)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Кнопка показа деталей */}
                  <div className="pt-3 border-t border-gray-100">
                    <button
                      onClick={() => toggleUsedOrderExpand(o.id)}
                      className="w-full text-indigo-600 text-sm font-medium hover:text-indigo-800 transition-colors py-2 min-h-[48px]"
                    >
                      {expandedUsedOrderId === o.id ? 'Скрыть товары' : `Показать товары (${(o.items || []).length})`}
                    </button>
                  </div>

                  {/* Детали заказа - мобильная версия */}
                  {expandedUsedOrderId === o.id && (o.items || []).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="space-y-3">
                        {(o.items || []).map((item, idx) => (
                          <div key={`${o.id}-${idx}`} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1 pr-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900">{item.brand || '-'}</span>
                                  <span className="text-xs text-gray-400">•</span>
                                  <span className="text-xs text-gray-500 font-mono">{item.partnumber || '-'}</span>
                                </div>
                                {/* Название товара - кликабельное */}
                                {item.product_id ? (
                                  <button
                                    onClick={(e) => handleProductClick(item, e)}
                                    className="text-sm text-gray-800 leading-tight hover:text-indigo-600 hover:underline text-left w-full"
                                  >
                                    {item.name}
                                  </button>
                                ) : (
                                  <div className="text-sm text-gray-800 leading-tight">{item.name}</div>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm font-semibold text-gray-900 mb-1">
                                  {formatPrice((item.price || 0) * (item.quantity || 0))}
                                </div>
                                <div className="text-xs text-gray-600">{item.quantity} шт.</div>
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getGarageStatusColor(item.status_code)}`}>
                                {getGarageStatusName(item.status_code)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {usedOrders.length === 0 && <div className="text-gray-600">Заказов Б/У нет</div>}
            </div>
          </div>
        )}

        {/* Новые заказы */}
        {!loading && !error && canViewNewOrders && activeTab === 'new' && (
          <div className="space-y-4">
            {/* Десктопная версия */}
            <div className="hidden md:block space-y-4">
              {newOrders.map((o) => (
                <GarageOrderCard
                  key={o.id}
                  order={{
                    ...o,
                    delivery_method_name: getDeliveryInfo(o),
                  }}
                  orderType="new"
                  isExpanded={expandedNewOrderId === o.id}
                  onToggle={toggleNewOrderExpand}
                  editingStatus={null}
                  onEditStatus={() => {}}
                  onUpdateStatus={() => {}}
                  getStatusColor={getGarageStatusColor}
                  getStatusName={getGarageStatusName}
                  orderStatusOptions={[]}
                  formatDate={formatDate}
                  formatPrice={formatPrice}
                />
              ))}
            </div>

            {/* Мобильная версия */}
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
                    <div className="text-sm text-gray-800 break-words">{o.seller || 'Продавец не указан'}</div>
                    <div className="text-sm text-gray-800 break-words">{o.buyer_name}</div>
                    <div className="text-sm text-gray-600 break-all">{o.buyer_phone}</div>
                    <div className="text-sm text-gray-600 break-words">{getDeliveryInfo(o)}</div>
                    <div className="pt-3 border-t border-gray-100 flex flex-col gap-2 min-w-0">
                      <div className="text-lg font-bold text-gray-900">{formatPrice(o.total_amount)}</div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${o.is_paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {o.is_paid ? 'Оплачен' : 'Не оплачено'}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getGarageStatusColor(o.status_code)}`}>
                          {getGarageStatusName(o.status_code)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Кнопка показа деталей */}
                  <div className="pt-3 border-t border-gray-100">
                    <button
                      onClick={() => toggleNewOrderExpand(o.id)}
                      className="w-full text-indigo-600 text-sm font-medium hover:text-indigo-800 transition-colors py-2 min-h-[48px]"
                    >
                      {expandedNewOrderId === o.id ? 'Скрыть товары' : `Показать товары (${(o.items || []).length})`}
                    </button>
                  </div>

                  {/* Детали заказа - мобильная версия */}
                  {expandedNewOrderId === o.id && (o.items || []).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="space-y-3">
                        {(o.items || []).map((item, idx) => (
                          <div key={`${o.id}-${idx}`} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1 pr-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900">{item.brand || '-'}</span>
                                  <span className="text-xs text-gray-400">•</span>
                                  <span className="text-xs text-gray-500 font-mono">{item.partnumber || '-'}</span>
                                </div>
                                <div className="text-sm text-gray-800 leading-tight">{item.name}</div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm font-semibold text-gray-900 mb-1">
                                  {formatPrice((item.price || 0) * (item.quantity || 0))}
                                </div>
                                <div className="text-xs text-gray-600">{item.quantity} шт.</div>
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getGarageStatusColor(item.status_code)}`}>
                                {getGarageStatusName(item.status_code)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {newOrders.length === 0 && <div className="text-gray-600">Заказов новых товаров нет</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

