import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import OrderWriteMessageButton from '../OrderWriteMessageButton/OrderWriteMessageButton';
import { canLinkGarageOrderItem } from '../../utils/partRoutes';

function NewPartsTypeBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800 ring-1 ring-sky-100 ${className}`}
    >
      NEW
    </span>
  );
}

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
  ready_for_pickup: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
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
  new_ready_for_pickup: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
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
  getBuyerHint,
  getDeliveryInfo,
  onProductClick,
  onReturnRequest,
  canRequestReturn,
}) {
  const items = order.items || [];
  const isUsed = orderType === 'used';
  const fallbackProductId = useMemo(() => {
    const itemWithProduct = items.find((item) => item.product_id);
    return itemWithProduct?.product_id ?? null;
  }, [items]);
  const sellerLabel = order.organization_name
    || (isUsed ? 'Продавец не указан' : 'Новые запчасти от поставщика');
  const statusCode = order.status_code || 'pending';
  const statusIcon = STATUS_ICONS[statusCode] || STATUS_ICONS.pending;
  const buyerHint = getBuyerHint ? getBuyerHint(statusCode) : null;
  const pickupCode = order.pickup_code;
  const pickupQr = order.pickup_qr_payload;
  const showPickupCode =
    Boolean(pickupCode) &&
    (statusCode === 'ready_for_pickup' || statusCode === 'new_ready_for_pickup');

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
        isExpanded ? 'border-indigo-200 shadow-md ring-1 ring-indigo-100' : 'border-gray-200/80 hover:border-gray-300 hover:shadow'
      }`}
    >
      {/* Шапка заказа — div, чтобы вложенные кнопки работали корректно */}
      <div className="border-b border-gray-100 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {isUsed ? (
                <span className="inline-flex items-center rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-800 ring-1 ring-gray-100">
                  №{order.id}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1 ring-1 ring-gray-100">
                  <NewPartsTypeBadge />
                  <span className="text-xs font-semibold text-gray-800">№{order.id}</span>
                </span>
              )}
              <span className="text-sm text-gray-500">{formatDate(order.created_at)}</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 truncate">{sellerLabel}</h3>
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">{getDeliveryInfo(order)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <OrderWriteMessageButton
                  label="Написать продавцу"
                  targetUserId={order.seller_user_id}
                  productId={fallbackProductId}
                />
                {canRequestReturn && onReturnRequest ? (
                  <button
                    type="button"
                    onClick={() => onReturnRequest(order)}
                    className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  >
                    Запросить возврат
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-end justify-between gap-4 sm:flex-col sm:items-end">
            <div className="text-left sm:text-right">
              <div className="text-xs text-gray-500">Сумма заказа</div>
              <div className="text-xl font-bold tabular-nums text-gray-900">{formatPrice(order.total_amount)}</div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(statusCode)}`}
              >
                {statusIcon}
                {getStatusName(statusCode)}
              </div>
              {buyerHint ? (
                <p className="max-w-xs text-right text-xs text-gray-500">{buyerHint}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isUsed ? (
            <span className="inline-flex rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-100">
              Оплата при получении
            </span>
          ) : (
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                order.is_paid ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-100'
              }`}
            >
              {order.is_paid ? 'Оплачен' : 'Ожидает оплаты'}
            </span>
          )}
          <span className="text-xs text-gray-500">
            {items.length} {items.length === 1 ? 'позиция' : items.length < 5 ? 'позиции' : 'позиций'}
          </span>
        </div>

        {showPickupCode ? (
          <div className="mt-4 rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Код получения</p>
            <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-3xl font-bold tracking-[0.35em] text-gray-900 tabular-nums sm:text-4xl">
                {String(pickupCode).split('').join('')}
              </p>
              {pickupQr ? (
                <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <QRCodeSVG value={pickupQr} size={128} level="M" includeMargin={false} />
                </div>
              ) : null}
            </div>
            <p className="mt-3 text-center text-xs text-gray-500 sm:text-left">Покажите продавцу</p>
          </div>
        ) : null}
      </div>

      {/* Кнопка раскрытия состава заказа */}
      <button
        type="button"
        onClick={() => onToggle(order.id)}
        className="flex w-full items-center justify-between bg-gray-50/80 px-4 py-3 text-left sm:px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-medium text-indigo-600">
          {isExpanded ? 'Скрыть состав заказа' : `Состав заказа · ${items.length} поз.`}
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
      </button>

      {isExpanded && items.length > 0 && (
        <div className="border-t border-gray-100 bg-gradient-to-b from-gray-50/80 to-white px-4 py-4 sm:px-5">
          {isUsed && order.buyer_comment ? (
            <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700">
              <span className="font-medium text-gray-900">Ваш комментарий: </span>
              {order.buyer_comment}
            </div>
          ) : null}
          <ul className="space-y-3">
            {items.map((item, idx) => {
              const lineTotal = (item.price || 0) * (item.quantity || 0);
              const title = item.name || item.product_name || 'Товар';
              const canLink = canLinkGarageOrderItem(item, orderType);

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
                      {canLink ? (
                        <button
                          type="button"
                          onClick={(e) => onProductClick(item, e, orderType)}
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

export function PurchaseOrdersEmptyState({ hasAnyOrders = false, catalogHref = '/autoparts/used' }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">
        {hasAnyOrders ? 'Нет заказов по выбранным фильтрам' : 'Заказов пока нет'}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
        {hasAnyOrders
          ? 'Попробуйте изменить фильтр статуса или поисковый запрос.'
          : 'После оформления покупки заказ появится здесь — со статусом, доставкой и составом.'}
      </p>
      {!hasAnyOrders && (
        <Link
          to={catalogHref}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Перейти в каталог
        </Link>
      )}
    </div>
  );
}
