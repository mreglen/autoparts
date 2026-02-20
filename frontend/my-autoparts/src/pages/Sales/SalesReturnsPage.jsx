import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

export default function SalesReturnsPage() {
  const navigate = useNavigate();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const [authChecked, setAuthChecked] = useState(false);

  // Check if user has permission to view this page
  // Admin and sellers always have access
  // Employees need 'sales.returns' permission code
  const hasPermission = user?.is_admin || user?.is_seller || 
    (user?.is_employee && permissionCodes && permissionCodes.includes('sales.returns'));

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

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Возвраты покупателей</h1>
        <p className="mt-2 text-gray-600 text-base sm:text-base">Управление возвратами товаров</p>
      </div>

      <div className="text-center py-16 px-6">
        <div className="bg-gray-100 rounded-full w-20 h-20 md:w-24 md:h-24 mx-auto mb-6 flex items-center justify-center">
          <svg className="h-10 w-10 md:h-12 md:w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
        </div>
        <h2 className="text-xl md:text-2xl font-medium text-gray-900 mb-2">Возвраты покупателей</h2>
        <p className="text-gray-500 text-base">Функционал возвратов находится в разработке</p>
      </div>
    </div>
  );
}
