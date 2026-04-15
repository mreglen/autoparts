import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { fetchAvitoChatProductLink } from '../redux/slices/AvitoChatSlice';

/**
 * Компонент карточки заказа Авито
 * Отображает информацию из avito_data (JSON ответа API Авито)
 */
export function AvitoOrderCard({ order, isExpanded, onToggle, editingStatus, onEditStatus, onAvitoTransition, avitoStatuses, getAvitoStatusColor, getAvitoStatusName, formatDate, formatPrice }) {
  // Извлекаем данные из avito_data
  const avitoData = order.avito_data || {};
  const delivery = avitoData.delivery || {};
  const buyerInfo = delivery.buyerInfo || {};
  const prices = avitoData.prices || {};
  const items = avitoData.items || [];
  const schedules = avitoData.schedules || {};
  
  // Форматируем ФИО из buyerInfo
  const buyerFullName = buyerInfo.fullName || order.recipient_name || 'Не указан';
  const buyerPhone = buyerInfo.phoneNumber || order.recipient_phone || 'Не указан';
  
  // Тип доставки
  const deliveryServiceName = delivery.serviceName || 'Не указан';
  const deliveryServiceType = delivery.serviceType || '';
  
  // Сроки доставки
  const deliveryDateMin = schedules.deliveryDateMin;
  const deliveryDateMax = schedules.deliveryDateMax || schedules.deliveryDateMaх; // обратите внимание на опечатку в API
  
  // Цены из Авито
  const avitoPrice = prices.price || 0;
  const avitoCommission = prices.commission || 0;
  const avitoTotal = prices.total || 0;
  
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  // Обработчик клика по названию товара
  const handleProductClick = async (item, e) => {
    e.stopPropagation();
    
    console.log('AvitoOrderCard - handleProductClick:', item);
    console.log('AvitoOrderCard - item.product_id:', item.product_id);
    console.log('AvitoOrderCard - item.avitoItemId:', item.avitoItemId);
    
    // Если есть product_id или linked_product_id - переходим на /part/
    if (item.product_id || item.linked_product_id) {
      const productId = item.product_id || item.linked_product_id;
      console.log('AvitoOrderCard - Navigating to /part/', productId);
      navigate(`/part/${productId}`);
    } 
    // Если есть avitoItemId (avito_id товара) - проверяем связь
    else if (item.avitoItemId || item.avito_id) {
      try {
        const avitoId = item.avitoItemId || item.avito_id;
        console.log('AvitoOrderCard - Checking Avito link for avito_id:', avitoId);
        const linkData = await dispatch(fetchAvitoChatProductLink(avitoId)).unwrap();
        console.log('AvitoOrderCard - Link data:', linkData);
        if (linkData?.linked && linkData?.product_id) {
          navigate(`/part/${linkData.product_id}`);
        } else if (item.avitoUrl || item.url) {
          // Нет связи, но есть ссылка - открываем страницу подтверждения
          const encodedUrl = encodeURIComponent(item.avitoUrl || item.url);
          window.open(`/product-not-found?avitoUrl=${encodedUrl}`, '_blank');
        }
      } catch (error) {
        console.error('AvitoOrderCard - Error checking Avito link:', error);
        // Ошибка - если есть ссылка, открываем страницу подтверждения
        if (item.avitoUrl || item.url) {
          const encodedUrl = encodeURIComponent(item.avitoUrl || item.url);
          window.open(`/product-not-found?avitoUrl=${encodedUrl}`, '_blank');
        }
      }
    }
    // Если есть просто avito_url
    else if (item.avitoUrl || item.url) {
      console.log('AvitoOrderCard - Opening product-not-found with avito_url');
      const encodedUrl = encodeURIComponent(item.avitoUrl || item.url);
      window.open(`/product-not-found?avitoUrl=${encodedUrl}`, '_blank');
    } else {
      console.log('AvitoOrderCard - No product link found');
    }
  };
  
  return (
    <div 
      className={`bg-white rounded-lg border transition-all ${
        isExpanded ? 'border-gray-400 shadow-md' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Шапка карточки */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">ID заказа</div>
              <div className="font-mono font-semibold text-gray-900">#{order.avito_order_id}</div>
            </div>
            <div className="h-8 w-px bg-gray-300"></div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Дата создания</div>
              <div className="text-sm text-gray-900">{formatDate(order.created_at)}</div>
            </div>
            {deliveryDateMin && (
              <>
                <div className="h-8 w-px bg-gray-300"></div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Сроки доставки</div>
                  <div className="text-sm text-gray-900">
                    {formatDate(deliveryDateMin)} - {deliveryDateMax ? formatDate(deliveryDateMax) : 'не указан'}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Сумма</div>
              <div className="font-semibold text-gray-900 text-lg">{formatPrice(avitoTotal)}</div>
              {avitoCommission > 0 && (
                <div className="text-xs text-gray-400">Комиссия: {formatPrice(avitoCommission)}</div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(order.id);
              }}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title={isExpanded ? 'Скрыть детали' : 'Показать детали'}
            >
              <svg 
                className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Основная информация */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-3 gap-6">
          {/* Покупатель */}
          <div>
            <div className="text-xs text-gray-500 mb-2">Покупатель</div>
            <div className="font-medium text-gray-900 mb-1">
              {buyerFullName}
            </div>
            <div className="text-sm text-gray-600">
              {buyerPhone}
            </div>
          </div>

          {/* Доставка */}
          <div>
            <div className="text-xs text-gray-500 mb-2">Доставка</div>
            <div className="text-sm text-gray-900">
              {deliveryServiceName}
            </div>
          </div>

          {/* Статус */}
          <div>
            <div className="text-xs text-gray-500 mb-2">Статус</div>
            {editingStatus?.type === 'avito' && editingStatus?.id === order.id ? (
              <select
                value={order.avito_status_code}
                onChange={(e) => onAvitoTransition(order.avito_order_id, e.target.value)}
                onBlur={() => onEditStatus(null)}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                autoFocus
              >
                {avitoStatuses.map(status => (
                  <option key={status.code} value={status.code}>
                    {status.name}
                  </option>
                ))}
              </select>
            ) : (
              <div
                className={`inline-flex items-center px-3 py-1.5 rounded cursor-pointer hover:opacity-80 ${getAvitoStatusColor(order.avito_status_code)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditStatus({ type: 'avito', id: order.id });
                }}
              >
                <span className="text-sm font-medium">{getAvitoStatusName(order.avito_status_code)}</span>
              </div>
            )}
            <div className="mt-2">
              <span className={`inline-flex px-2 py-1 text-xs rounded ${
                order.is_paid
                  ? 'bg-green-50 text-green-700'
                  : 'bg-orange-50 text-orange-700'
              }`}>
                {order.is_paid ? 'Оплачено' : 'Не оплачено'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Детали заказа (раскрывающаяся секция) */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          {/* Товары из Авито */}
          {items.length > 0 && (
            <div className="mb-4">
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={item.avitoId || index} className="bg-white rounded p-3 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Название товара - кликабельное */}
                        <button
                          onClick={(e) => handleProductClick(item, e)}
                          className="font-medium text-gray-900 mb-1 hover:text-indigo-600 transition-colors cursor-pointer text-left underline"
                          title="Перейти к товару"
                        >
                          {item.title}
                        </button>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          {item.location && (
                            <span>{item.location}</span>
                          )}
                          {item.chatId && (
                            <span className="text-xs text-gray-400">Chat: {item.chatId}</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {item.count} шт. × {formatPrice(item.prices?.price || 0)}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-medium text-gray-900">{formatPrice(item.prices?.total || 0)}</div>
                        {item.prices?.commission > 0 && (
                          <div className="text-xs text-gray-400">Комиссия: {formatPrice(item.prices.commission)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Доступные действия */}
          {avitoData.availableActions && avitoData.availableActions.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-900 mb-2">
                Доступные действия
              </div>
              <div className="flex flex-wrap gap-2">
                {avitoData.availableActions.map((action, index) => (
                  <span 
                    key={index}
                    className={`inline-flex items-center px-3 py-1.5 rounded text-xs font-medium ${
                      action.required 
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-gray-100 text-gray-700 border border-gray-200'
                    }`}
                  >
                    {action.name}
                    {action.required && <span className="ml-1 text-red-500">*</span>}
                  </span>
                ))}
              </div>
           
            </div>
          )}
        </div>
      )}
    </div>
  );
}
