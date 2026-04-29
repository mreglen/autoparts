import React, { useState, useEffect } from 'react';
import PhotoThumbnail from '../../components/PhotoGallery/PhotoThumbnail';

export const StockOutRow = ({ item, getStorageAddress, onToggleExpand, isExpanded, onImageClick, isSelected, onSelect, onReturn }) => {
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);

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
        className="px-2 sm:px-6 py-4 whitespace-nowrap border-r border-gray-200"
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
      <td 
        className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 cursor-pointer"
        onClick={onToggleExpand}
      >
        {item.product?.brand || '—'}
      </td>
      <td 
        className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono cursor-pointer"
        onClick={onToggleExpand}
      >
        {item.product?.article || '—'}
      </td>
      <td 
        className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono cursor-pointer"
        onClick={onToggleExpand}
      >
        {item.product?.internal_code || '—'}
      </td>
      <td 
        className="px-2 sm:px-6 py-4 text-sm text-gray-500 max-w-0 truncate sm:max-w-none sm:whitespace-normal cursor-pointer"
        onClick={onToggleExpand}
      >
        {item.product?.name || '—'}
      </td>
      <td 
        className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex flex-col gap-1">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.sale_price > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {item.sale_price > 0 ? 'Продажа' : 'Списание'}
          </span>
          {item.sale_channel === 'avito' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Продано через Авито
            </span>
          )}
          {item.sale_channel === 'drom' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Продано через Drom
            </span>
          )}
        </div>
      </td>
      <td 
        className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
        onClick={onToggleExpand}
      >
        {item.quantity}
      </td>
      <td 
        className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
        onClick={onToggleExpand}
      >
        {item.sale_price != null ? `${item.sale_price.toFixed(2)} ₽` : '—'}
      </td>
      <td 
        className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
        onClick={onToggleExpand}
      >
        {item.movement_date}
      </td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <div className="relative actions-dropdown">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowActionsDropdown(!showActionsDropdown);
            }}
            className="text-gray-600 hover:text-gray-800 text-xs sm:text-sm font-medium border-2 border-gray-400 rounded px-2 py-1 bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-1"
          >
            Действия
            <img
              src="/img/arrow_sm.svg"
              alt=""
              className={`w-3 h-3 transition-transform duration-200 filter brightness-0 ${showActionsDropdown ? 'rotate-90' : ''}`}
              style={{ filter: 'brightness(0) saturate(100%) invert(61%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(89%)' }}
            />
          </button>

          {showActionsDropdown && (
            <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10 actions-dropdown">
              <div className="py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReturn(item);
                    setShowActionsDropdown(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900"
                >
                  Вернуть
                </button>
              </div>
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
                  {item.product?.description || '—'}
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
