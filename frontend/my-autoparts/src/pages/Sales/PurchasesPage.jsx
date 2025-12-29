import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import PurchasesOrdersTab from './PurchasesOrdersTab';
import PurchasesReturnsTab from './PurchasesReturnsTab';

export default function PurchasesPage() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState('orders');

  // Проверка авторизации - доступно всем зарегистрированным пользователям
  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Если пользователь не авторизован, не показываем страницу
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Доступ запрещен</h2>
          <p className="text-gray-600">Необходимо войти в систему</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'orders', label: 'Заказы', component: PurchasesOrdersTab },
    { id: 'returns', label: 'Возвраты', component: PurchasesReturnsTab },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="mt-5">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Покупки</h1>
        <p className="mt-2 text-gray-600">История ваших покупок и возвратов</p>
      </div>

      {/* Переключатель вкладок */}
      <div className="flex gap-4 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === tab.id
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Содержимое вкладки */}
      <div className="mt-8">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
}
