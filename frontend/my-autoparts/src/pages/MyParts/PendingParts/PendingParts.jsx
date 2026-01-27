import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { normalizeImageUrl } from '../../../utils/apiClient';

const PendingParts = ({ pendingParts, rejectedParts, loading, error, onImageClick, getStorageAddress, productStorageCells = {} }) => {
  const [expandedPartId, setExpandedPartId] = useState(null);
  
  const toggleExpand = (id) => {
    setExpandedPartId(expandedPartId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="mt-8 text-center py-16 px-6">
        <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <h2 className="text-xl font-medium text-gray-900 mb-2">Загрузка запчастей на модерации...</h2>
        <p className="text-gray-600 text-base">Пожалуйста, подождите</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 text-center py-16 px-6">
        <div className="bg-red-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-medium text-gray-900 mb-2">Ошибка загрузки запчастей</h2>
        <p className="text-gray-500 mb-6 text-base">{error}</p>
      </div>
    );
  }

  const allParts = [...(pendingParts || []), ...(rejectedParts || [])];
  
  if (allParts.length === 0) {
    return (
      <div className="mt-12 text-center py-16 px-6">
        <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Запчастей на модерации нет</h2>
        <p className="text-gray-600 text-base mb-6">
          У вас пока нет запчастей на модерации или отклоненных запчастей
        </p>
      </div>
    );
  }

  // Compact card component optimized for mobile
  const CardPart = ({ part }) => {
    const isExpanded = expandedPartId === part.id;
    
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
           onClick={() => toggleExpand(part.id)}>
        <div className="p-4 sm:p-5">
          {/* Header - Compact on mobile */}
          <div className="mb-3 sm:mb-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-900">
                {part.brand} · {part.article}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                part.rejection_reason ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {part.rejection_reason ? 'Отклонена' : 'На модерации'}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 line-clamp-2">
              {part.name}
            </h3>
          </div>

          {/* Description - Truncated */}
          {part.description && (
            <div className="mb-3 sm:mb-4">
              <p className="text-sm text-gray-600 line-clamp-2">
                {part.description}
              </p>
            </div>
          )}

          {/* Details Grid - Compact spacing */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm mb-3 sm:mb-4">
            <div>
              <span className="text-gray-500 text-xs">Цена:</span>
              <div className="font-medium text-gray-900">
                {part.price != null && !isNaN(parseFloat(part.price)) ? `${parseFloat(part.price).toFixed(2)} ₽` : '—'}
              </div>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Количество:</span>
              <div className="font-medium text-gray-900">
                {part.quantity || 0} шт.
              </div>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500 text-xs">Склад:</span>
              <div className="font-medium text-gray-900">
                {getStorageAddress(part.storage_location_id)}
              </div>
            </div>
          </div>

          {/* Expand Indicator */}
          <div className="pt-3 sm:pt-4 border-t border-gray-100">
            <div className="text-center text-indigo-600 text-sm font-medium">
              {isExpanded ? 'Скрыть детали' : 'Показать детали'}
            </div>
          </div>
        </div>

        {/* Expanded Details - Everything here including rejection reason and photos */}
        {isExpanded && (
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-gray-100 pt-4 sm:pt-5 bg-gray-50">
            <div className="space-y-4">
              {/* Full Details */}
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500">Внутренний код:</span>
                  <div className="font-mono text-sm">{part.internal_code || '—'}</div>
                </div>
                
                <div>
                  <span className="text-sm font-medium text-gray-500">Полное описание:</span>
                  <div className="text-sm">{part.description || '—'}</div>
                </div>
                
                {/* Rejection Reason - Only in expanded view */}
                {part.rejection_reason && (
                  <div className="p-3 bg-red-50 rounded-lg">
                    <span className="text-sm font-medium text-red-800">Причина отклонения:</span>
                    <p className="text-sm text-red-700 mt-1">{part.rejection_reason}</p>
                  </div>
                )}
                
                {part.vehicle_ids && part.vehicle_ids.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Совместимые авто:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {part.vehicle_ids.map((vehicleId, index) => (
                        <span key={index} className="inline-block bg-gray-100 rounded px-2 py-1 text-xs">
                          Авто #{vehicleId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Compact Photo Gallery - Only in expanded view */}
              {part.photos && part.photos.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-500 block mb-2">
                    Фотографии ({part.photos.length}):
                  </span>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-3 sm:gap-2">
                    {part.photos.map((photo, index) => (
                      <img
                        key={index}
                        src={normalizeImageUrl(photo)}
                        alt={`Фото ${index + 1}`}
                        className="w-full h-16 sm:h-20 md:h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onImageClick(part.photos, index);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {allParts.map((part) => (
        <CardPart key={part.id} part={part} />
      ))}
    </div>
  );
};

export default PendingParts;