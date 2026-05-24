import React from 'react';

export default function SalesOrdersEmptyState({ tabLabel, variant = 'default' }) {
  const isAvito = variant === 'avito';

  return (
    <div
      className={`rounded-2xl border border-dashed bg-white px-6 py-14 text-center shadow-sm ${
        isAvito ? 'border-teal-200' : 'border-gray-300'
      }`}
    >
      <div
        className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${
          isAvito ? 'bg-teal-50 text-teal-700' : 'bg-indigo-50 text-indigo-600'
        }`}
      >
        {isAvito ? (
          <span className="text-2xl font-bold">A</span>
        ) : (
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        )}
      </div>
      <h3 className="text-lg font-semibold text-gray-900">Заказов пока нет</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
        {isAvito
          ? 'Заказы с Авито появятся здесь после синхронизации. Нажмите «Обновить», чтобы подтянуть новые.'
          : `Вкладка «${tabLabel}» пуста. Новые заказы появятся здесь после оформления покупателями.`}
      </p>
    </div>
  );
}
