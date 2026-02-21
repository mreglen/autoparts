import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';
import { fetchProductStorageCells } from '../../redux/slices/StorageCellsSlice';

export default function SalesOrdersPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const { productStorageCells } = useSelector((state) => state.storageCells);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null); // {type: 'order'|'item', id: number}
  const [availableStatuses, setAvailableStatuses] = useState([]);
  const [authChecked, setAuthChecked] = useState(false);

  console.log('orders:', orders);
  console.log('user:', user);
  console.log('permissionCodes:', permissionCodes);
  
  // Check if user has permission to view this page
  // Admin and sellers always have access
  // Employees need 'sales.orders' permission code
  const hasPermission = user?.is_admin || user?.is_seller || 
    (user?.is_employee && permissionCodes && permissionCodes.includes('sales.orders'));
  
  // Проверка прав доступа - делаем проверку только когда user загружен
  useEffect(() => {
    // Если user еще не загружен (null), ждем
    if (user === undefined || user === null) {
      // Проверяем есть ли токен - если есть, ждем загрузки профиля
      const token = localStorage.getItem('token');
      if (token) {
        return; // Ждем пока загрузится профиль
      }
    }
    
    // Отмечаем что проверка auth выполнена
    setAuthChecked(true);
    
    if (!hasPermission) {
      navigate('/', { replace: true });
    }
  }, [user, permissionCodes, hasPermission, navigate]);

  useEffect(() => {
    // Ждем пока auth проверка завершится
    if (!authChecked) return;
    
    if (hasPermission) {
      fetchOrders();
    }
  }, [hasPermission, authChecked]);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      // Используем новый endpoint /orders/sales/all который учитывает роль пользователя
      // и is_admin директора организации
      const ordersResponse = await apiAxios.get('/orders/sales/all');

      setOrders(ordersResponse.data);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      setError('Не удалось загрузить заказы');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, statusCode) => {
    try {
      const token = localStorage.getItem('token');
      await apiAxios.put(
        `/orders/${orderId}/status`,
        { status_code: statusCode },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      // Обновляем локальное состояние
      setOrders(orders.map(order =>
        order.id === orderId
          ? { ...order, status: { ...order.status, code: statusCode, name: getStatusName(statusCode) } }
          : order
      ));
      setEditingStatus(null);
    } catch (error) {
      console.error('Ошибка обновления статуса заказа:', error);
      alert('Не удалось обновить статус заказа');
    }
  };

  const updateItemStatus = async (itemId, statusCode) => {
    try {
      const token = localStorage.getItem('token');
      await apiAxios.put(
        `/orders/items/${itemId}/status`,
        { status_code: statusCode },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      // Обновляем локальное состояние
      setOrders(orders.map(order => ({
        ...order,
        items: order.items.map(item =>
          item.id === itemId
            ? { ...item, status: { ...item.status, code: statusCode, name: getStatusName(statusCode) } }
            : item
        )
      })));
      setEditingStatus(null);
    } catch (error) {
      console.error('Ошибка обновления статуса элемента:', error);
      alert('Не удалось обновить статус элемента');
    }
  };

  const getStatusName = (statusCode) => {
    const statusMap = {
      'pending': 'В ожидании',
      'confirmed': 'Подтверждён',
      'rejected': 'Не подтверждён',
      'assembled': 'Сформирован',
      'shipped': 'Передан в доставку',
      'delivered': 'Получен',
      'closed': 'Закрыт'
    };
    return statusMap[statusCode] || statusCode;
  };

  const getStatusColor = (statusCode) => {
    const colorMap = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'confirmed': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'assembled': 'bg-blue-100 text-blue-800',
      'shipped': 'bg-purple-100 text-purple-800',
      'delivered': 'bg-indigo-100 text-indigo-800',
      'closed': 'bg-gray-100 text-gray-800'
    };
    return colorMap[statusCode] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(price);
  };


  const getDeliveryInfo = (order) => {
    if (order.delivery_type === 'pickup') {
      return `Самовывоз: ${order.pickup_address || 'Адрес не указан'}`;
    } else if (order.delivery_type === 'transport') {
      return `${order.transport_company}: ${order.delivery_address || 'Адрес не указан'}`;
    }
    return 'Способ доставки не указан';
  };

  // Get storage address for a product from the order item's product_storage_cells
  const getProductStorageAddressFromItem = (item) => {
    if (!item.product_storage_cells || !Array.isArray(item.product_storage_cells)) {
      return null;
    }
    return item.product_storage_cells
      .map(cellLink => cellLink.value)
      .filter(value => value)
      .join('; ') || null; // Return null if no valid values
  };

  // Get storage address by brand and part number
  const getProductStorageAddressByBrandPartNumber = (item) => {
    if (item.storage_location && item.storage_location.address) {
      return item.storage_location.address;
    }
    return null;
  };

  // Показываем загрузку пока auth данные загружаются
  if (!authChecked) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  // Если пользователь не имеет прав доступа, не показываем страницу
  if (!hasPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Доступ запрещен</h2>
          <p className="text-gray-600">У вас нет прав для просмотра этой страницы</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-16 px-6">
        <div className="bg-gray-100 rounded-full w-20 h-20 md:w-24 md:h-24 mx-auto mb-6 flex items-center justify-center">
          <svg className="animate-spin h-10 w-10 md:h-12 md:w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <h2 className="text-xl md:text-2xl font-medium text-gray-900 mb-2">Загрузка заказов покупателей...</h2>
        <p className="text-gray-600 text-base">Пожалуйста, подождите</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 px-6">
        <div className="bg-red-100 rounded-full w-20 h-20 md:w-24 md:h-24 mx-auto mb-6 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 md:h-12 md:w-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl md:text-2xl font-medium text-gray-900 mb-2">Ошибка загрузки заказов покупателей</h2>
        <p className="text-gray-500 mb-6 text-base">{error}</p>
        <button
          onClick={fetchOrders}
          className="inline-flex items-center px-5 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 min-h-[48px]"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  const toggleOrderExpansion = (orderId) => {
    const isExpanding = expandedOrderId !== orderId;
    setExpandedOrderId(isExpanding ? orderId : null);
    
    if (isExpanding) {
      // When expanding an order, no need to fetch storage cells since they come with the order data
      // The storage cells are already included in the order items
      // const order = orders.find(o => o.id === orderId);
      // if (order && order.items) {
      //   order.items.forEach(item => {
      //     // Try to get product ID from various possible fields
      //     const productId = item.product_id || item.product?.id;
      //     if (productId) {
      //       // Use the Redux action to fetch storage cells
      //       dispatch(fetchProductStorageCells(productId));
      //     }
      //   });
      // }
    }
  };

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Заказы покупателей</h1>
        <p className="mt-2 text-gray-600 text-base sm:text-base">Управление заказами клиентов</p>
      </div>

      <div className="space-y-6">
        {/* Десктопная версия - таблица */}
        <div className="hidden md:block bg-white shadow-sm rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-[13%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Номер заказа
                  </th>
                  <th className="w-[8%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата
                  </th>
                  <th className="w-[12%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Клиент
                  </th>
                  <th className="w-[12%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Телефон
                  </th>
                  <th className="w-[18%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Способ доставки
                  </th>
                  <th className="w-[8%] px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Оплата
                  </th>
                  <th className="w-[10%] px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="w-[11%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Сумма
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <React.Fragment key={order.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleOrderExpansion(order.id)}
                    >
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.order_number}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-900">
                      {order.recipient_name}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.recipient_phone}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-900">
                      {getDeliveryInfo(order)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded-full ${
                        order.is_paid
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {order.is_paid ? 'Оплачено' : 'Не оплачено'}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-center">
                      {editingStatus?.type === 'order' && editingStatus?.id === order.id ? (
                        <select
                          value={order.status.code}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          onBlur={() => setEditingStatus(null)}
                          className="text-xs px-1.5 py-0.5 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          autoFocus
                        >
                          <option value="pending">В ожидании</option>
                          <option value="confirmed">Подтверждён</option>
                          <option value="rejected">Не подтверждён</option>
                          <option value="assembled">Сформирован</option>
                          <option value="shipped">Передан в доставку</option>
                          <option value="delivered">Получен</option>
                          <option value="closed">Закрыт</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 ${getStatusColor(order.status.code)}`}
                          onClick={(e) => {
                            e.stopPropagation(); // Предотвращаем вызов toggleOrderExpansion
                            setEditingStatus({ type: 'order', id: order.id });
                          }}
                        >
                          {order.status.name}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-left">
                      {formatPrice(order.total_amount)}
                    </td>
                  </tr>

                  {/* Детали заказа - таблица с запчастями */}
                  {expandedOrderId === order.id && order.items && order.items.length > 0 && (
                    <tr>
                      <td colSpan="8" className="px-6 py-4 bg-gray-50">
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full table-fixed divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="w-[17%] px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Товар
                                </th>
                                <th className="w-[25%] px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Наименование
                                </th>
                                <th className="w-[8%] px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Кол-во
                                </th>
                                <th className="w-[10%] px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Сумма
                                </th>
                                <th className="w-[30%] px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Адрес хранения
                                </th>
                                <th className="w-[10%] px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Статус
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {order.items.filter((item, index, self) =>
                                index === self.findIndex(i => i.id === item.id)  // Remove duplicates by ID
                              ).map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                  <td className="w-[17%] px-2 py-2 text-sm text-gray-900">
                                    <div className="leading-tight">
                                      <div className="font-medium">{item.brand}</div>
                                      <div className="text-gray-600">{item.partnumber}</div>
                                    </div>
                                  </td>
                                  <td className="w-[25%] px-2 py-2 text-sm text-gray-900">
                                    <div className="leading-tight break-words max-w-xs">
                                      {item.name}
                                    </div>
                                  </td>
                                  <td className="w-[8%] px-2 py-2 text-sm text-gray-900 text-center">
                                    {item.quantity} шт.
                                  </td>
                                  <td className="w-[10%] px-2 py-2 text-sm font-medium text-gray-900 text-left">
                                    {formatPrice(item.price * item.quantity)}
                                  </td>
                                  <td className="w-[30%] px-2 py-2 text-sm text-gray-900">
                                    <div>
                                      {(() => {
                                        let storageAddress = null;
                                        // First, try to get storage address by product_id
                                        if (item.product_id) {
                                          storageAddress = getProductStorageAddressFromItem(item);
                                        }
                                        // If no storage address found and no product_id, try to get by brand/partnumber
                                        if (!storageAddress && !item.product_id) {
                                          storageAddress = getProductStorageAddressByBrandPartNumber(item);
                                        }
                                        return storageAddress ? (
                                          <div className="px-3 py-2 bg-gray-50 rounded text-sm text-gray-700 border border-gray-200">
                                            {storageAddress}
                                          </div>
                                        ) : (
                                          <div className="text-gray-400 italic">-</div>
                                        );
                                      })()}
                                    </div>
                                  </td>
                                  <td className="w-[10%] px-2 py-2 text-center">
                                    {editingStatus?.type === 'item' && editingStatus?.id === item.id ? (
                                      <select
                                        value={item.status.code}
                                        onChange={(e) => updateItemStatus(item.id, e.target.value)}
                                        onBlur={() => setEditingStatus(null)}
                                        className="text-xs px-1.5 py-0.5 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                        autoFocus
                                      >
                                        <option value="pending">В ожидании</option>
                                        <option value="confirmed">Подтверждён</option>
                                        <option value="rejected">Не подтверждён</option>
                                        <option value="assembled">Сформирован</option>
                                        <option value="shipped">Передан в доставку</option>
                                        <option value="delivered">Получен</option>
                                        <option value="closed">Закрыт</option>
                                      </select>
                                    ) : (
                                      <span
                                        className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 ${getStatusColor(item.status.code)}`}
                                        onClick={(e) => {
                                          e.stopPropagation(); // Предотвращаем взаимодействие с другими элементами
                                          setEditingStatus({ type: 'item', id: item.id });
                                        }}
                                      >
                                        {item.status.name}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {orders.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Заказов покупателей нет</h3>
              <p className="mt-1 text-sm text-gray-500">Здесь будут отображаться оформленные заказы</p>
            </div>
          )}
        </div>

        {/* Мобильная версия - карточки */}
        <div className="md:hidden space-y-5">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              {/* Заголовок карточки */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base font-semibold text-gray-900">Заказ #{order.order_number}</span>
                    <span className="text-sm text-gray-400">•</span>
                    <span className="text-sm text-gray-500">{formatDate(order.created_at)}</span>
                  </div>
                  <div className="text-base text-gray-800 mb-1">{order.recipient_name}</div>
                  <div className="text-sm text-gray-600 mb-3">{order.recipient_phone}</div>
                  <div className="text-sm text-gray-600">{getDeliveryInfo(order)}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-gray-900 mb-2">
                    {formatPrice(order.total_amount)}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full self-end ${
                      order.is_paid
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {order.is_paid ? 'Оплачено' : 'Не оплачено'}
                    </span>
                    <div className="mt-2">
                      {editingStatus?.type === 'order' && editingStatus?.id === order.id ? (
                        <select
                          value={order.status.code}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          onBlur={() => setEditingStatus(null)}
                          className="text-sm px-2 py-1 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 min-w-[120px]"
                          autoFocus
                        >
                          <option value="pending">В ожидании</option>
                          <option value="confirmed">Подтверждён</option>
                          <option value="rejected">Не подтверждён</option>
                          <option value="assembled">Сформирован</option>
                          <option value="shipped">Передан в доставку</option>
                          <option value="delivered">Получен</option>
                          <option value="closed">Закрыт</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 ${getStatusColor(order.status.code)}`}
                          onClick={() => {
                            setEditingStatus({ type: 'order', id: order.id });
                          }}
                        >
                          {order.status.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Кнопка показа деталей */}
              <div className="pt-3 border-t border-gray-100">
                <button
                  onClick={() => toggleOrderExpansion(order.id)}
                  className="w-full text-indigo-600 text-sm font-medium hover:text-indigo-800 transition-colors py-2"
                >
                  {expandedOrderId === order.id ? 'Скрыть товары' : `Показать товары (${order.items?.length || 0})`}
                </button>
              </div>

              {/* Детали заказа - мобильная версия */}
              {expandedOrderId === order.id && order.items && order.items.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-3">
                    {order.items.filter((item, index, self) =>
                      index === self.findIndex(i => i.id === item.id)  // Remove duplicates by ID
                    ).map((item) => (
                      <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 pr-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">{item.brand}</span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-500 font-mono">{item.partnumber}</span>
                            </div>
                            <div className="text-sm text-gray-800 leading-tight">{item.name}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-semibold text-gray-900 mb-1">
                              {formatPrice(item.price * item.quantity)}
                            </div>
                            <div className="text-xs text-gray-600">{item.quantity} шт.</div>
                          </div>
                        </div>
                        <div className="mb-2">
                          <div className="text-xs text-gray-500">Адрес хранения</div>
                          {(() => {
                            let storageAddress = null;
                            // First, try to get storage address by product_id
                            if (item.product_id) {
                              storageAddress = getProductStorageAddressFromItem(item);
                            }
                            // If no storage address found and no product_id, try to get by brand/partnumber
                            if (!storageAddress && !item.product_id) {
                              storageAddress = getProductStorageAddressByBrandPartNumber(item);
                            }
                            return storageAddress ? (
                              <div className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700 border border-gray-200">
                                {storageAddress}
                              </div>
                            ) : (
                              <div className="text-gray-400 italic text-xs">-</div>
                            );
                          })()}
                        </div>
                        <div className="flex justify-end">
                          {editingStatus?.type === 'item' && editingStatus?.id === item.id ? (
                            <select
                              value={item.status.code}
                              onChange={(e) => updateItemStatus(item.id, e.target.value)}
                              onBlur={() => setEditingStatus(null)}
                              className="text-sm px-2 py-1 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 min-w-[120px]"
                              autoFocus
                            >
                              <option value="pending">В ожидании</option>
                              <option value="confirmed">Подтверждён</option>
                              <option value="rejected">Не подтверждён</option>
                              <option value="assembled">Сформирован</option>
                              <option value="shipped">Передан в доставку</option>
                              <option value="delivered">Получен</option>
                              <option value="closed">Закрыт</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 ${getStatusColor(item.status.code)}`}
                              onClick={() => {
                                setEditingStatus({ type: 'item', id: item.id });
                              }}
                            >
                              {item.status.name}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {orders.length === 0 && (
            <div className="text-center py-16 px-6">
              <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Заказов покупателей нет</h2>
              <p className="text-gray-600 text-base">Здесь будут отображаться оформленные заказы</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
