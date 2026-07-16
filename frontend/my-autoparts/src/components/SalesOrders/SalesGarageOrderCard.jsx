import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { fetchAvitoChatProductLink } from '../../redux/slices/AvitoChatSlice';
import { openOrderItemProductFlow } from '../../utils/avitoProductFlow';
import {
  getGarageDeliveryInfo,
  isGarageItemAwaitingSellerConfirm,
  isRosskoNewOrder,
} from '../../utils/garageOrderUi';
import UserAvatar from '../UserAvatar/UserAvatar';
import OrderSourceBadge from '../Orders/OrderSourceBadge';
import OrderWriteMessageButton from '../OrderWriteMessageButton/OrderWriteMessageButton';

const SVOYGARAGE_LOGO = '/logos/svoygarage.png';

function SvoyGarageStatusIcon({ onClick, title, interactive = true, size = 'md' }) {
  const boxClass =
    size === 'sm'
      ? 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-indigo-200 bg-white'
      : 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-indigo-200 bg-white shadow-sm';
  const interactiveClass = interactive
    ? ' transition hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 cursor-pointer'
    : ' opacity-80';

  if (interactive && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${boxClass}${interactiveClass}`}
        title={title}
        aria-label={title}
      >
        <img src={SVOYGARAGE_LOGO} alt="" className="h-3.5 w-3.5 object-contain" />
      </button>
    );
  }

  return (
    <span className={`${boxClass}${interactiveClass}`} title={title}>
      <img src={SVOYGARAGE_LOGO} alt="" className="h-3.5 w-3.5 object-contain" />
    </span>
  );
}

function GarageCustomerStatusControl({
  statusCode,
  statusEditable,
  isEditing,
  onToggleEdit,
  onStatusChange,
  onCloseEdit,
  getStatusColor,
  getStatusName,
  orderStatusOptions,
  size = 'md',
  title = 'Статус для покупателя (Свой Гараж)',
  showStatusIcon = true,
}) {
  const toggleEdit = (e) => {
    e.stopPropagation();
    if (!statusEditable) return;
    onToggleEdit();
  };

  const handleChange = (e) => {
    e.stopPropagation();
    onStatusChange(e.target.value);
  };

  const badgePadding = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';

  return (
    <div className="inline-flex items-center gap-1" title={title}>
      {showStatusIcon && (
        <SvoyGarageStatusIcon
          size={size}
          interactive={statusEditable}
          onClick={statusEditable ? toggleEdit : undefined}
          title={statusEditable ? 'Нажмите, чтобы изменить статус' : 'Свой Гараж'}
        />
      )}
      {statusEditable && isEditing ? (
        <select
          value={statusCode}
          onChange={handleChange}
          onBlur={onCloseEdit}
          onClick={(e) => e.stopPropagation()}
          className={`max-w-[12rem] rounded-lg border border-indigo-300 bg-white text-xs font-medium text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}
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
          onClick={toggleEdit}
          className={`inline-flex rounded-full text-xs font-medium transition hover:opacity-90 ${badgePadding} ${getStatusColor(statusCode)}`}
          title="Нажмите, чтобы изменить статус"
        >
          {getStatusName(statusCode)}
        </button>
      ) : (
        <span className={`inline-flex rounded-full text-xs font-medium ${badgePadding} ${getStatusColor(statusCode)}`}>
          {getStatusName(statusCode)}
        </span>
      )}
    </div>
  );
}

