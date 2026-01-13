import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [stats, setStats] = useState({
    activeOrders: 0,
    totalProducts: 0,
    totalSales: 0,
    newOrders: 0,
    pendingOrders: 0,
    completedOrders: 0
  });
  const [loading, setLoading] = useState(true);

  // Проверка прав продавца
  useEffect(() => {
    if (!user?.is_seller) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user?.is_seller) {
      fetchDashboardStats();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Получаем статистику заказов
      const ordersResponse = await apiAxios.get('/orders/');
      const orders = ordersResponse.data;

      // Фильтруем заказы по организации продавца
      const filteredOrders = orders.filter(order => {
        // Заказы из новых автозапчастей фильтруем по организации
        if (order.new_parts_order) {
          return user?.is_admin;
        }
        // Для обычных заказов проверяем связь с организацией
        return order.organization_id === user.organization_id || !order.organization_id;
      });

      // Фильтруем заказы: заказы из новых автозапчастей показываем только админам
      const finalOrders = user?.is_admin
        ? filteredOrders
        : filteredOrders.filter(order => !order.new_parts_order);

      // Активные заказы (не закрытые и не отмененные)
      const activeOrders = finalOrders.filter(order =>
        !['closed', 'cancelled'].includes(order.status.code)
      );

      // Новые заказы (за последние 7 дней)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const newOrders = finalOrders.filter(order =>
        new Date(order.created_at) > sevenDaysAgo
      );

      // Ожидающие заказы
      const pendingOrders = finalOrders.filter(order =>
        order.status.code === 'pending'
      );

      // Завершенные заказы
      const completedOrders = finalOrders.filter(order =>
        ['delivered', 'closed'].includes(order.status.code)
      );

      // Получаем товары организации
      let totalProducts = 0;
      try {
        const productsResponse = await apiAxios.get('/products/');
        totalProducts = productsResponse.data.length;
      } catch (error) {
        console.log('Products endpoint not available');
      }

      // Рассчитываем общую сумму продаж
      const totalSales = completedOrders.reduce((sum, order) =>
        sum + parseFloat(order.total_amount || 0), 0
      );

      setStats({
        activeOrders: activeOrders.length,
        totalProducts,
        totalSales,
        newOrders: newOrders.length,
        pendingOrders: pendingOrders.length,
        completedOrders: completedOrders.length
      });
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  // Если пользователь не продавец, не показываем страницу
  if (!user?.is_seller) {
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
      <div className="mt-4 sm:mt-5 px-4 sm:px-0">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Главная</h1>
          <p className="mt-2 text-gray-600 text-base sm:text-base">Общая информация о вашем бизнесе</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <div className="animate-pulse">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg mr-4"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Главная</h1>
        <p className="mt-2 text-gray-600 text-base sm:text-base">Общая информация о вашем бизнесе</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Активные заказы */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg mr-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Активные заказы</p>
              <p className="text-3xl font-bold text-gray-900">{stats.activeOrders}</p>
              <p className="text-sm text-gray-500 mt-1">В обработке</p>
            </div>
          </div>
        </div>

        {/* Ожидающие заказы */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg mr-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Ожидают обработки</p>
              <p className="text-3xl font-bold text-gray-900">{stats.pendingOrders}</p>
              <p className="text-sm text-gray-500 mt-1">Новые заказы</p>
            </div>
          </div>
        </div>

        {/* Новые заказы за неделю */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg mr-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Новые заказы</p>
              <p className="text-3xl font-bold text-gray-900">{stats.newOrders}</p>
              <p className="text-sm text-gray-500 mt-1">За 7 дней</p>
            </div>
          </div>
        </div>

        {/* Завершенные заказы */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-indigo-100 rounded-lg mr-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Завершенные заказы</p>
              <p className="text-3xl font-bold text-gray-900">{stats.completedOrders}</p>
              <p className="text-sm text-gray-500 mt-1">Выполненные</p>
            </div>
          </div>
        </div>

        {/* Общее количество товаров */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg mr-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Мои товары</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
              <p className="text-sm text-gray-500 mt-1">На складе</p>
            </div>
          </div>
        </div>

        {/* Общая сумма продаж */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg mr-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Общая сумма продаж</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.totalSales)}</p>
              <p className="text-sm text-gray-500 mt-1">Выполненные заказы</p>
            </div>
          </div>
        </div>
      </div>

      {/* Кнопка обновления данных */}
      <div className="mt-8 text-center">
        <button
          onClick={fetchDashboardStats}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Обновить данные
        </button>
      </div>
    </div>
  );
}

