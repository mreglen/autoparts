import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';
import { fetchProductStorageCells } from '../../redux/slices/StorageCellsSlice';
import { fetchAvitoChatProductLink } from '../../redux/slices/AvitoChatSlice';
import { AvitoOrderCard } from '../../components/AvitoOrderCard';
import { GarageOrderCard } from '../../components/GarageOrderCard';
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
  const { productStorageCells } = useSelector((state) => state.storageCells);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Обработчик клика по названию товара (для мобильной версии)
  const handleProductClick = async (item, e) => {
    e.stopPropagation();
    
    console.log('=== HANDLE PRODUCT CLICK ===');
    console.log('Full item data:', JSON.stringify(item, null, 2));
    console.log('item.product_id:', item.product_id);
    console.log('item.productId:', item.productId);
    console.log('item.linked_product_id:', item.linked_product_id);
    console.log('item.linkedProductId:', item.linkedProductId);
    console.log('item.avito_context_id:', item.avito_context_id);
    console.log('item.avito_context_url:', item.avito_context_url);
    console.log('item.avito_url:', item.avito_url);
    console.log('item.avitoId:', item.avitoId);
    console.log('item.avitoItemId:', item.avitoItemId);
    console.log('item.avito_id:', item.avito_id);
    console.log('item.avitoUrl:', item.avitoUrl);
    console.log('item.url:', item.url);
    
    // Если есть product_id или linked_product_id - переходим на /part/
    if (item.product_id || item.productId || item.linked_product_id || item.linkedProductId) {
      const productId = item.product_id || item.productId || item.linked_product_id || item.linkedProductId;
      console.log('✅ Navigating to /part/', productId);
      navigate(`/part/${productId}`);
    }
    // Если есть avito id - проверяем связь (для Авито позиций и чатов)
    else if (item.avitoItemId || item.avitoId || item.avito_id || item.avito_context_id) {
      const avitoId = item.avitoItemId || item.avitoId || item.avito_id || item.avito_context_id;
      console.log('🔍 Checking Avito link for avito id:', avitoId);
      try {
        const linkData = await dispatch(fetchAvitoChatProductLink(avitoId)).unwrap();
        console.log('Avito link data:', linkData);
        if (linkData?.linked && linkData?.product_id) {
          console.log('✅ Found linked product, navigating to /part/', linkData.product_id);
          navigate(`/part/${linkData.product_id}`);
        } else {
          console.log('❌ No link found, opening confirmation page');
          // Нет связи - открываем страницу подтверждения
          const fallbackUrl = item.avitoUrl || item.url || item.avito_context_url || item.avito_url || 'https://avito.ru';
          const encodedUrl = encodeURIComponent(fallbackUrl);
          window.open(`/product-not-found?avitoUrl=${encodedUrl}`, '_blank');
        }
      } catch (error) {
        console.error('❌ Error checking Avito link:', error);
        // Ошибка - открываем страницу подтверждения
        const fallbackUrl = item.avitoUrl || item.url || item.avito_context_url || item.avito_url || 'https://avito.ru';
        const encodedUrl = encodeURIComponent(fallbackUrl);
        window.open(`/product-not-found?avitoUrl=${encodedUrl}`, '_blank');
      }
    }
    // Если есть просто avito_url
    else if (item.avitoUrl || item.url || item.avito_url || item.avito_context_url) {
      console.log('🔗 Opening product-not-found with avito_url');
      const encodedUrl = encodeURIComponent(item.avitoUrl || item.url || item.avito_url || item.avito_context_url);
      window.open(`/product-not-found?avitoUrl=${encodedUrl}`, '_blank');
    } else {
      console.log('⚠️ No product link data found in item');
    }
  };
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null); // {type: 'order'|'item'|'avito', id: number}
  const [availableStatuses, setAvailableStatuses] = useState([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [userOrgId, setUserOrgId] = useState(null);
  const [avitoStatuses, setAvitoStatuses] = useState([]);
  const [avitoTransitions, setAvitoTransitions] = useState({}); // { avitoOrderId: [transitions] }
  const [activeTab, setActiveTab] = useState('garage'); // 'garage' | 'avito'

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
      // Получаем organization_id пользователя
      if (user?.organization_id) {
        setUserOrgId(user.organization_id);
      }
      fetchOrders();
    }
  }, [hasPermission, authChecked, user]);

  // Загружаем статусы Авито при монтировании
  useEffect(() => {
    const fetchAvitoStatuses = async () => {
      try {
        const response = await apiAxios.get('/organizations/avito/order-statuses');
        setAvitoStatuses(response.data);
      } catch (error) {
        console.error('Ошибка загрузки статусов Авито:', error);
      }
    };
    
    if (hasPermission) {
      fetchAvitoStatuses();
    }
  }, [hasPermission]);

  useEffect(() => {
    const fetchOrderStatuses = async () => {
      try {
        const response = await apiAxios.get('/orders/statuses/');
        setAvailableStatuses(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Ошибка загрузки статусов заказов:', error);
      }
    };

    if (hasPermission) {
      fetchOrderStatuses();
    }
  }, [hasPermission]);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      console.log('=== Starting orders fetch ===');
      console.log('User org ID:', userOrgId);
      console.log('User:', user);

      // Сначала синхронизируем заказы Авито
      if (userOrgId) {
        try {
          console.log('Syncing Avito orders...');
          const syncResponse = await apiAxios.get(`/organizations/${userOrgId}/avito/orders/sync`);
          console.log('Avito orders sync response:', syncResponse.data);
          console.log(`Created: ${syncResponse.data.created_count}, Updated: ${syncResponse.data.updated_count}`);
          
          // Показываем ошибки синхронизации если они есть
          if (syncResponse.data.errors && syncResponse.data.errors.length > 0) {
            console.error('Avito sync errors:', syncResponse.data.errors);
            // Не показываем ошибку пользователю если есть хотя бы один успешный заказ
            if (syncResponse.data.created_count === 0 && syncResponse.data.updated_count === 0) {
              console.warn('Avito sync failed with errors:', syncResponse.data.errors);
            }
          }
        } catch (err) {
          // Показываем ошибку синхронизации
          console.error('Avito sync FAILED:', err);
          const errorMsg = err.response?.data?.detail || err.message;
          
          // Не прерываем загрузку обычных заказов
          if (errorMsg.includes('Интеграция с Авито не настроена')) {
            console.log('Avito integration not configured');
          } else {
            console.error('Avito sync error:', errorMsg);
          }
        }
      }

      // Используем новый endpoint /orders/sales/all который учитывает роль пользователя
      // и is_admin директора организации
      console.log('Fetching all sales orders...');
      const ordersResponse = await apiAxios.get('/orders/sales/all');
      console.log('Orders received:', ordersResponse.data.length);
      console.log('Orders data:', ordersResponse.data);
      
      // Логируем источники заказов
      const avitoOrders = ordersResponse.data.filter(o => o.source === 'avito');
      const garageOrders = ordersResponse.data.filter(o => o.source === 'garage' || !o.source);
      console.log(`Avito orders: ${avitoOrders.length}, Garage orders: ${garageOrders.length}`);
      
      if (avitoOrders.length > 0) {
        console.log('First Avito order:', avitoOrders[0]);
      }

      setOrders(ordersResponse.data);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      setError('Не удалось загрузить заказы');
    } finally {
      setLoading(false);
    }
  };


  const updateOrderStatus = async (orderId, statusCode) => {
    const allowedCodes = new Set(getOrderStatusOptions().map((status) => status.code));
    if (!allowedCodes.has(statusCode)) {
      alert(`Недопустимый статус для заказа "Свой гараж": ${statusCode}`);
      return;
    }

    try {
      console.log('Updating order status:', { orderId, statusCode });
      const token = localStorage.getItem('token');
      const response = await apiAxios.put(
        `/orders/${orderId}/status`,
        { status_code: statusCode },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      console.log('Response:', response);

      // Обновляем локальное состояние
      setOrders(orders.map(order =>
        order.id === orderId
          ? { ...order, status: { ...order.status, code: statusCode, name: getStatusName(statusCode) } }
          : order
      ));
      setEditingStatus(null);
    } catch (error) {
      console.error('Ошибка обновления статуса заказа:', error);
      console.error('Error response:', error.response?.data);
      alert('Не удалось обновить статус заказа: ' + (error.response?.data?.detail || error.message));
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
    const dynamicStatus = availableStatuses.find((status) => status.code === statusCode);
    if (dynamicStatus?.name) {
      return dynamicStatus.name;
    }
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

  const getOrderStatusOptions = () => {
    if (availableStatuses.length > 0) {
      return availableStatuses.map((status) => ({
        code: status.code,
        name: status.name,
      }));
    }
    return [
      { code: 'pending', name: 'В ожидании' },
      { code: 'confirmed', name: 'Подтверждён' },
      { code: 'rejected', name: 'Не подтверждён' },
      { code: 'assembled', name: 'Сформирован' },
      { code: 'shipped', name: 'Передан в доставку' },
      { code: 'delivered', name: 'Получен' },
      { code: 'closed', name: 'Закрыт' },
    ];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const getAvitoStatusColor = (statusCode) => {
    const colorMap = {
      'on_confirmation': 'bg-yellow-100 text-yellow-800',
      'ready_to_ship': 'bg-blue-100 text-blue-800',
      'in_transit': 'bg-purple-100 text-purple-800',
      'delivered': 'bg-green-100 text-green-800',
      'canceled': 'bg-red-100 text-red-800',
      'closed': 'bg-gray-100 text-gray-800',
      'on_return': 'bg-orange-100 text-orange-800',
      'in_dispute': 'bg-pink-100 text-pink-800',
    };
    return colorMap[statusCode] || 'bg-gray-100 text-gray-800';
  };

  const getAvitoStatusName = (statusCode) => {
    const statusMap = {
      'on_confirmation': 'Ожидает подтверждения',
      'ready_to_ship': 'Ждет отправки',
      'in_transit': 'В пути',
      'delivered': 'Доставлен',
      'canceled': 'Отменен',
      'closed': 'Закрыт',
      'on_return': 'На возврате',
      'in_dispute': 'Открыт спор',
    };
    return statusMap[statusCode] || statusCode;
  };

  const getAvitoTransitionLabel = (transition) => {
    const labels = {
      confirm: 'confirm (подтвердить)',
      reject: 'reject (отклонить)',
      perform: 'perform (подтвердить отправку)',
      receive: 'receive (подтвердить доставку)',
    };
    return labels[transition] || transition;
  };

  const getAvitoTransitionOptions = (order) => {
    const fallback = ['confirm', 'reject', 'perform', 'receive'];
    const fromApi = avitoTransitions[order.avito_order_id];
    const options = Array.isArray(fromApi) && fromApi.length > 0 ? fromApi : fallback;
    return options.filter(Boolean);
  };

  const handleAvitoTransition = async (avitoOrderId, transition) => {
    if (!userOrgId) return;

    let params;
    if (transition === 'perform' || transition === 'receive') {
      const confirmCode = window.prompt('Введите confirmCode (код подтверждения покупателя):', '');
      if (!confirmCode) {
        alert('Переход отменён: confirmCode обязателен');
        return;
      }
      const marketplaceId = window.prompt('Введите marketplaceId (номер заказа в новой системе):', '');
      if (!marketplaceId) {
        alert('Переход отменён: marketplaceId обязателен');
        return;
      }
      params = {
        cnc: {
          confirmCode: String(confirmCode).trim(),
          marketplaceId: String(marketplaceId).trim(),
        },
      };
    }

    try {
      await apiAxios.post(
        `/organizations/${userOrgId}/avito/orders/${avitoOrderId}/transition`,
        params ? { transition, params } : { transition }
      );
      
      // Перезагружаем заказы
      await fetchOrders();
      setEditingStatus(null);
    } catch (error) {
      console.error('Ошибка изменения статуса Авито:', error);
      alert('Не удалось изменить статус: ' + (error.response?.data?.detail || error.message));
    }
  };



  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(price);
  };


  const getDeliveryInfo = (order) => {
    // Для Avito заказов используем avito_data
    if (order.source === 'avito') {
      const avitoData = order.avito_data || {};
      const delivery = avitoData.delivery || {};
      return delivery.serviceName || 'Доставка Авито';
    }
    
    // Для обычных заказов
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

  const toggleOrderExpansion = async (orderId) => {
    const isExpanding = expandedOrderId !== orderId;
    setExpandedOrderId(isExpanding ? orderId : null);
    
    if (isExpanding) {
      const order = orders.find(o => o.id === orderId);
      if (order && order.source === 'avito' && order.avito_order_id && userOrgId) {
        try {
          const response = await apiAxios.get(
            `/organizations/${userOrgId}/avito/orders/${order.avito_order_id}/transitions`
          );
          setAvitoTransitions(prev => ({
            ...prev,
            [order.avito_order_id]: response.data.transitions
          }));
        } catch (error) {
          console.error('Ошибка загрузки переходов Авито:', error);
        }
      }
    }
  };

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Заказы покупателей</h1>
            <p className="mt-2 text-gray-600 text-base sm:text-base">Управление заказами клиентов</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Вкладки для разделения заказов */}
        <div className="bg-white shadow-sm rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('garage')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'garage'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Свой Гараж
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {orders.filter(o => o.source === 'garage' || !o.source).length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('avito')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'avito'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Авито
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {orders.filter(o => o.source === 'avito').length}
                </span>
              </button>
            </nav>
          </div>
        </div>

        {/* Десктопная версия - карточки Свой Гараж */}
        {activeTab === 'garage' && (
        <div className="hidden md:block">
          <div className="space-y-4">
            {orders
              .filter(order => order.source === 'garage' || !order.source)
              .map((order) => (
                <GarageOrderCard
                  key={order.id}
                  order={order}
                  isExpanded={expandedOrderId === order.id}
                  onToggle={toggleOrderExpansion}
                  editingStatus={editingStatus}
                  onEditStatus={setEditingStatus}
                  onUpdateStatus={updateOrderStatus}
                  getStatusColor={getStatusColor}
                  getStatusName={getStatusName}
                  orderStatusOptions={getOrderStatusOptions()}
                  formatDate={formatDate}
                  formatPrice={formatPrice}
                />
              ))}
          </div>

          {orders.filter(order => order.source === 'garage' || !order.source).length === 0 && (
            <div className="text-center py-16 bg-white rounded-lg shadow-sm">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Заказов Свой Гараж нет</h3>
              <p className="mt-1 text-sm text-gray-500">Здесь будут отображаться заказы из Свой Гараж</p>
            </div>
          )}
        </div>
        )}

        {/* Десктопная версия - карточки Авито */}
        {activeTab === 'avito' && (
        <div className="hidden md:block">
          <div className="space-y-4">
            {orders
              .filter(order => order.source === 'avito')
              .map((order) => (
                <AvitoOrderCard
                  key={order.id}
                  order={order}
                  isExpanded={expandedOrderId === order.id}
                  onToggle={toggleOrderExpansion}
                  editingStatus={editingStatus}
                  onEditStatus={setEditingStatus}
                  onAvitoTransition={handleAvitoTransition}
                  getAvitoTransitionOptions={getAvitoTransitionOptions}
                  getAvitoTransitionLabel={getAvitoTransitionLabel}
                  getAvitoStatusColor={getAvitoStatusColor}
                  getAvitoStatusName={getAvitoStatusName}
                  formatDate={formatDate}
                  formatPrice={formatPrice}
                />
              ))}
          </div>

          {orders.filter(order => order.source === 'avito').length === 0 && (
            <div className="text-center py-16 bg-white rounded-lg shadow-sm">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Заказов Авито нет</h3>
              <p className="mt-1 text-sm text-gray-500">Здесь будут отображаться заказы из Авито</p>
            </div>
          )}
        </div>
        )}

        {/* Мобильная версия - карточки */}
        <div className="md:hidden space-y-5">
          {orders
            .filter(order => {
              if (activeTab === 'garage') {
                return order.source === 'garage' || !order.source;
              } else if (activeTab === 'avito') {
                return order.source === 'avito';
              }
              return true;
            })
            .map((order) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              {/* Заголовок карточки */}
              {activeTab === 'garage' ? (
              <div className="mb-4 space-y-3 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-gray-900">Заказ #{order.order_number}</span>
                  <span className="text-sm text-gray-400">•</span>
                  <span className="text-sm text-gray-500">{formatDate(order.created_at)}</span>
                </div>

                <div className="flex items-start gap-2 min-w-0">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm text-gray-800 break-words min-w-0">{order.recipient_name}</span>
                </div>

                <div className="flex items-start gap-2 min-w-0">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-sm text-gray-600 break-all min-w-0">{order.recipient_phone}</span>
                </div>

                <div className="flex items-start gap-2 min-w-0">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                  </svg>
                  <span className="text-sm text-gray-600 break-words min-w-0">{getDeliveryInfo(order)}</span>
                </div>

                <div className="pt-3 border-t border-gray-100 flex flex-col gap-3 min-w-0">
                  <div className="text-lg font-bold text-gray-900">{formatPrice(order.total_amount)}</div>

                  <div className="flex flex-col gap-2 w-full min-w-0">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full shrink-0 leading-tight whitespace-normal ${
                        order.is_paid
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {order.is_paid ? 'Оплачен' : 'Не оплачено'}
                      </span>
                      {editingStatus?.type === 'order' && editingStatus?.id === order.id ? null : (
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 max-w-full min-w-0 break-words ${getStatusColor(order.status.code)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingStatus({ type: 'order', id: order.id });
                          }}
                        >
                          {order.status.name}
                        </span>
                      )}
                    </div>

                    {editingStatus?.type === 'order' && editingStatus?.id === order.id ? (
                      <select
                        value={order.status.code || 'pending'}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateOrderStatus(order.id, e.target.value);
                        }}
                        onBlur={() => setEditingStatus(null)}
                        className="text-xs px-2 py-1.5 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 w-full max-w-full min-w-0"
                        autoFocus
                      >
                        {getOrderStatusOptions().map((status) => (
                          <option key={status.code} value={status.code}>
                            {status.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                </div>
              </div>
              ) : (
              (() => {
                const { delivery, buyerName, buyerPhone } = getAvitoBuyerAndDelivery(order);
                const displayTotal = getAvitoDisplayTotal(order);
                const deliveryText = getAvitoMobileDeliveryText(delivery);
                return (
              <div className="mb-4 space-y-3 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-mono">
                    Авито #{order.avito_order_id}
                  </span>
                  <span className="text-sm text-gray-400">•</span>
                  <span className="text-sm text-gray-500">{formatDate(order.created_at)}</span>
                </div>
                <div className="flex items-start gap-2 min-w-0">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm text-gray-800 break-words min-w-0">{buyerName}</span>
                </div>
                <div className="flex items-start gap-2 min-w-0">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-sm text-gray-600 break-all min-w-0">{buyerPhone}</span>
                </div>
                <div className="flex items-start gap-2 min-w-0">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                  </svg>
                  <span className="text-sm text-gray-600 break-words min-w-0">{deliveryText}</span>
                </div>
                <div className="pt-3 border-t border-gray-100 flex flex-col gap-3 min-w-0">
                  <div className="text-lg font-bold text-gray-900">{formatPrice(displayTotal)}</div>
                  <div className="flex flex-col gap-2 w-full min-w-0">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full shrink-0 leading-tight whitespace-normal ${
                        order.is_paid
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {order.is_paid ? 'Оплачен' : 'Не оплачено'}
                      </span>
                      {editingStatus?.type === 'avito' && editingStatus?.id === order.id ? null : (
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 max-w-full min-w-0 break-words ${getAvitoStatusColor(order.avito_status_code)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingStatus({ type: 'avito', id: order.id });
                          }}
                        >
                          {getAvitoStatusName(order.avito_status_code)}
                        </span>
                      )}
                    </div>
                    {editingStatus?.type === 'avito' && editingStatus?.id === order.id ? (
                      <select
                        value=""
                        onChange={(e) => handleAvitoTransition(order.avito_order_id, e.target.value)}
                        onBlur={() => setEditingStatus(null)}
                        className="text-xs px-2 py-1.5 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 w-full max-w-full min-w-0"
                        autoFocus
                      >
                        <option value="" disabled>Выберите действие</option>
                        {getAvitoTransitionOptions(order).map((transition) => (
                          <option key={transition} value={transition}>
                            {getAvitoTransitionLabel(transition)}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                </div>
              </div>
                );
              })()
              )}

              {/* Кнопка показа деталей */}
              <div className="pt-3 border-t border-gray-100">
                <button
                  onClick={() => toggleOrderExpansion(order.id)}
                  className="w-full text-indigo-600 text-sm font-medium hover:text-indigo-800 transition-colors py-2"
                >
                  {(() => {
                    const itemsCount = activeTab === 'avito'
                      ? getAvitoOrderItems(order).length
                      : (order.items?.length || 0);
                    return expandedOrderId === order.id ? 'Скрыть товары' : `Показать товары (${itemsCount})`;
                  })()}
                </button>
              </div>

              {/* Детали заказа - мобильная версия */}
              {expandedOrderId === order.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-3">
                    {activeTab === 'avito' ? (
                      (() => {
                        const avitoItems = getAvitoOrderItems(order);
                        return avitoItems.length > 0 ? (
                          avitoItems.map((item, index) => (
                          <div key={item.avitoId || item.id || index} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex justify-between items-start mb-2 gap-2 min-w-0">
                              <div className="flex-1 pr-3 min-w-0">
                                <button
                                  onClick={(e) => handleProductClick(item, e)}
                                  className="text-sm font-medium text-gray-900 leading-tight hover:text-indigo-600 transition-colors cursor-pointer text-left underline break-words"
                                  title="Перейти к товару"
                                >
                                  {getAvitoLineItemTitle(item)}
                                </button>
                                {item.product_id && (
                                  <div className="text-xs text-indigo-600 mt-1">ID товара: #{item.product_id}</div>
                                )}
                                {item.location && (
                                  <div className="text-xs text-gray-500 mt-1">{item.location}</div>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm font-semibold text-gray-900 mb-1">
                                  {formatPrice(getAvitoLineItemTotal(item))}
                                </div>
                                <div className="text-xs text-gray-600">{getAvitoLineItemQty(item)} шт.</div>
                              </div>
                            </div>
                          </div>
                          ))
                        ) : (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            Товары не загружены
                          </div>
                        );
                      })()
                    ) : (
                      // Товары Свой Гараж из order.items
                      order.items.filter((item, index, self) =>
                        index === self.findIndex(i => i.id === item.id)
                      ).map((item) => (
                        <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 pr-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900">{item.brand}</span>
                                <span className="text-xs text-gray-400">•</span>
                                <span className="text-xs text-gray-500 font-mono">{item.partnumber}</span>
                              </div>
                              {/* Название товара - кликабельное */}
                              <button
                                onClick={(e) => handleProductClick(item, e)}
                                className="text-sm text-gray-800 leading-tight hover:text-indigo-600 transition-colors cursor-pointer text-left underline"
                                title="Перейти к товару"
                              >
                                {item.name}
                              </button>
                              {item.product_id && (
                                <div className="text-xs text-gray-400 mt-1">Код товара: #{item.product_id}</div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-sm font-semibold text-gray-900 mb-1">
                                {formatPrice(item.price * item.quantity)}
                              </div>
                              <div className="text-xs text-gray-600">{item.quantity} шт. × {formatPrice(item.price)}</div>
                            </div>
                          </div>
                          <div className="mb-2">
                            <div className="flex items-center gap-1 mb-1">
                              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                              <span className="text-xs text-gray-500">Адрес хранения</span>
                            </div>
                            {(() => {
                              let storageAddress = null;
                              if (item.product_id) {
                                storageAddress = getProductStorageAddressFromItem(item);
                              }
                              if (!storageAddress && !item.product_id) {
                                storageAddress = getProductStorageAddressByBrandPartNumber(item);
                              }
                              return storageAddress ? (
                                <div className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700 border border-gray-200">
                                  {storageAddress}
                                </div>
                              ) : (
                                <div className="text-gray-400 italic text-xs">Не указан</div>
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
                      ))
                    )}
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
