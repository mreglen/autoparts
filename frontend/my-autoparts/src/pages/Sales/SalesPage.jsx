import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import OrdersTab from './OrdersTab';
import ReturnsTab from './ReturnsTab';

export default function SalesPage() {
  const navigate = useNavigate();
  const { isReady, user } = useAuthReady();
  const [activeTab, setActiveTab] = useState('orders');

  useEffect(() => {
    if (!isReady) return;
    if (!user?.is_admin) {
      navigate('/', { replace: true });
    }
  }, [isReady, user, navigate]);

  if (!isReady) {
    return null;
  }

  if (!user?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Доступ запрещен</h2>
          <p className="text-gray-600">У вас нет прав для просмотра этой страницы</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'orders', label: 'Заказы покупателей', component: OrdersTab },
    { id: 'returns', label: 'Возвраты покупателей', component: ReturnsTab },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Продажи</h1>
        <p className="mt-2 text-gray-600 text-base sm:text-base">Управление заказами и возвратами</p>
      </div>

      {/* Переключатель вкладок */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-4 sm:px-4 sm:py-2 rounded-lg font-medium text-base sm:text-sm transition-colors min-h-[48px] sm:min-h-0 ${
              activeTab === tab.id
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Содержимое вкладки */}
      <div className="mt-6 sm:mt-8">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
}
