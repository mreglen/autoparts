import React from 'react';
import OrderSourceBadge from '../Orders/OrderSourceBadge';

export default function SalesOrdersEmptyState({ hasAnyOrders = false }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto mb-5 flex items-center justify-center gap-3">
        <OrderSourceBadge source="used" size="md" />
        <OrderSourceBadge source="new" size="md" />
        <OrderSourceBadge source="avito" size="md" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">
        {hasAnyOrders ? 'Ничего не найдено' : 'Заказов пока нет'}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
        {hasAnyOrders
          ? 'Измените поиск или фильтр статуса — в списке ниже отображаются все заказы: б/у, Rossko и Авито.'
          : 'Заказы появятся здесь после оформления. Нажмите «Обновить», чтобы подтянуть данные с Авито.'}
      </p>
    </div>
  );
}