export default function SalesGarageOrderCard({
  order,
  orderType = 'used',
  isExpanded,
  onToggle,
  editingStatus,
  onEditStatus,
  onUpdateStatus,
  onOpenPickupVerify,
  onOpenItemConfirm,
  onRejectItem,
  onConfirmRosskoItem,
  statusEditable = true,
  getStatusColor,
  getStatusName,
  orderStatusOptions = [],
  formatDate,
  formatPrice,
  onRefreshSupplierStatus,
  supplierRefreshLoading = false,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const items = order.items || [];
  const isUsed = orderType === 'used';
  const isNew = orderType === 'new';
  const defaultStatus = isNew ? 'new_waiting_confirmation' : 'pending';
  const orderStatusCode = order.status_code || defaultStatus;
  const rosskoStatus = order.rossko_status;
  const rosskoOrderId = order.rossko_order_id;
  const rosskoSyncError = order.rossko_sync_error;
  const isPickup = String(order.delivery_type || '').toLowerCase() === 'pickup';
  const isRossko = isNew && isRosskoNewOrder(order);

  const getStatusOptionsForDropdown = (currentStatusCode) => {
    if (!isPickup) return orderStatusOptions;
    return orderStatusOptions.filter(
      (status) => status.code !== 'shipped' || status.code === currentStatusCode
    );
  };

  const isEditingOrder =
    editingStatus?.type === orderType &&
    editingStatus?.orderId === order.id &&
    editingStatus?.itemId == null;

  const primaryCta = (() => {
    if (isUsed) {
      if (orderStatusCode === 'pending') {
        return { label: 'Подтвердить', status: 'confirmed' };
      }
      if (orderStatusCode === 'confirmed') {
        return { label: 'Собрано', status: 'assembled' };
      }
      if (orderStatusCode === 'assembled' && isPickup) {
        return { label: 'К выдаче', status: 'ready_for_pickup' };
      }
      if (orderStatusCode === 'assembled' && !isPickup) {
        return { label: 'В доставку', status: 'shipped' };
      }
      if (orderStatusCode === 'ready_for_pickup' && isPickup) {
        return { label: 'Выдать', action: 'verify' };
      }
      if (orderStatusCode === 'shipped') {
        return { label: 'Получен', status: 'delivered' };
      }
    }
    if (isNew) {
      if (orderStatusCode === 'new_waiting_confirmation') {
        return { label: 'В сборку', status: 'new_assembling' };
      }
      if (orderStatusCode === 'new_assembling') {
        return { label: 'Отгружено', status: 'new_shipped' };
      }
      if (orderStatusCode === 'new_shipped' || orderStatusCode === 'new_awaiting_arrival') {
        if (isPickup) {
          return { label: 'К выдаче', status: 'new_ready_for_pickup' };
        }
        return { label: 'Получен', status: 'new_received' };
      }
      if (orderStatusCode === 'new_ready_for_pickup' && isPickup) {
        return { label: 'Выдать', action: 'verify' };
      }
    }
    return null;
  })();

  const deliveryText = getGarageDeliveryInfo(order);

  const openOrderEditor = () => {
    if (isEditingOrder) {
      onEditStatus(null);
      return;
    }
    onEditStatus({ type: orderType, orderId: order.id, itemId: null });
  };

  const handleProductClick = async (item, e) => {
    e?.stopPropagation?.();
    await openOrderItemProductFlow({
      item,
      orderType,
      order,
      dispatch,
      navigate,
      fetchLinkThunk: fetchAvitoChatProductLink,
      destination: 'seller',
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
              <span className="inline-flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1 ring-1 ring-gray-100">
                <OrderSourceBadge source={isUsed ? 'used' : 'new'} size="sm" />
                <span className="text-xs font-semibold text-gray-800">#{order.id}</span>
              </span>
              {isNew && rosskoOrderId && (
                <span className="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-100">
                  Rossko №{rosskoOrderId}
                </span>
              )}
              {isNew && rosskoSyncError && (
                <span className="inline-flex items-center rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800 ring-1 ring-orange-100">
                  Статус поставщика временно недоступен
                </span>
              )}
              {isNew && rosskoOrderId && onRefreshSupplierStatus && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefreshSupplierStatus(order.id);
                  }}
                  disabled={supplierRefreshLoading}
                  className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {supplierRefreshLoading ? 'Обновление…' : 'Обновить статус поставщика'}
                </button>
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
                <div className="mt-2">
                  <OrderWriteMessageButton
                    label="Написать покупателю"
                    targetUserId={order.buyer_user_id}
                  />
                </div>
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-600 line-clamp-2">{deliveryText}</p>
            {isUsed && order.buyer_comment ? (
              <p className="mt-2 rounded-lg bg-amber-50/80 px-3 py-2 text-sm text-gray-700 ring-1 ring-amber-100">
                <span className="font-medium text-gray-900">Комментарий покупателя: </span>
                {order.buyer_comment}
              </p>
            ) : null}
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
              <GarageCustomerStatusControl
                statusCode={orderStatusCode}
                statusEditable={statusEditable}
                isEditing={isEditingOrder}
                onToggleEdit={openOrderEditor}
                onStatusChange={(code) => {
                  onUpdateStatus(order.id, code, null);
                  onEditStatus(null);
                }}
                onCloseEdit={() => onEditStatus(null)}
                getStatusColor={getStatusColor}
                getStatusName={getStatusName}
                orderStatusOptions={getStatusOptionsForDropdown(orderStatusCode)}
                showStatusIcon={isNew}
                title={isNew ? 'Статус заказа для покупателя (Свой Гараж)' : 'Статус заказа'}
              />
              {primaryCta ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (primaryCta.action === 'verify') {
                      onOpenPickupVerify?.(order, orderType);
                      return;
                    }
                    onUpdateStatus(order.id, primaryCta.status, null);
                  }}
                  className="inline-flex items-center rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  {primaryCta.label}
                </button>
              ) : null}
              {isNew && rosskoStatus && (
                <span
                  className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-100"
                  title="Статус у поставщика (только просмотр)"
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
              const itemStatusCode = item.status_code || orderStatusCode;
              const showItemConfirmActions = isGarageItemAwaitingSellerConfirm(itemStatusCode, orderType)
                && (isUsed ? Boolean(item.product_id) : isRossko);
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
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <div className="text-base font-semibold tabular-nums text-gray-900">{formatPrice(lineTotal)}</div>
                      {showItemConfirmActions ? (
                        <div className="flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isRossko) {
                                onConfirmRosskoItem?.(order, item);
                                return;
                              }
                              onOpenItemConfirm?.(order, item, orderType);
                            }}
                            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                          >
                            Подтвердить
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRejectItem?.(order, item, orderType);
                            }}
                            className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            Не подтверждён
                          </button>
                        </div>
                      ) : null}
                      {isNew && item.rossko_status && (
                        <span
                          className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-sky-100"
                          title="Статус Rossko (только просмотр)"
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
