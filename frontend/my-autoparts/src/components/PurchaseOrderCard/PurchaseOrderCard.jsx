import React from 'react';
import { Link } from 'react-router-dom';

const STATUS_ICONS = {
  pending: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  confirmed: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  rejected: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  assembled: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  shipped: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0h4m-4 0a2 2 0 104 0m-4 0v-4m8 4V8m0 0l3 3m-3-3l-3 3" />
    </svg>
  ),
  delivered: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  closed: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
    </svg>
  ),

  // Новые запчасти (нормализованные 5 стадий Rossko)
  new_waiting_confirmation: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  new_assembling: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  new_shipped: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0h4m-4 0a2 2 0 104 0m-4 0v-4m8 4V8m0 0l3 3m-3-3l-3 3" />
    </svg>
  ),
  new_awaiting_arrival: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0h4m-4 0a2 2 0 104 0m-4 0v-4m8 4V8m0 0l3 3m-3-3l-3 3" />
    </svg>
  ),
  new_received: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
};

export default function PurchaseOrderCard({
  order,
  orderType = 'used',
  isExpanded,
  onToggle,
  formatDate,
  formatPrice,
  getStatusColor,
  getStatusName,
  getDeliveryInfo,
  onProductClick,
}) {
  const items = order.items || [];
  const isUsed = orderType === 'used';
  const sellerLabel = isUsed
    ? (order.organization_name || 'Продавец не указан')
    : `Заказ новых запчастей №${order.id}`;
  const statusCode = order.status_code || 'pending';
  const statusIcon = STATUS_ICONS[statusCode] || STATUS_ICONS.pending;

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
        isExpanded ? 'border-indigo-200 shadow-md ring-1 ring-indigo-100' : 'border-gray-200/80 hover:border-gray-300 hover:shadow'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(order.id)}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        aria-expanded={isExpanded}
      >
        <div className="border-b border-gray-100 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    isUsed ? 'bg-violet-50 text-violet-800 ring-1 ring-violet-100' : 'bg-sky-50 text-sky-800 ring-1 ring-sky-100'
                  }`}
                >
                  {isUsed ? 'Б/У' : 'Новые'} · #{order.id}
                </span>
                <span className="text-sm text-gray-500">{formatDate(order.created_at)}</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 truncate">{sellerLabel}</h3>
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">{getDeliveryInfo(order)}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-end justify-between gap-4 sm:flex-col sm:items-end">
              <div className="text-left sm:text-right">
                <div className="text-xs text-gray-500">Сумма заказа</div>
                <div className="text-xl font-bold tabular-nums text-gray-900">{formatPrice(order.total_amount)}</div>
              </div>
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(statusCode)}`}
              >
                {statusIcon}
                {getStatusName(statusCode)}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                order.is_paid ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-100'
              }`}
            >
              {order.is_paid ? 'Оплачен' : 'Ожидает оплаты'}
            </span>
            <span className="text-xs text-gray-500">
              {items.length} {items.length === 1 ? 'позиция' : items.length < 5 ? 'позиции' : 'позиций'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 sm:px-5 bg-gray-50/80">
          <span className="text-sm font-medium text-indigo-600">
            {isExpanded ? 'Скрыть состав заказа' : 'Показать состав заказа'}
          </span>
          <svg
            className={`h-5 w-5 text-indigo-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && items.length > 0 && (
        <div className="border-t border-gray-100 bg-gradient-to-b from-gray-50/80 to-white px-4 py-4 sm:px-5">
          <ul className="space-y-3">
            {items.map((item, idx) => {
              const lineTotal = (item.price || 0) * (item.quantity || 0);
              const productId = item.product_id;
              const title = item.name || item.product_name || 'Товар';

              return (
                <li
                  key={item.id || `${order.id}-${idx}`}
                  className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {item.brand && (
                          <span className="font-medium text-gray-700">{item.brand}</span>
                        )}
                        {item.partnumber && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="font-mono">{item.partnumber}</span>
                          </>
                        )}
                      </div>
                      {productId ? (
                        <button
                          type="button"
                          onClick={(e) => onProductClick(item, e)}
                          className="text-left text-sm font-medium text-gray-900 hover:text-indigo-600 hover:underline"
                        >
                          {title}
                        </button>
                      ) : (
                        <p className="text-sm font-medium text-gray-900">{title}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-500">
                        {item.quantity || 0} шт. × {formatPrice(item.price)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <div className="text-base font-semibold tabular-nums text-gray-900">{formatPrice(lineTotal)}</div>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(item.status_code || statusCode)}`}
                      >
                        {getStatusName(item.status_code || statusCode)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {isExpanded && items.length === 0 && (
        <div className="border-t border-gray-100 px-4 py-6 text-center text-sm text-gray-500 sm:px-5">
          В заказе нет позиций
        </div>
      )}
    </article>
  );
}

export function PurchaseOrdersEmptyState({ orderType, catalogHref = '/autoparts/used' }) {
  const isUsed = orderType === 'used';
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">
        {isUsed ? 'Заказов б/у пока нет' : 'Заказов новых запчастей пока нет'}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
        После оформления покупки заказ появится здесь — со статусом, доставкой и составом.
      </p>
      <Link
        to={catalogHref}
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        Перейти в каталог
      </Link>
    </div>
  );
}
