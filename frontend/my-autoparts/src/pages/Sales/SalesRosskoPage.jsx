import React from 'react';
import { useSelector } from 'react-redux';
import RosskoOrdersTab from './RosskoOrdersTab';

export default function SalesRosskoPage() {
  const { user } = useSelector((state) => state.auth);

  // Если пользователь не админ, не показываем страницу
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

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Росско</h1>
        <p className="mt-2 text-gray-600 text-base sm:text-base">Заказы из системы Росско</p>
      </div>

      <RosskoOrdersTab />
    </div>
  );
}