import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import {
  fetchRosskoOrders,
  fetchDatabaseOrders,
  selectRosskoOrders,
  selectRosskoOrdersStatus,
  selectRosskoOrdersError,
  selectDatabaseOrders,
  selectDatabaseOrdersStatus,
  selectDatabaseOrdersError
} from '../../redux/slices/RosskoSlice';

export default function RosskoOrdersTab() {
  const dispatch = useDispatch();
  const rosskoOrders = useSelector(selectRosskoOrders);
  const rosskoOrdersLoading = useSelector(selectRosskoOrdersStatus) === 'loading';
  const rosskoOrdersError = useSelector(selectRosskoOrdersError);
  const databaseOrders = useSelector(selectDatabaseOrders);
  const databaseOrdersLoading = useSelector(selectDatabaseOrdersStatus) === 'loading';
  const databaseOrdersError = useSelector(selectDatabaseOrdersError);

  // Активная вкладка
  const [activeTab, setActiveTab] = useState('rossko_orders');

  // Фильтры и пагинация
  const [filters, setFilters] = useState({
    limit: 50,
    start_date: null,
    end_date: null,
    type: null
  });

  useEffect(() => {
    if (activeTab === 'rossko_orders') {
      fetchRosskoOrdersList();
    } else if (activeTab === 'checkout_orders') {
      fetchDatabaseOrdersList();
    }
  }, [filters, activeTab]);

  // Проверка прав администратора (после всех хуков)
  const user = useSelector((state) => state.auth.user);
  if (!user || !user.is_admin) {
    return <Navigate to="/" replace />;
  }

  const fetchRosskoOrdersList = () => {
    // Убираем пустые значения из фильтров
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== null && value !== '')
    );

    dispatch(fetchRosskoOrders(cleanFilters));
  };

  const fetchDatabaseOrdersList = () => {
    // Для заказов из базы данных используем параметры пагинации
    const params = {
      skip: 0,
      limit: filters.limit
    };

    dispatch(fetchDatabaseOrders(params));
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Функция для получения названия статуса росско
  const getRosskoStatusName = (statusCode) => {
    const statusMap = {
      0: 'Ждёт подтверждения',
      1: 'Комплектуется',
      2: 'Отгружено',
      3: 'Готово к отгрузке',
      5: 'Ожидаем поступление',
      6: 'На складе филиала',
      7: 'Нет в наличии',
      8: 'Отменён клиентом',
      9: 'Просрочен',
      31: 'Ожидаем товар на складе',
      32: 'Возврат на согласовании',
      33: 'Товар на экспертизе',
      34: 'Возврат отклонён',
      35: 'Возврат частично отклонён',
      36: 'Товар возвращён'
    };
    return statusMap[statusCode] || `Статус ${statusCode}`;
  };

  // Функция для получения цвета статуса росско
  const getRosskoStatusColor = (statusCode) => {
    const colorMap = {
      0: 'bg-yellow-100 text-yellow-800', // Ждёт подтверждения
      1: 'bg-blue-100 text-blue-800',    // Комплектуется
      2: 'bg-purple-100 text-purple-800',  // Отгружено
      3: 'bg-green-100 text-green-800',   // Готово к отгрузке
      5: 'bg-orange-100 text-orange-800', // Ожидаем поступление
      6: 'bg-indigo-100 text-indigo-800',  // На складе филиала
      7: 'bg-red-100 text-red-800',       // Нет в наличии
      8: 'bg-gray-100 text-gray-800',      // Отменён клиентом
      9: 'bg-red-200 text-red-900',        // Просрочен
      31: 'bg-cyan-100 text-cyan-800',     // Ожидаем товар на складе
      32: 'bg-amber-100 text-amber-800',   // Возврат на согласовании
      33: 'bg-lime-100 text-lime-800',     // Товар на экспертизе
      34: 'bg-red-200 text-red-900',       // Возврат отклонён
      35: 'bg-pink-100 text-pink-800',     // Возврат частично отклонён
      36: 'bg-emerald-100 text-emerald-800' // Товар возвращён
    };
    return colorMap[statusCode] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указана';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU');
    } catch (error) {
      return 'Не указана';
    }
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '0 ₽';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(price);
  };

  // Определяем текущие данные и состояние в зависимости от активной вкладки
  const orders = activeTab === 'rossko_orders' ? rosskoOrders : databaseOrders;
  const loading = activeTab === 'rossko_orders' ? rosskoOrdersLoading : databaseOrdersLoading;
  const error = activeTab === 'rossko_orders' ? rosskoOrdersError : databaseOrdersError;

  if (loading) {
    return (
      <div className="text-center py-16 px-6">
        <div className="bg-gray-100 rounded-full w-20 h-20 md:w-24 md:h-24 mx-auto mb-6 flex items-center justify-center">
          <svg className="animate-spin h-10 w-10 md:h-12 md:w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <h2 className="text-xl md:text-2xl font-medium text-gray-900 mb-2">Загрузка заказов...</h2>
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
        <h2 className="text-xl md:text-2xl font-medium text-gray-900 mb-2">Ошибка загрузки заказов</h2>
        <p className="text-gray-500 mb-6 text-base">{error}</p>
        <button
          onClick={() => {
            if (activeTab === 'rossko_orders') {
              fetchRosskoOrdersList();
            } else {
              fetchDatabaseOrdersList();
            }
          }}
          className="inline-flex items-center px-5 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 min-h-[48px]"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow-sm rounded-lg p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Заказы Росско</h2>

        {/* Вкладки для разных источников заказов - мобильная версия */}
        <div className="md:hidden mb-6">
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setActiveTab('rossko_orders')}
              className={`px-4 py-3 rounded-lg font-medium text-base transition-colors min-h-[48px] ${
                activeTab === 'rossko_orders'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Заказы из Росско API
            </button>
            <button
              onClick={() => setActiveTab('checkout_orders')}
              className={`px-4 py-3 rounded-lg font-medium text-base transition-colors min-h-[48px] ${
                activeTab === 'checkout_orders'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Заказы из корзины
            </button>
          </div>
        </div>

        {/* Вкладки для разных источников заказов - десктопная версия */}
        <div className="hidden md:block border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('rossko_orders')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'rossko_orders'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Заказы из Росско API
            </button>
            <button
              onClick={() => setActiveTab('checkout_orders')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'checkout_orders'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Заказы из корзины (новые запчасти)
            </button>
          </nav>
        </div>

        {/* Фильтры - мобильная версия */}
        <div className="md:hidden space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="limit_mobile" className="block text-sm font-medium text-gray-700 mb-1">
                Лимит
              </label>
              <select
                id="limit_mobile"
                value={filters.limit}
                onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div>
              <label htmlFor="type_mobile" className="block text-sm font-medium text-gray-700 mb-1">
                Тип
              </label>
              <select
                id="type_mobile"
                value={filters.type || ''}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base"
              >
                <option value="">Все</option>
                <option value={1}>Тип 1</option>
                <option value={2}>Тип 2</option>
                <option value={3}>Тип 3</option>
                <option value={4}>Тип 4</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start_date_mobile" className="block text-sm font-medium text-gray-700 mb-1">
                Дата начала
              </label>
              <input
                type="date"
                id="start_date_mobile"
                value={filters.start_date || ''}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base"
              />
            </div>

            <div>
              <label htmlFor="end_date_mobile" className="block text-sm font-medium text-gray-700 mb-1">
                Дата окончания
              </label>
              <input
                type="date"
                id="end_date_mobile"
                value={filters.end_date || ''}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base"
              />
            </div>
          </div>
        </div>

        {/* Фильтры - десктопная версия */}
        <div className="hidden md:grid md:grid-cols-4 gap-4 mb-6">
          <div>
            <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-1">
              Лимит записей
            </label>
            <select
              id="limit"
              value={filters.limit}
              onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
              Дата начала
            </label>
            <input
              type="date"
              id="start_date"
              value={filters.start_date || ''}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
              Дата окончания
            </label>
            <input
              type="date"
              id="end_date"
              value={filters.end_date || ''}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Тип заказа
            </label>
            <select
              id="type"
              value={filters.type || ''}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Все</option>
              <option value={1}>Тип 1</option>
              <option value={2}>Тип 2</option>
              <option value={3}>Тип 3</option>
              <option value={4}>Тип 4</option>
            </select>
          </div>
        </div>
      </div>

      {/* Десктопная версия - таблица */}
      <div className="hidden md:block bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-[10%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Номер заказа
                </th>
                <th className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата создания
                </th>
                <th className="w-[20%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Клиент
                </th>
                <th className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Телефон
                </th>
                <th className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сумма
                </th>
                <th className="w-[10%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Тип
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeTab === 'rossko_orders' ? (
                // Отображение заказов из Росско API
                orders && orders.Orders && orders.Orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.order_number || order.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(order.created_at || order.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.customer_name || order.contact?.name || 'Не указан'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.customer_phone || order.contact?.phone || 'Не указан'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRosskoStatusColor(order.status)}`}>
                        {getRosskoStatusName(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPrice(order.total_amount || order.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.type || 'Росско'}
                    </td>
                  </tr>
                ))
              ) : (
                // Отображение заказов из базы данных (новые запчасти)
                orders && orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.order_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.recipient_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.recipient_phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.status?.code === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status?.code === 'confirmed' ? 'bg-green-100 text-green-800' :
                        order.status?.code === 'delivered' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status?.name || 'Неизвестен'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPrice(order.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.new_parts_order?.seller || 'Новые запчасти'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {(!orders || (activeTab === 'rossko_orders' ? (!orders.Orders || orders.Orders.length === 0) : orders.length === 0)) && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Заказов нет</h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeTab === 'rossko_orders'
                ? 'Здесь будут отображаться заказы из системы Росско'
                : 'Здесь будут отображаться заказы из корзины (новые запчасти)'}
            </p>
          </div>
        )}
      </div>

      {/* Мобильная версия - карточки */}
      <div className="md:hidden space-y-5">
        {activeTab === 'rossko_orders' ? (
          // Мобильные карточки для заказов из Росско API
          orders && orders.Orders && orders.Orders.map((order) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base font-semibold text-gray-900">Заказ #{order.order_number || order.id}</span>
                    <span className="text-sm text-gray-400">•</span>
                    <span className="text-sm text-gray-500">{order.type || 'Росско'}</span>
                  </div>
                  <div className="text-base text-gray-800 mb-1">{order.customer_name || order.contact?.name || 'Не указан'}</div>
                  <div className="text-sm text-gray-600 mb-3">{order.customer_phone || order.contact?.phone || 'Не указан'}</div>
                  <div className="text-sm text-gray-600">{formatDate(order.created_at || order.date)}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-gray-900 mb-2">
                    {formatPrice(order.total_amount || order.amount)}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full self-end ${getRosskoStatusColor(order.status)}`}>
                      {getRosskoStatusName(order.status)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          // Мобильные карточки для заказов из базы данных
          orders && orders.map((order) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base font-semibold text-gray-900">Заказ #{order.order_number}</span>
                    <span className="text-sm text-gray-400">•</span>
                    <span className="text-sm text-gray-500">{order.new_parts_order?.seller || 'Новые запчасти'}</span>
                  </div>
                  <div className="text-base text-gray-800 mb-1">{order.recipient_name}</div>
                  <div className="text-sm text-gray-600 mb-3">{order.recipient_phone}</div>
                  <div className="text-sm text-gray-600">{formatDate(order.created_at)}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-gray-900 mb-2">
                    {formatPrice(order.total_amount)}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full self-end ${
                      order.status?.code === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      order.status?.code === 'confirmed' ? 'bg-green-100 text-green-800' :
                      order.status?.code === 'delivered' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status?.name || 'Неизвестен'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {(!orders || (activeTab === 'rossko_orders' ? (!orders.Orders || orders.Orders.length === 0) : orders.length === 0)) && (
          <div className="text-center py-16 px-6">
            <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Заказов нет</h2>
            <p className="text-gray-600 text-base">
              {activeTab === 'rossko_orders'
                ? 'Здесь будут отображаться заказы из системы Росско'
                : 'Здесь будут отображаться заказы из корзины (новые запчасти)'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
