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
    totalWarehouseValue: 0,
    totalWarehouseQuantity: 0,
    totalSales: 0,
    newOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    warehouseSalesCount: 0
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
      let totalWarehouseValue = 0;
      let totalWarehouseQuantity = 0;
      try {
        const productsResponse = await apiAxios.get('/products/');
        const products = productsResponse.data;
        totalProducts = products.length;
        totalWarehouseValue = products.reduce((sum, part) => sum + ((part.price || 0) * (part.quantity || 0)), 0);
        totalWarehouseQuantity = products.reduce((sum, part) => sum + (part.quantity || 0), 0);
      } catch (error) {
        console.log('Products endpoint not available');
      }

      // Получаем продажи со склада
      let warehouseSalesCount = 0;
      let warehouseSalesAmount = 0;
      try {
        const warehouseSalesResponse = await apiAxios.get('/stock-outs/sales');
        const warehouseSales = warehouseSalesResponse.data;
        warehouseSalesCount = warehouseSales.length;
        // Рассчитываем общую сумму продаж со склада
        warehouseSalesAmount = warehouseSales.reduce((sum, sale) => 
          sum + (parseFloat(sale.sale_price || 0) * parseInt(sale.quantity || 0)), 0
        );
      } catch (error) {
        console.log('Warehouse sales endpoint not available');
      }

      setStats({
        activeOrders: activeOrders.length,
        totalProducts,
        totalWarehouseValue,
        totalWarehouseQuantity,
        totalSales: warehouseSalesAmount,
        newOrders: newOrders.length,
        pendingOrders: pendingOrders.length,
        completedOrders: completedOrders.length,
        warehouseSalesCount
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
        {/* Панель заказов */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Статистика заказов</h3>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs font-medium text-blue-600 uppercase mb-1">Активные</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeOrders}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-100">
              <p className="text-xs font-medium text-yellow-600 uppercase mb-1">Ожидают</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingOrders}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-xl border border-green-100">
              <p className="text-xs font-medium text-green-600 uppercase mb-1">Новые</p>
              <p className="text-2xl font-bold text-gray-900">{stats.newOrders}</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
              <p className="text-xs font-medium text-indigo-600 uppercase mb-1">Завершенные</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completedOrders}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
              <p className="text-xs font-medium text-purple-600 uppercase mb-1">Продажи</p>
              <p className="text-2xl font-bold text-gray-900">{stats.warehouseSalesCount}</p>
            </div>
          </div>
        </div>

        {/* Общая сумма продаж */}
        <div className="lg:col-span-1 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow text-white">
          <div className="flex items-center mb-4">
            <div className="p-3 bg-white bg-opacity-20 rounded-lg mr-4 text-white">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <p className="text-sm font-medium text-indigo-100">Общая сумма продаж</p>
          </div>
          <p className="text-3xl font-bold leading-tight">{formatCurrency(stats.totalSales)}</p>
          <div className="mt-4 pt-4 border-t border-indigo-500 border-opacity-30">
            <p className="text-sm text-indigo-100 opacity-80">За всё время работы</p>
          </div>
        </div>

        {/* Складской обзор */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Обзор склада</h3>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="p-3 bg-white rounded-lg shadow-sm mr-4 text-emerald-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-700">Стоимость товаров</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalWarehouseValue.toLocaleString('ru-RU')} ₽</p>
              </div>
            </div>
            <div className="flex items-center p-4 bg-orange-50 rounded-xl border border-orange-100">
              <div className="p-3 bg-white rounded-lg shadow-sm mr-4 text-orange-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-orange-700">Общее количество</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalWarehouseQuantity.toLocaleString('ru-RU')} шт.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Виды товаров */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex flex-col h-full justify-between">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-purple-100 rounded-lg mr-4 text-purple-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Номенклатура</p>
                <p className="text-xs text-gray-400">Уникальных позиций</p>
              </div>
            </div>
            <div className="mt-auto">
              <p className="text-4xl font-black text-gray-900">{stats.totalProducts}</p>
              <p className="text-sm text-gray-500 mt-2">Наименований запчастей</p>
            </div>
          </div>
        </div>
      </div>

      {/* Кнопка обновления данных была убрана */}
    </div>
  );
}

