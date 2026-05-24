import React from 'react';

export default function WarehouseSalesEmptyState({ hasSearch, searchQuery }) {
  return (
    <div className="rounded-2xl border border-dashed border-amber-200 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">
        {hasSearch ? 'Ничего не найдено' : 'Продаж пока нет'}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
        {hasSearch
          ? `По запросу «${searchQuery}» записей нет. Измените поиск или сбросьте фильтр источника.`
          : 'Здесь появятся фактические продажи: ручные списания из «Мои запчасти», Авито и заказы с сайта после проводки склада.'}
      </p>
    </div>
  );
}
