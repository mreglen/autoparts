import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { fetchAvitoChatProductLink } from '../../redux/slices/AvitoChatSlice';
import { openAvitoProductFlow } from '../../utils/avitoProductFlow';
import { getGarageDeliveryInfo } from '../../utils/garageOrderUi';
import { navigateGarageOrderItem } from '../../utils/partRoutes';
import UserAvatar from '../UserAvatar/UserAvatar';
import OrderSourceBadge from '../Orders/OrderSourceBadge';

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
  const defaultStatus = isNew ? 'new_waiting_confirmation' : 'pending';
  const orderStatusCode = order.status_code || defaultStatus;
  const rosskoStatus = order.rossko_status;
  const rosskoOrderId = order.rossko_order_id;
  const rosskoSyncError = order.rossko_sync_error;

  const isEditingOrder =
    editingStatus?.type === orderType &&
    editingStatus?.orderId === order.id &&
    editingStatus?.itemId == null;

  const isEditingItem = (itemId) =>
    editingStatus?.type === orderType &&
    editingStatus?.orderId === order.id &&
    editingStatus?.itemId === itemId;

  const deliveryText = getGarageDeliveryInfo(order);

  const openOrderEditor = () => {
    if (isEditingOrder) {
      onEditStatus(null);
      return;
    }
    onEditStatus({ type: orderType, orderId: order.id, itemId: null });
  };

  const openItemEditor = (itemId) => {
    if (isEditingItem(itemId)) {
      onEditStatus(null);
      return;
    }
    onEditStatus({ type: orderType, orderId: order.id, itemId });
  };

  const handleProductClick = async (item, e) => {
    e?.stopPropagation?.();
    if (item.product_id) {
      const productId = item.product_id;
      const brand = item.brand || item.product?.brand;
      const article = item.partnumber || item.product?.partnumber;

      if (brand && article) {
        navigate(
          `/part/${productId}-${encodeURIComponent(String(brand))}-${encodeURIComponent(String(article))}`
        );
        return;
      }

      navigate(`/part/${productId}`);
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
                orderStatusOptions={orderStatusOptions}
                showStatusIcon={isNew}
                title={isNew ? 'Статус заказа для покупателя (Свой Гараж)' : 'Статус заказа'}
              />
              {isNew && rosskoStatus && (
                <span
                  className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-100"
                  title="Статус Rossko (только просмотр)"
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
                      <GarageCustomerStatusControl
                        statusCode={itemStatusCode}
                        statusEditable={statusEditable}
                        isEditing={isEditingItem(item.id)}
                        onToggleEdit={() => openItemEditor(item.id)}
                        onStatusChange={(code) => {
                          onUpdateStatus(order.id, code, item.id);
                          onEditStatus(null);
                        }}
                        onCloseEdit={() => onEditStatus(null)}
                        getStatusColor={getStatusColor}
                        getStatusName={getStatusName}
                        orderStatusOptions={orderStatusOptions}
                        size="sm"
                        showStatusIcon={isNew}
                        title={isNew ? 'Статус позиции для покупателя (Свой Гараж)' : 'Статус позиции'}
                      />
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
