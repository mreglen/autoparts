import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { fetchAvitoChatProductLink } from '../redux/slices/AvitoChatSlice';
import { openOrderItemProductFlow } from '../utils/avitoProductFlow';
import {
  getAvitoBuyerAndDelivery,
  getAvitoDisplayTotal,
  getAvitoLineItemQty,
  getAvitoLineItemTitle,
  getAvitoLineItemTotal,
  getAvitoMobileDeliveryText,
  getAvitoOrderChatId,
  getAvitoOrderItems,
} from '../pages/Sales/avitoOrderDisplay';
import OrderSourceBadge from './Orders/OrderSourceBadge';
import OrderWriteMessageButton from './OrderWriteMessageButton/OrderWriteMessageButton';

function DeliveryIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  );
}

function UserIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

/**
 * Карточка заказа Авито (вкладка «Авито» на /sales/orders).
 */
export function AvitoOrderCard({
  order,
  isExpanded,
  onToggle,
  editingStatus,
  onEditStatus,
  onAvitoTransition,
  transitionLoadingByOrderId,
  warehouseRetryLoadingByOrderId,
  onRetryWarehouse,
  getAvitoTransitionOptions,
  getAvitoTransitionLabel,
  getAvitoStatusColor,
  getAvitoStatusName,
  formatDate,
  formatPrice,
  getAvitoWarehouseMismatch,
  getAvitoWarehouseCanRetry,
  getAvitoSkipReasonsForDisplay,
}) {
  const { delivery, buyerName, buyerPhone } = getAvitoBuyerAndDelivery(order);
  const avitoData = order.avito_data || {};
  const schedules = avitoData.schedules || {};
  const prices = avitoData.prices || {};
  const items = getAvitoOrderItems(order);
  const deliveryDateMin = schedules.deliveryDateMin;
  const deliveryDateMax = schedules.deliveryDateMax || schedules.deliveryDateMaх;
  const avitoCommission = Number(prices.commission || 0);
  const avitoTotal = getAvitoDisplayTotal(order);
  const deliveryText = getAvitoMobileDeliveryText(delivery);
  const isEditing = editingStatus?.type === 'avito' && editingStatus?.id === order.id;
  const transitionOptions = getAvitoTransitionOptions(order);
  const availableActions = Array.isArray(avitoData.availableActions) ? avitoData.availableActions : [];
  const hasWarehouseMismatch = getAvitoWarehouseMismatch?.(order);
  const skipReasons = getAvitoSkipReasonsForDisplay?.(order) || [];

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleProductClick = async (item, e) => {
    e?.stopPropagation?.();
    await openOrderItemProductFlow({
      item,
      orderType: 'avito',
      order,
      dispatch,
      navigate,
      fetchLinkThunk: fetchAvitoChatProductLink,
      destination: 'seller',
    });
  };

  const expandedLabel = items.length > 0
    ? `Состав заказа · ${items.length} ${items.length === 1 ? 'позиция' : items.length < 5 ? 'позиции' : 'позиций'}`
    : 'Детали заказа';

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
        isExpanded
          ? 'border-teal-200 shadow-md ring-1 ring-teal-100'
          : 'border-gray-200/80 hover:border-teal-200/60 hover:shadow'
      }`}
    >
      <div className="border-b border-gray-100 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1 ring-1 ring-gray-100">
                <OrderSourceBadge source="avito" size="sm" />
                <span className="text-xs font-semibold text-gray-800">
                  #{order.avito_order_id || order.id}
                </span>
              </span>
              <span className="text-sm text-gray-500">{formatDate(order.created_at)}</span>
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <UserIcon className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="truncate">{buyerName}</span>
              </h3>
              <p className="mt-1 break-all pl-6 text-sm text-gray-600">
                {buyerPhone && buyerPhone !== 'Не указан' ? (
                  <a
                    href={`tel:${buyerPhone.replace(/[^\d+]/g, '')}`}
                    className="hover:text-teal-700 hover:underline"
                  >
                    {buyerPhone}
                  </a>
                ) : (
                  buyerPhone
                )}
              </p>
              <p className="mt-2 flex items-start gap-2 pl-6 text-sm text-gray-600 sm:pl-6">
                <DeliveryIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                <span className="line-clamp-2">{deliveryText}</span>
              </p>
              {deliveryDateMin && (
                <p className="mt-1 pl-6 text-xs text-gray-500 sm:pl-6">
                  Срок доставки: {formatDate(deliveryDateMin)}
                  {deliveryDateMax ? ` — ${formatDate(deliveryDateMax)}` : ''}
                </p>
              )}
              <div className="mt-2 pl-6">
                <OrderWriteMessageButton
                  label="Написать покупателю"
                  avitoChatId={getAvitoOrderChatId(order)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 lg:flex-col lg:items-end">
            <div className="text-left lg:text-right">
              <div className="text-xs font-medium text-gray-500">Сумма заказа</div>
              <div className="text-xl font-bold tabular-nums text-gray-900">{formatPrice(avitoTotal)}</div>
              {avitoCommission > 0 && (
                <div className="text-xs text-gray-500">Комиссия {formatPrice(avitoCommission)}</div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                  order.is_paid
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'
                    : 'bg-amber-50 text-amber-800 ring-1 ring-amber-100'
                }`}
              >
                {order.is_paid ? 'Оплачен' : 'Не оплачен'}
              </span>

              {isEditing ? (
                <select
                  value=""
                  onChange={(e) => onAvitoTransition(order, e.target.value)}
                  onBlur={() => onEditStatus(null)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={Boolean(transitionLoadingByOrderId?.[order.id]) || transitionOptions.length === 0}
                  className="max-w-[12rem] min-h-11 rounded-lg border border-gray-300 bg-white px-2 text-sm font-medium focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  autoFocus
                >
                  <option value="" disabled>
                    {transitionLoadingByOrderId?.[order.id] ? 'Выполняем…' : 'Действие'}
                  </option>
                  {transitionOptions.map((transition) => (
                    <option key={transition} value={transition}>
                      {getAvitoTransitionLabel(transition)}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (transitionOptions.length === 0) {
                      await onEditStatus({ type: 'avito', id: order.id, fetchTransitions: true });
                    } else {
                      onEditStatus({ type: 'avito', id: order.id });
                    }
                  }}
                  disabled={Boolean(transitionLoadingByOrderId?.[order.id])}
                  className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium transition hover:opacity-90 disabled:opacity-60 ${getAvitoStatusColor(order.avito_status_code)}`}
                  title="Изменить статус"
                >
                  {transitionLoadingByOrderId?.[order.id]
                    ? 'Обновление…'
                    : getAvitoStatusName(order.avito_status_code, order)}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {hasWarehouseMismatch && (
        <div className="border-b border-amber-100 bg-amber-50/90 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                Заказ закрыт на Авито, склад не проведён полностью
              </p>
              {skipReasons.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-amber-800">
                  {skipReasons.map((reason, idx) => (
                    <li key={`${reason.code}-${idx}`} className="flex gap-2">
                      <span className="text-amber-500" aria-hidden>•</span>
                      <span>{reason.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {getAvitoWarehouseCanRetry?.(order) && onRetryWarehouse && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetryWarehouse(order);
                }}
                disabled={Boolean(warehouseRetryLoadingByOrderId?.[order.id])}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-amber-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
              >
                {warehouseRetryLoadingByOrderId?.[order.id]
                  ? 'Проводим склад…'
                  : 'Повторить проводку'}
              </button>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onToggle(order.id)}
        className="flex w-full items-center justify-between bg-teal-50/50 px-4 py-3 text-left sm:px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-medium text-teal-800">
          {isExpanded ? 'Скрыть детали' : expandedLabel}
        </span>
        <svg
          className={`h-5 w-5 text-teal-700 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gradient-to-b from-gray-50/80 to-white px-4 py-4 sm:px-5">
          {items.length > 0 ? (
            <ul className="space-y-3">
              {items.map((item, index) => {
                const qty = getAvitoLineItemQty(item);
                const unitPrice = Number(item.prices?.price ?? item.price ?? 0);
                const lineTotal = getAvitoLineItemTotal(item);
                const title = getAvitoLineItemTitle(item);

                return (
                  <li
                    key={item.avitoId || item.id || index}
                    className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        {item.product_id && (
                          <span className="mb-2 inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 ring-1 ring-teal-100">
                            Каталог · #{item.product_id}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleProductClick(item, e)}
                          className="text-left text-sm font-medium text-gray-900 hover:text-teal-700 hover:underline"
                        >
                          {title}
                        </button>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          {item.location && <span>{item.location}</span>}
                          {item.chatId && (
                            <span className="font-mono text-gray-400">Чат {String(item.chatId).slice(0, 12)}…</span>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          {qty} шт. × {formatPrice(unitPrice)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                        <div className="text-base font-semibold tabular-nums text-gray-900">
                          {formatPrice(lineTotal)}
                        </div>
                        {item.prices?.commission > 0 && (
                          <div className="text-xs text-gray-500">
                            Комиссия {formatPrice(item.prices.commission)}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-gray-500">Позиции в заказе не найдены</p>
          )}

          {availableActions.length > 0 && (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Действия на Авито
              </h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {availableActions.map((action, index) => (
                  <span
                    key={action.name || index}
                    className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium ${
                      action.required
                        ? 'bg-red-50 text-red-800 ring-1 ring-red-100'
                        : 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'
                    }`}
                  >
                    {action.name}
                    {action.required && (
                      <span className="ml-1 text-red-600" title="Обязательно">
                        *
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
