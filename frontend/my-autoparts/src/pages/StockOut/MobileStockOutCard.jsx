import React, { useState } from 'react';
import PhotoThumbnail from '../../components/PhotoGallery/PhotoThumbnail';

export const MobileStockOutCard = ({ 
  item, 
  photoUrl, 
  selectedItems, 
  handleSelectItem,
  toggleExpand,
  expandedDocId,
  toggleMobileActions,
  mobileActionsOpen,
  handleReturnItem,
  setMobileActionsOpen,
  getStorageAddress
}) => {
  const [imageError, setImageError] = useState(false);
  const isExpanded = expandedDocId === item.id;
  const isActionsOpen = mobileActionsOpen === item.id;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      {/* Фото и основная информация */}
      <div className="flex items-start gap-4 mb-4">
        {/* Product image */}
        <div 
          className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 cursor-pointer" 
          onClick={() => toggleExpand(item.id)}
        >
          {photoUrl && !imageError ? (
            <img 
              src={photoUrl} 
              alt={item.product?.name || 'Запчасть'}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Product details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base font-semibold text-gray-900">{item.product?.brand || '—'}</span>
                <span className="text-sm text-gray-400">•</span>
                <span className="text-sm text-gray-500 font-mono">{item.product?.article || '—'}</span>
              </div>
              <h3 className="text-sm font-medium text-gray-800 mb-2 line-clamp-2">{item.product?.name || '—'}</h3>
            </div>
            <input
              type="checkbox"
              checked={selectedItems.includes(item.id)}
              onChange={() => handleSelectItem(item.id)}
              className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded flex-shrink-0"
            />
          </div>
          
          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.sale_price > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {item.sale_price > 0 ? 'Продажа' : 'Списание'}
            </span>
            {item.sale_channel === 'avito' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Авито
              </span>
            )}
            {item.sale_channel === 'drom' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Drom
              </span>
            )}
          </div>
          
          {/* Price and quantity */}
          <div className="flex items-center gap-4">
            <div className="text-lg font-bold text-gray-900">
              {item.sale_price != null ? `${item.sale_price.toLocaleString('ru-RU')} ₽` : '—'}
            </div>
            <div className="text-sm text-gray-600">{item.quantity} шт.</div>
          </div>
          
          {/* Date */}
          <div className="text-xs text-gray-500 mt-1">
            {item.movement_date}
          </div>
        </div>
      </div>

      {/* Кнопка действий */}
      <div className="mb-2">
        <div className="relative mobile-actions-dropdown">
          <button
            onClick={() => toggleMobileActions(item.id)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
            <span>Действия</span>
          </button>

          {isActionsOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10 mobile-actions-dropdown w-48 mx-auto">
              <button
                onClick={() => {
                  handleReturnItem(item);
                  setMobileActionsOpen(null);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Вернуть на склад
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Кнопка показа деталей */}
      <div className="pt-1 border-t border-gray-100">
        <button
          onClick={() => toggleExpand(item.id)}
          className="w-full text-indigo-600 text-sm font-medium hover:text-indigo-800 transition-colors py-2"
        >
          {isExpanded ? 'Скрыть детали' : 'Показать детали'}
        </button>
      </div>

      {/* Детали документа - мобильная версия */}
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="grid grid-cols-1 gap-4">
            {/* Фото и видео */}
            <div>
              <PhotoThumbnail 
                photos={item.product?.photos || []} 
                videos={item.product?.videos || []}
              />
            </div>

            {/* Информация */}
            <div className="space-y-4">
              {/* Описание */}
              <div>
                <span className="text-sm text-gray-500 block mb-1">Описание</span>
                <div className="text-base text-gray-900">
                  {item.product?.description || '—'}
                </div>
              </div>

              {/* Дополнительная информация */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500 block mb-1">Дата операции</span>
                  <div className="text-base font-medium text-gray-900">
                    {item.movement_date}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-500 block mb-1">Склад</span>
                  <div className="text-base font-medium text-gray-900">
                    {getStorageAddress(item.storage_location_id)}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-500 block mb-1">Причина</span>
                  <div className="text-base font-medium text-gray-900">
                    {item.reason || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-500 block mb-1">Ответственный</span>
                  <div className="text-base font-medium text-gray-900">
                    {item.user ? `${item.user.last_name} ${item.user.first_name}${item.user.patronymic ? ` ${item.user.patronymic}` : ''}` : '—'}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-sm text-gray-500 block mb-1">Состояние запчасти</span>
                  <div className="text-base font-medium text-gray-900">
                    {item.product?.is_new ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        Новый
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        Б/у
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Автомобиль(и) */}
              {item.product?.compatible_vehicles && item.product.compatible_vehicles.length > 0 && (
                <div>
                  <span className="text-sm text-gray-500 block mb-2">Автомобиль</span>
                  <div className="space-y-3">
                    {item.product.compatible_vehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded border text-sm"
                      >
                        <div>
                          <span className="text-gray-500">Марка:</span>
                          <div className="font-medium">{vehicle.brand}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Модель:</span>
                          <div className="font-medium">{vehicle.model}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Поколение:</span>
                          <div className="font-medium">{vehicle.generation || '—'}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Двигатель:</span>
                          <div className="font-medium">{vehicle.engine || '—'}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">КПП:</span>
                          <div className="font-medium">{vehicle.transmission || '—'}</div>
                        </div>
                        {vehicle.vin && (
                          <div className="col-span-2">
                            <span className="text-gray-500">VIN:</span>
                            <div className="font-medium">{vehicle.vin}</div>
                          </div>
                        )}
                        {vehicle.mileage && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Пробег:</span>
                            <div className="font-medium">{vehicle.mileage.toLocaleString()} км</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
