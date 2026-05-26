import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { fetchAvitoChatProductLink } from '../../redux/slices/AvitoChatSlice';
import { openAvitoProductFlow } from '../../utils/avitoProductFlow';
import { getGarageDeliveryInfo } from '../../utils/garageOrderUi';
import UserAvatar from '../UserAvatar/UserAvatar';

export default function SalesGarageOrderCard({
  order,
  orderType = 'used',
  isExpanded,
  onToggle,
  editingStatus,
  onEditStatus,
  onUpdateStatus,
  statusEditable = true,
  getStatusColor,
  getStatusName,
  orderStatusOptions = [],
  formatDate,
  formatPrice,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const items = order.items || [];
  const isUsed = orderType === 'used';
  const isNew = orderType === 'new';
  const statusCode = order.status_code || 'pending';
  const rosskoStatus = order.rossko_status;
  const rosskoOrderId = order.rossko_order_id;
  const rosskoSyncError = order.rossko_sync_error;
  const isEditing = editingStatus?.type === orderType && editingStatus?.id === order.id;
  const deliveryText = getGarageDeliveryInfo(order);

  const handleProductClick = async (item, e) => {
    e?.stopPropagation?.();
    if (item.product_id) {
      navigate(`/part/${item.product_id}`);
      return;
    }
    await openAvitoProductFlow({
      item,
      dispatch,
      navigate,
      fetchLinkThunk: fetchAvitoChatProductLink,
    });
  };

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
        isExpanded ? 'border-indigo-200 shadow-md ring-1 ring-indigo-100' : 'border-gray-200/80 hover:border-gray-300 hover:shadow'
      }`}
    >
      <div className="border-b border-gray-100 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  isUsed ? 'bg-violet-50 text-violet-800 ring-1 ring-violet-100' : 'bg-sky-50 text-sky-800 ring-1 ring-sky-100'
                }`}
              >
                {isUsed ? 'Б/У' : 'Новые'} · #{order.id}
              </span>
              {isNew && rosskoOrderId && (
                <span className="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-100">
                  Rossko №{rosskoOrderId}
                </span>
              )}
              {isNew && rosskoSyncError && (
                <span className="inline-flex items-center rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800 ring-1 ring-orange-100">
                  Данные Rossko недоступны
                </span>
              )}
              <span className="text-sm text-gray-500">{formatDate(order.created_at)}</span>
            </div>
            <div className="flex items-start gap-3">
              <UserAvatar
                avatarUrl={order.buyer_avatar_url}
                firstName={order.buyer_name}
                lastName=""
                size="lg"
              />
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900">{order.buyer_name || 'Покупатель не указан'}</h3>
                <p className="mt-1 text-sm text-gray-600 break-all">{order.buyer_phone || '—'}</p>
              </div>
            </div>
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">{deliveryText}</p>
          </div>

          <div className="flex flex-wrap items-end gap-3 lg:flex-col lg:items-end">
            <div>
              <div className="text-xs text-gray-500">Сумма заказа</div>
              <div className="text-xl font-bold tabular-nums text-gray-900">{formatPrice(order.total_amount)}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                  order.is_paid ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-100'
                }`}
              >
                {order.is_paid ? 'Оплачен' : 'Не оплачен'}
              </span>
              {isNew ? (
                // Для новых запчастей статус приходит от Rossko и меняется автоматически.
                // Показываем его в выпадающем списке, но без редактирования.
                <select
                  value={statusCode}
                  disabled
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700"
                >
                  {orderStatusOptions.map((status) => (
                    <option key={status.code} value={status.code}>
                      {status.name}
                    </option>
                  ))}
                </select>
              ) : statusEditable && isEditing ? (
                <select
                  value={statusCode}
                  onChange={(e) => onUpdateStatus(order.id, e.target.value)}
                  onBlur={() => onEditStatus(null)}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  autoFocus
                >
                  {orderStatusOptions.map((status) => (
                    <option key={status.code} value={status.code}>
                      {status.name}
                    </option>
                  ))}
                </select>
              ) : statusEditable ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditStatus({ type: orderType, id: order.id });
                  }}
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium transition hover:opacity-90 ${getStatusColor(statusCode)}`}
                  title="Изменить статус для покупателя"
                >
                  {getStatusName(statusCode)}
                </button>
              ) : (
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(statusCode)}`}
                  title="Статус заказа"
                >
                  {getStatusName(statusCode)}
                </span>
              )}
              {isNew && rosskoStatus && (
                <span
                  className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-100"
                  title="Статус заказа в Rossko (из API)"
                >
                  {rosskoStatus}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggle(order.id)}
        className="flex w-full items-center justify-between bg-gray-50/80 px-4 py-3 text-left sm:px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-medium text-indigo-600">
          {isExpanded ? 'Скрыть состав' : `Состав заказа · ${items.length} поз.`}
        </span>
        <svg
          className={`h-5 w-5 text-indigo-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
          <ul className="space-y-3">
            {items.map((item, idx) => {
              const lineTotal = (item.price || 0) * (item.quantity || 0);
              const title = item.product_name || item.name || 'Товар';
              return (
                <li
                  key={item.id || `${order.id}-${idx}`}
                  className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {(item.brand || item.product?.brand) && (
                          <span className="font-medium text-gray-700">{item.brand || item.product?.brand}</span>
                        )}
                        {(item.partnumber || item.product?.partnumber) && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="font-mono">{item.partnumber || item.product?.partnumber}</span>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleProductClick(item, e)}
                        className="text-left text-sm font-medium text-gray-900 hover:text-indigo-600 hover:underline"
                      >
                        {title}
                      </button>
                      <p className="mt-2 text-xs text-gray-500">
                        {item.quantity || 0} шт. × {formatPrice(item.price)}
                      </p>
                      {(item.stock_out_id || item.fulfilled_at) && (
                        <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-100">
                          Списано со склада{item.stock_out_id ? ` #${item.stock_out_id}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <div className="text-base font-semibold tabular-nums text-gray-900">{formatPrice(lineTotal)}</div>
                      {item.status_code && (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(item.status_code)}`}
                          title={isNew ? 'Статус для покупателя' : undefined}
                        >
                          {getStatusName(item.status_code)}
                        </span>
                      )}
                      {isNew && item.rossko_status && (
                        <span
                          className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-sky-100"
                          title="Статус позиции в Rossko"
                        >
                          {item.rossko_status}
                        </span>
                      )}
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
          Позиции не найдены
        </div>
      )}
    </article>
  );
}
