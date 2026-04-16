import React from 'react';
import { useSearchParams } from 'react-router-dom';

const DEFAULT_AVITO_URL = 'https://www.avito.ru';

const ProductNotFound = () => {
  const [searchParams] = useSearchParams();
  const avitoUrlFromQuery = searchParams.get('avitoUrl');
  const avitoId = searchParams.get('avitoId');
  const title = searchParams.get('title');

  const resolvedAvitoUrl = avitoUrlFromQuery
    || (avitoId ? `https://www.avito.ru/items/${encodeURIComponent(avitoId)}` : DEFAULT_AVITO_URL);

  const handleGoToAvito = () => {
    // Открываем Avito в новой вкладке
    window.open(resolvedAvitoUrl, '_blank', 'noopener,noreferrer');
    // Закрываем текущую вкладку
    window.close();
  };

  const handleCancel = () => {
    // Закрываем текущую вкладку
    window.close();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Товар не найден</h2>
          <p className="text-gray-600">
            Извините, но такого товара нет на сайте. Вы уверены, что хотите перейти?
          </p>
          {title && (
            <p className="text-sm text-gray-500 mt-3">
              Товар: <span className="font-medium text-gray-700">{title}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleGoToAvito}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
          >
            Да, перейти на Avito
          </button>
          <button
            onClick={handleCancel}
            className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium"
          >
            Нет, не хочу
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
          Эта вкладка закроется после вашего выбора
        </p>
      </div>
    </div>
  );
};

export default ProductNotFound;
