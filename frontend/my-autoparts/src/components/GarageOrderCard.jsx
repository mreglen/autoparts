import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { fetchAvitoChatProductLink } from '../redux/slices/AvitoChatSlice';
import { INTERNAL_CODE_LABEL, formatInternalCodeDisplay } from '../utils/internalCode';

/**
 * Компонент карточки заказа "Свой Гараж"
 * Оформлен в стиле AvitoOrderCard для консистентности интерфейса
 */
export function GarageOrderCard({ 
  order, 
  orderType = 'used',
  isExpanded, 
  onToggle, 
  editingStatus, 
  onEditStatus, 
  onUpdateStatus,
  getStatusColor,
  getStatusName,
  orderStatusOptions = [],
  formatDate, 
  formatPrice 
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const items = order.items || [];
  
  // Обработчик клика по названию товара
  const handleProductClick = async (item, e) => {
    e.stopPropagation();
    
    console.log('=== GarageOrderCard - HANDLE PRODUCT CLICK ===');
    console.log('Full item data:', JSON.stringify(item, null, 2));
    console.log('GarageOrderCard - item.product_id:', item.product_id);
    console.log('GarageOrderCard - item.productId:', item.productId);
    console.log('GarageOrderCard - item.linked_product_id:', item.linked_product_id);
    console.log('GarageOrderCard - item.linkedProductId:', item.linkedProductId);
    console.log('GarageOrderCard - item.avito_context_id:', item.avito_context_id);
    console.log('GarageOrderCard - item.avito_context_url:', item.avito_context_url);
    console.log('GarageOrderCard - item.avito_url:', item.avito_url);
    console.log('GarageOrderCard - item.avitoId:', item.avitoId);
    console.log('GarageOrderCard - item.avitoItemId:', item.avitoItemId);
    console.log('GarageOrderCard - item.avito_id:', item.avito_id);
    console.log('GarageOrderCard - item.avitoUrl:', item.avitoUrl);
    console.log('GarageOrderCard - item.url:', item.url);
    
    // Если есть product_id или linked_product_id - переходим на /part/
    if (item.product_id || item.productId || item.linked_product_id || item.linkedProductId) {
      const productId = item.product_id || item.productId || item.linked_product_id || item.linkedProductId;
      console.log('✅ GarageOrderCard - Navigating to /part/', productId);
      navigate(`/part/${productId}`);
    } 
    // Если есть avito id - проверяем связь
    else if (item.avitoItemId || item.avitoId || item.avito_id || item.avito_context_id) {
      const avitoId = item.avitoItemId || item.avitoId || item.avito_id || item.avito_context_id;
      console.log('🔍 GarageOrderCard - Checking Avito link for avito id:', avitoId);
      try {
        const linkData = await dispatch(fetchAvitoChatProductLink(avitoId)).unwrap();
        console.log('GarageOrderCard - Link data:', linkData);
        if (linkData?.linked && linkData?.product_id) {
          console.log('✅ GarageOrderCard - Found linked product, navigating to /part/', linkData.product_id);
          navigate(`/part/${linkData.product_id}`);
        } else {
          console.log('❌ GarageOrderCard - No link found, opening confirmation page');
          // Нет связи - открываем страницу подтверждения
          const fallbackUrl = item.avitoUrl || item.url || item.avito_context_url || item.avito_url || 'https://avito.ru';
          const encodedUrl = encodeURIComponent(fallbackUrl);
          window.open(`/product-not-found?avitoUrl=${encodedUrl}`, '_blank');
        }
      } catch (error) {
        console.error('❌ GarageOrderCard - Error checking Avito link:', error);
        // Ошибка - открываем страницу подтверждения
        const fallbackUrl = item.avitoUrl || item.url || item.avito_context_url || item.avito_url || 'https://avito.ru';
        const encodedUrl = encodeURIComponent(fallbackUrl);
        window.open(`/product-not-found?avitoUrl=${encodedUrl}`, '_blank');
      }
    }
    // Если есть просто avito_url
    else if (item.avitoUrl || item.url || item.avito_url || item.avito_context_url) {
      console.log('🔗 GarageOrderCard - Opening product-not-found with avito_url');
      const encodedUrl = encodeURIComponent(item.avitoUrl || item.url || item.avito_url || item.avito_context_url);
      window.open(`/product-not-found?avitoUrl=${encodedUrl}`, '_blank');
    } else {
      console.log('⚠️ GarageOrderCard - No product link data found in item');
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
              <div className="text-xs text-gray-500 mb-1">Номер заказа</div>
              <div className="font-mono font-semibold text-gray-900">
                {orderType === 'new' ? 'Новый' : 'Б/У'} #{order.id}
              </div>
            </div>
            <div className="h-8 w-px bg-gray-300"></div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Дата создания</div>
              <div className="text-sm text-gray-900">{formatDate(order.created_at)}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Сумма</div>
              <div className="font-semibold text-gray-900 text-lg">{formatPrice(order.total_amount)}</div>
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
        <div className="grid grid-cols-4 gap-6">
          {/* Клиент */}
          <div>
            <div className="text-xs text-gray-500 mb-2">Клиент</div>
            <div className="font-medium text-gray-900 mb-1">
              {order.buyer_name || order.recipient_name || 'Не указан'}
            </div>
            <div className="text-sm text-gray-600">
              {order.buyer_phone || order.recipient_phone || 'Не указан'}
            </div>
          </div>

          {/* Доставка */}
          <div>
            <div className="text-xs text-gray-500 mb-2">Доставка</div>
            <div className="text-sm text-gray-900">
              {order.delivery_method_name || 'Не указана'}
            </div>
          </div>

          {/* Оплата */}
          <div>
            <div className="text-xs text-gray-500 mb-2">Оплата</div>
            <span className={`inline-flex px-2 py-1 text-xs rounded ${
              order.is_paid
                ? 'bg-green-50 text-green-700'
                : 'bg-orange-50 text-orange-700'
            }`}>
              {order.is_paid ? 'Оплачено' : 'Не оплачено'}
            </span>
          </div>

          {/* Статус */}
          <div>
            <div className="text-xs text-gray-500 mb-2">Статус</div>
            {editingStatus?.type === orderType && editingStatus?.id === order.id ? (
              <select
                value={order.status_code || 'pending'}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdateStatus(order.id, e.target.value);
                }}
                onBlur={(e) => {
                  // Не закрываем сразу, даём времени на срабатывание onChange
                  setTimeout(() => onEditStatus(null), 100);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                autoFocus
              >
                {orderStatusOptions.map((status) => (
                  <option key={status.code} value={status.code}>
                    {status.name}
                  </option>
                ))}
              </select>
            ) : (
              <div
                className={`inline-flex items-center px-3 py-1.5 rounded cursor-pointer hover:opacity-80 ${getStatusColor(order.status_code)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditStatus({ type: orderType, id: order.id });
                }}
              >
                <span className="text-sm font-medium">{getStatusName(order.status_code)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Детали заказа (раскрывающаяся секция) */}
      {isExpanded && items.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="text-sm font-medium text-gray-900 mb-3">
            Товары ({items.length})
          </div>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded p-4 border border-gray-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Название товара - кликабельное */}
                    <button
                      onClick={(e) => handleProductClick(item, e)}
                      className="font-medium text-gray-900 mb-2 truncate hover:text-indigo-600 transition-colors cursor-pointer text-left w-full underline"
                      title="Перейти к товару"
                    >
                      {item.product_name || item.product?.name || item.name || 'Товар'}
                    </button>
                    
                    {/* Информация о товаре */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {/* Бренд */}
                      <div>
                        <span className="text-gray-500">Бренд: </span>
                        <span className="text-gray-900 font-medium">{item.brand || item.product?.brand || '-'}</span>
                      </div>
                      
                      {/* Артикул */}
                      <div>
                        <span className="text-gray-500">Артикул: </span>
                        <span className="text-gray-900 font-medium">{item.partnumber || item.product?.partnumber || '-'}</span>
                      </div>
                      
                      <div>
                        <span className="text-gray-500">{INTERNAL_CODE_LABEL}: </span>
                        <span className="text-gray-900 font-medium font-mono">
                          {formatInternalCodeDisplay(item.internal_code || item.product?.internal_code)}
                        </span>
                      </div>
                      
                      {/* Product ID */}
                      {item.product_id && (
                        <div>
                          <span className="text-gray-500">ID товара: </span>
                          <span className="text-indigo-600 font-medium">#{item.product_id}</span>
                        </div>
                      )}
                      
                      {/* Количество и цена */}
                      <div>
                        <span className="text-gray-500">Кол-во: </span>
                        <span className="text-gray-900">{item.quantity} шт.</span>
                        <span className="text-gray-500 ml-2">× </span>
                        <span className="text-gray-900">{formatPrice(item.price)}</span>
                      </div>

                      {(item.stock_out_id || item.fulfilled_at) && (
                        <div>
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            Списано со склада
                            {item.stock_out_id ? ` (#${item.stock_out_id})` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Ячейка хранения */}
                    {item.storage_cell && (
                      <div className="text-xs text-gray-500 mt-2">
                        <span className="font-medium">Ячейка:</span> {item.storage_cell}
                      </div>
                    )}
                  </div>
                  
                  {/* Сумма */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-gray-500 mb-1">Сумма</div>
                    <div className="font-semibold text-gray-900 text-lg">
                      {formatPrice(item.quantity * item.price)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
