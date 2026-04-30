import React, { useState, useEffect } from 'react';
import PhotoThumbnail from '../../components/PhotoGallery/PhotoThumbnail';
import { stripHtmlTags } from '../../utils/text';

export const StockOutRow = ({ item, getStorageAddress, onToggleExpand, isExpanded, onImageClick, isSelected, onSelect, onReturn }) => {
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Получаем URL первого фото
  const firstPhoto = item.product?.photos?.[0];
  const photoUrl = firstPhoto?.url || (firstPhoto?.file_path ? `/uploads/${firstPhoto.file_path}` : null);

  // Закрываем dropdown при клике вне
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.actions-dropdown')) {
        setShowActionsDropdown(false);
      }
    };

    if (showActionsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionsDropdown]);
  return (
    <React.Fragment>
      <tr className="hover:bg-gray-50">
      <td 
        className="px-4 py-4 whitespace-nowrap border-r border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
        />
      </td>
      
      {/* Product info with image - spans multiple columns */}
      <td className="px-4 py-4" colSpan={5}>
        <div className="flex items-start gap-4">
          {/* Product image */}
          <div 
            className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 cursor-pointer" 
            onClick={onToggleExpand}
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
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggleExpand}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base font-semibold text-gray-900">{item.product?.brand || '—'}</span>
              <span className="text-sm text-gray-400">•</span>
              <span className="text-sm text-gray-500 font-mono">{item.product?.article || '—'}</span>
            </div>
            {item.product?.internal_code && (
              <div className="text-xs text-gray-500 mb-1">
                Внутренний код: <span className="font-mono">{item.product.internal_code}</span>
              </div>
            )}
            <h3 className="text-sm font-medium text-gray-800 mb-2 line-clamp-2">{item.product?.name || '—'}</h3>
            
            {/* Status badges */}
            <div className="flex items-center gap-2 flex-wrap">
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
          </div>
        </div>
      </td>
      
      {/* Quantity */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-center">
          <div className="text-sm font-medium text-gray-900">{item.quantity}</div>
          <div className="text-xs text-gray-500">шт.</div>
        </div>
      </td>
      
      {/* Price */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-base font-bold text-gray-900">
          {item.sale_price != null ? `${item.sale_price.toLocaleString('ru-RU')} ₽` : '—'}
        </div>
      </td>
      
      {/* Date */}
      <td className="hidden md:table-cell px-4 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer" onClick={onToggleExpand}>
        {item.movement_date}
      </td>
      
      {/* Actions */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="relative actions-dropdown">
          <button
            onClick={(e) => { e.stopPropagation(); setShowActionsDropdown(!showActionsDropdown); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
            <span className="hidden sm:inline">Действия</span>
          </button>

          {showActionsDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-20 actions-dropdown">
              <button
                onClick={(e) => { e.stopPropagation(); onReturn(item); setShowActionsDropdown(false); }}
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
      </td>
    </tr>

    {/* Раскрывающаяся карточка */}
    {isExpanded && (
      <tr className="bg-gray-50">
        <td colSpan="8" className="px-6 py-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Фото и видео */}
            <div>
              <PhotoThumbnail 
                photos={item.product?.photos || []} 
                videos={item.product?.videos || []}
                onImageClick={onImageClick}
              />
            </div>

            {/* Информация */}
            <div className="space-y-4">

              {/* Описание */}
              <div>
                <span className="text-xs text-gray-500">Описание</span>
                <div className="font-medium mt-1">
                  {stripHtmlTags(item.product?.description) || '—'}
                </div>
              </div>

              {/* Дополнительная информация */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">Дата операции</span>
                  <div className="font-medium mt-1">
                    {item.movement_date}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Склад</span>
                  <div className="font-medium mt-1">
                    {getStorageAddress(item.storage_location_id)}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Причина</span>
                  <div className="font-medium mt-1">
                    {item.reason || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Ответственный</span>
                  <div className="font-medium mt-1">
                    {item.user ? `${item.user.last_name} ${item.user.first_name}${item.user.patronymic ? ` ${item.user.patronymic}` : ''}` : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Состояние запчасти</span>
                  <div className="font-medium mt-1">
                    {item.product?.is_new ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Новый
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Б/у
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Автомобиль(и) */}
              {item.product?.compatible_vehicles && item.product.compatible_vehicles.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500">Автомобиль</span>
                  <div className="mt-2 space-y-3">
                    {item.product.compatible_vehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 bg-white rounded border"
                      >
                        <div>
                          <span className="text-xs text-gray-500">Марка</span>
                          <div className="font-medium">{vehicle.brand}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Модель</span>
                          <div className="font-medium">{vehicle.model}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Поколение</span>
                          <div className="font-medium">{vehicle.generation || '—'}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Двигатель</span>
                          <div className="font-medium">{vehicle.engine || '—'}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">КПП</span>
                          <div className="font-medium">{vehicle.transmission || '—'}</div>
                        </div>
                        {vehicle.vin && (
                          <div>
                            <span className="text-xs text-gray-500">VIN</span>
                            <div className="font-medium">{vehicle.vin}</div>
                          </div>
                        )}
                        {vehicle.mileage && (
                          <div>
                            <span className="text-xs text-gray-500">Пробег</span>
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
        </td>
      </tr>
    )}

</React.Fragment>
  );
};
