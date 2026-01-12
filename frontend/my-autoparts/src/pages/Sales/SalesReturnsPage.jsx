import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

export default function SalesReturnsPage() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  // Проверка прав администратора или продавца
  React.useEffect(() => {
    if (!user?.is_admin && !user?.is_seller) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Если пользователь не админ и не продавец, не показываем страницу
  if (!user?.is_admin && !user?.is_seller) {
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Возвраты</h1>
        <p className="mt-2 text-gray-600 text-base sm:text-base">Управление возвратами товаров</p>
      </div>

      <div className="text-center py-16 px-6">
        <div className="bg-gray-100 rounded-full w-20 h-20 md:w-24 md:h-24 mx-auto mb-6 flex items-center justify-center">
          <svg className="h-10 w-10 md:h-12 md:w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
        </div>
        <h2 className="text-xl md:text-2xl font-medium text-gray-900 mb-2">Возвраты</h2>
        <p className="text-gray-500 text-base">Функционал возвратов находится в разработке</p>
      </div>
    </div>
  );
}
