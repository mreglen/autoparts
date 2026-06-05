import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Navigate, useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import PhotoThumbnail from '../../components/PhotoGallery/PhotoThumbnail';
import MediaModal from '../../components/MediaModal/MediaModal';
import { normalizeImageUrl, apiRequest } from '../../utils/apiClient';
import { stripHtmlTags } from '../../utils/text';
import { fetchMyProducts, fetchMyPendingProducts, fetchMyRejectedProducts, deletePendingProduct, deleteRejectedProduct, updateProductQuantityAPI } from '../../redux/slices/ProductSlice';
import { createStockOut } from '../../redux/slices/StockOutSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import { fetchProductStorageCells, fetchStorageCells } from '../../redux/slices/StorageCellsSlice';
import StockOutModal from './StockOutModal/StockOutModal';
import PrintReceiptModal from './PrintReceiptModal/PrintReceiptModal';
import { useActionsDropdownPlacement } from '../../hooks/useActionsDropdownPlacement';
import { buildActionsDropdownMenuClassName } from '../../utils/actionsDropdownPlacement';
import StorageCellsDisplayTable from '../../components/StorageCellsTable/StorageCellsDisplayTable';

const CardPart = ({
  part,
  variant = 'stock',
  moderationKind = 'pending',
  getStorageAddress,
  getCellName,
  onSale,
  onWriteoff,
  onPrint,
  onDelete,
  onEdit,
  onExport,
  showExport,
  onExportDrom,
  showDromExport,
  onToggleExpand,
  isExpanded,
  onImageClick,
  isSelected,
  onSelect,
  productStorageCells = [],
  imageErrors = {},
  onImageError,
  renderMode = 'table',
}) => {
  const [showActions, setShowActions] = useState(false);
  const isModeration = variant === 'moderation';
  const isRejectedModeration = isModeration && moderationKind === 'rejected';
  const expandedColSpan = isModeration ? 7 : 8;
  const actionsMenuHeight = isRejectedModeration ? 120 : isModeration ? 160 : showExport && showDromExport ? 360 : showExport || showDromExport ? 300 : 260;
  const desktopActionsPlacement = useActionsDropdownPlacement(showActions, actionsMenuHeight);
  const mobileActionsPlacement = useActionsDropdownPlacement(showActions, actionsMenuHeight);

  const renderActionsMenu = (menuClassName) => (
    <div className={menuClassName}>
      {isRejectedModeration ? (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(part); setShowActions(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Редактировать
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(part); setShowActions(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Удалить
          </button>
        </>
      ) : isModeration ? (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onPrint(part); setShowActions(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Печать
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(part); setShowActions(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Редактировать
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(part); setShowActions(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Удалить
          </button>
        </>
      ) : (
        <>
      <button
        onClick={(e) => { e.stopPropagation(); onPrint(part); setShowActions(false); }}
        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Печать
      </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSale(part); setShowActions(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Продать
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onWriteoff(part); setShowActions(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Списать
          </button>
          {showExport && (
            <button
              onClick={(e) => { e.stopPropagation(); onExport(part); setShowActions(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <img src="/logos/avito.png" alt="" className="w-4 h-4" />
              Экспорт Avito
            </button>
          )}
          {showDromExport && (
            <button
              onClick={(e) => { e.stopPropagation(); onExportDrom(part); setShowActions(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <img src="/logos/drom.png" alt="" className="w-4 h-4" />
              Экспорт Drom
            </button>
          )}
          <div className="border-t border-gray-100 my-1"></div>
          <Link
            to={`/my-parts/edit/${part.id}`}
            onClick={(e) => { e.stopPropagation(); setShowActions(false); }}
            className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Редактировать
          </Link>
        </>
      )}
    </div>
  );

  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.actions-dropdown')) {
        setShowActions(false);
      }
    };

    if (showActions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActions]);

  // Get first photo for card preview
  const firstPhoto = part.photos && part.photos.length > 0 
    ? (typeof part.photos[0] === 'string' ? part.photos[0] : part.photos[0].photo_url || part.photos[0].full_url || '')
    : null;
  const normalizedPhotoUrl = firstPhoto ? normalizeImageUrl(firstPhoto) : null;
  const hasImageError = imageErrors[part.id];

  return (
  <React.Fragment>
    {/* Desktop table row */}
    {renderMode === 'table' && (
    <tr className="group hover:bg-gray-50/50 transition-all duration-200 border-b border-gray-100">
      {!isModeration && (
        <td className="px-4 py-4 whitespace-nowrap">
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
      )}
      
      {/* Product info cell with image */}
      <td className="px-4 py-4" colSpan={4}>
        <div className="flex items-start gap-4">
          {/* Product image */}
          <div 
            className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 cursor-pointer" 
            onClick={onToggleExpand}
          >
            {normalizedPhotoUrl && !hasImageError ? (
              <img 
                src={normalizedPhotoUrl} 
                alt={part.name}
                className="w-full h-full object-cover"
                onError={() => onImageError(part.id)}
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
              <span className="text-base font-semibold text-gray-900">{part.brand || '—'}</span>
              <span className="text-sm text-gray-400">•</span>
              <span className="text-sm text-gray-500 font-mono">{part.article || '—'}</span>
            </div>
            {part.internal_code && (
              <div className="text-xs text-gray-500 mb-1">
                Внутренний код: <span className="font-mono">{part.internal_code}</span>
              </div>
            )}
            <h3 className="text-sm font-medium text-gray-800 mb-2 line-clamp-2">{part.name || '—'}</h3>
            
            {/* Status badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {isModeration ? (
                isRejectedModeration ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Отклонена
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    На модерации
                  </span>
                )
              ) : (
                <>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    part.is_new ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {part.is_new ? 'Новый' : 'Б/у'}
                  </span>
                  <div className="flex items-center gap-1">
                    <img
                      src="/logos/svoygarage.png"
                      alt="Свой Гараж"
                      className="w-4 h-4 object-contain"
                      title="Свой Гараж"
                    />
                    {part.is_on_avito && (
                      <img
                        src="/logos/avito.png"
                        alt="Avito"
                        className="w-4 h-4 object-contain"
                        title="Avito"
                      />
                    )}
                    {part.is_on_drom && (
                      <img
                        src="/logos/drom.png"
                        alt="Drom"
                        className="w-4 h-4 object-contain"
                        title="Drom"
                      />
                    )}
                  </div>
                </>
              )}
            </div>

            {productStorageCells?.length > 0 && (
              <div className="mt-2 max-w-lg" onClick={(e) => e.stopPropagation()}>
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Адресное хранение
                </div>
                <StorageCellsDisplayTable
                  productStorageCells={productStorageCells}
                  getCellName={getCellName}
                  compact
                />
              </div>
            )}
          </div>
        </div>
      </td>
      
      {/* Quantity and Price */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-center">
          <div className="text-sm font-medium text-gray-900">{part.quantity || 0}</div>
          <div className="text-xs text-gray-500">шт.</div>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-base font-bold text-gray-900">
          {part.price != null && !isNaN(parseFloat(part.price)) ? `${parseFloat(part.price).toLocaleString('ru-RU')} ₽` : '—'}
        </div>
      </td>
      
      {/* Actions */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div ref={desktopActionsPlacement.anchorRef} className="relative actions-dropdown">
          <button
            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
            <span className="hidden sm:inline">Действия</span>
          </button>

          {showActions && renderActionsMenu(buildActionsDropdownMenuClassName(desktopActionsPlacement.openUp, 'w-48 z-50'))}
        </div>
      </td>
    </tr>
    )}

    {/* Mobile card version */}
    {renderMode === 'card' && (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-3">
      <div className={`flex items-center p-3 border-b border-gray-100 ${isModeration ? 'justify-end' : 'justify-between'}`}>
        {!isModeration && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
          />
        )}
        <div ref={mobileActionsPlacement.anchorRef} className="relative actions-dropdown">
          <button
            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
            <span>Действия</span>
          </button>

          {showActions && renderActionsMenu(buildActionsDropdownMenuClassName(mobileActionsPlacement.openUp, 'w-48 z-50'))}
        </div>
      </div>

      {/* Main card content */}
      <div className="p-4 cursor-pointer" onClick={onToggleExpand}>
        <div className="flex gap-3">
          {/* Product image */}
          <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
            {normalizedPhotoUrl && !hasImageError ? (
              <img 
                src={normalizedPhotoUrl} 
                alt={part.name}
                className="w-full h-full object-cover"
                onError={() => onImageError(part.id)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-semibold text-gray-900">{part.brand || '—'}</span>
                  <span className="text-sm text-gray-400">•</span>
                  <span className="text-sm text-gray-500 font-mono">{part.article || '—'}</span>
                </div>
                {part.internal_code && (
                  <div className="text-xs text-gray-500 mb-1">
                    Внутренний код: <span className="font-mono">{part.internal_code}</span>
                  </div>
                )}
                <h3 className="text-sm font-medium text-gray-800 line-clamp-2">{part.name || '—'}</h3>
              </div>
            </div>
            
            {/* Price and quantity */}
            <div className="flex items-center justify-between mt-3">
              <div className="text-base font-bold text-gray-900">
                {part.price != null && !isNaN(parseFloat(part.price)) ? `${parseFloat(part.price).toLocaleString('ru-RU')} ₽` : '—'}
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900">{part.quantity || 0}</div>
                <div className="text-xs text-gray-500">шт.</div>
              </div>
            </div>

            {/* Status / platforms */}
            <div className="flex items-center gap-2 mt-2">
              {isModeration ? (
                isRejectedModeration ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Отклонена
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    На модерации
                  </span>
                )
              ) : (
                <>
                  <img
                    src="/logos/svoygarage.png"
                    alt="Свой Гараж"
                    className="w-4 h-4 object-contain"
                    title="Свой Гараж"
                  />
                  {part.is_on_avito && (
                    <img
                      src="/logos/avito.png"
                      alt="Avito"
                      className="w-4 h-4 object-contain"
                      title="Avito"
                    />
                  )}
                  {part.is_on_drom && (
                    <img
                      src="/logos/drom.png"
                      alt="Drom"
                      className="w-4 h-4 object-contain"
                      title="Drom"
                    />
                  )}
                </>
              )}
            </div>

            {productStorageCells?.length > 0 && (
              <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Адресное хранение
                </div>
                <StorageCellsDisplayTable
                  productStorageCells={productStorageCells}
                  getCellName={getCellName}
                  compact
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expandable details */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
          <div className="space-y-4">
            {/* Status */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Состояние</h4>
              {isModeration ? (
                isRejectedModeration ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Отклонена
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    На модерации
                  </span>
                )
              ) : (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  part.is_new ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {part.is_new ? 'Новый' : 'Б/у'}
                </span>
              )}
            </div>

            {/* Description */}
            {part.description && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Описание</h4>
                <p className="text-sm text-gray-900 leading-relaxed">{stripHtmlTags(part.description)}</p>
              </div>
            )}

            {isRejectedModeration && part.rejection_reason && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                <h4 className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-1">Причина отклонения</h4>
                <p className="text-sm text-red-700">{part.rejection_reason}</p>
              </div>
            )}

            {/* Storage info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Склад</h4>
                <p className="text-sm text-gray-900">
                  {part.storage_location_id ? getStorageAddress(part.storage_location_id) : '—'}
                </p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ответственный</h4>
                <p className="text-sm text-gray-900">{part.creator_name || '—'}</p>
              </div>
            </div>

            {/* Photos and Videos */}
            <PhotoThumbnail 
              photos={part.photos || []} 
              videos={part.videos || []}
              onImageClick={onImageClick}
            />

            {/* Compatible Vehicles */}
            {part.compatible_vehicles && part.compatible_vehicles.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Совместимые автомобили</h4>
                <div className="space-y-3">
                  {part.compatible_vehicles.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs text-gray-500">Марка</span>
                          <p className="text-sm font-medium text-gray-900">{vehicle.brand}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Модель</span>
                          <p className="text-sm font-medium text-gray-900">{vehicle.model}</p>
                        </div>
                        {vehicle.generation && (
                          <div>
                            <span className="text-xs text-gray-500">Поколение</span>
                            <p className="text-sm font-medium text-gray-900">{vehicle.generation}</p>
                          </div>
                        )}
                        {vehicle.engine && (
                          <div>
                            <span className="text-xs text-gray-500">Двигатель</span>
                            <p className="text-sm font-medium text-gray-900">{vehicle.engine}</p>
                          </div>
                        )}
                        {vehicle.transmission && (
                          <div>
                            <span className="text-xs text-gray-500">КПП</span>
                            <p className="text-sm font-medium text-gray-900">{vehicle.transmission}</p>
                          </div>
                        )}
                        {vehicle.vin && (
                          <div>
                            <span className="text-xs text-gray-500">VIN</span>
                            <p className="text-sm font-medium font-mono text-gray-900">{vehicle.vin}</p>
                          </div>
                        )}
                        {vehicle.mileage && (
                          <div>
                            <span className="text-xs text-gray-500">Пробег</span>
                            <p className="text-sm font-medium text-gray-900">{vehicle.mileage.toLocaleString()} км</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    )}

    {/* Expandable details row for desktop */}
    {renderMode === 'table' && isExpanded && (
      <tr className="bg-gray-50/50">
        <td colSpan={expandedColSpan} className="px-6 py-6 border-t border-gray-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Photos and Videos */}
            <div>
              <PhotoThumbnail 
                photos={part.photos || []} 
                videos={part.videos || []}
                onImageClick={onImageClick}
              />
            </div>

            {/* Description and Info */}
            <div className="space-y-5">
              {/* Description */}
              {part.description && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Описание</h4>
                  <p className="text-sm text-gray-900 leading-relaxed">{stripHtmlTags(part.description)}</p>
                </div>
              )}

              {/* Additional Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Состояние</h4>
                  {isModeration ? (
                    isRejectedModeration ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Отклонена
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        На модерации
                      </span>
                    )
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      part.is_new ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {part.is_new ? 'Новый' : 'Б/у'}
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Склад</h4>
                  <p className="text-sm text-gray-900">
                    {part.storage_location_id ? getStorageAddress(part.storage_location_id) : '—'}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ответственный</h4>
                  <p className="text-sm text-gray-900">{part.creator_name || '—'}</p>
                </div>
              </div>

              {/* Compatible Vehicles */}
              {part.compatible_vehicles && part.compatible_vehicles.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Совместимые автомобили</h4>
                  <div className="space-y-3">
                    {part.compatible_vehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className="p-4 bg-white rounded-lg border border-gray-200"
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-xs text-gray-500">Марка</span>
                            <p className="text-sm font-medium text-gray-900">{vehicle.brand}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Модель</span>
                            <p className="text-sm font-medium text-gray-900">{vehicle.model}</p>
                          </div>
                          {vehicle.generation && (
                            <div>
                              <span className="text-xs text-gray-500">Поколение</span>
                              <p className="text-sm font-medium text-gray-900">{vehicle.generation}</p>
                            </div>
                          )}
                          {vehicle.engine && (
                            <div>
                              <span className="text-xs text-gray-500">Двигатель</span>
                              <p className="text-sm font-medium text-gray-900">{vehicle.engine}</p>
                            </div>
                          )}
                          {vehicle.transmission && (
                            <div>
                              <span className="text-xs text-gray-500">КПП</span>
                              <p className="text-sm font-medium text-gray-900">{vehicle.transmission}</p>
                            </div>
                          )}
                          {vehicle.vin && (
                            <div>
                              <span className="text-xs text-gray-500">VIN</span>
                              <p className="text-sm font-medium font-mono text-gray-900">{vehicle.vin}</p>
                            </div>
                          )}
                          {vehicle.mileage && (
                            <div>
                              <span className="text-xs text-gray-500">Пробег</span>
                              <p className="text-sm font-medium text-gray-900">{vehicle.mileage.toLocaleString()} км</p>
                            </div>
                          )}
                        </div>
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

const DEFAULT_IN_STOCK_FILTERS = { search: '', storage: '', sort: 'date_desc' };
const DEFAULT_MODERATION_FILTERS = { search: '', storage: '', sort: 'date_desc', hideRejected: false };

const getModerationPartKey = (part) => `${part.moderationKind || 'pending'}-${part.id}`;

const normalizeInternalCodeForSearch = (code) => {
  if (code == null || code === '') return '';
  if (typeof code === 'object') {
    return String(code.code || code.id || '');
  }
  return String(code);
};

function MyParts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const { items: products, pendingItems, rejectedItems, loading, error } = useSelector((state) => state.products);
  const [authChecked, setAuthChecked] = useState(false);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationLoadError, setModerationLoadError] = useState(null);
  const [pendingStorageCellsByProduct, setPendingStorageCellsByProduct] = useState({});

  const { storageLocations } = useSelector((state) => state.organization);
  const { productStorageCells, storageCells, lastModified } = useSelector((state) => state.storageCells);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [operationType, setOperationType] = useState(null);
  const [expandedPartId, setExpandedPartId] = useState(null);
  const [selectedParts, setSelectedParts] = useState(new Set());
  const [mobileActionsOpen, setMobileActionsOpen] = useState(null); // ID запчасти с открытым меню действий
  const [showBulkActions, setShowBulkActions] = useState(false);
  const bulkActionsPlacement = useActionsDropdownPlacement(showBulkActions, 130);
  const mobileBulkActionsPlacement = useActionsDropdownPlacement(showBulkActions, 130);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'in-stock');
  const [inStockFilters, setInStockFilters] = useState(() => ({
    ...DEFAULT_IN_STOCK_FILTERS,
    search: searchParams.get('tab') === 'pending' ? '' : (searchParams.get('q') || ''),
    storage: searchParams.get('tab') === 'pending' ? '' : (searchParams.get('storage') || ''),
  }));
  const [moderationFilters, setModerationFilters] = useState(() => ({
    ...DEFAULT_MODERATION_FILTERS,
    search: searchParams.get('tab') === 'pending' ? (searchParams.get('q') || '') : '',
    storage: searchParams.get('tab') === 'pending' ? (searchParams.get('storage') || '') : '',
    hideRejected: searchParams.get('hide_rejected') === '1',
  }));

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'pending' || tab === 'in-stock') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const isModerationTab = activeTab === 'pending';
  const activeFilters = isModerationTab ? moderationFilters : inStockFilters;
  const updateActiveFilters = (patch) => {
    if (isModerationTab) {
      setModerationFilters((prev) => ({ ...prev, ...patch }));
    } else {
      setInStockFilters((prev) => ({ ...prev, ...patch }));
    }
  };
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [currentMediaItems, setCurrentMediaItems] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [avitoIntegrationReady, setAvitoIntegrationReady] = useState(false);
  const [avitoJob, setAvitoJob] = useState(null);
  const [dromIntegrationReady, setDromIntegrationReady] = useState(false);
  const [imageErrors, setImageErrors] = useState({}); // Track image errors by part ID
  const [formData, setFormData] = useState({
    quantity: '',
    price: '',
    reason: '',
  });

  // Сортировка: по умолчанию сначала новые
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const displayParts = React.useMemo(() => products.filter((part) => {
    if (inStockFilters.storage && part.storage_location_id != inStockFilters.storage) {
      return false;
    }
    if (!inStockFilters.search.trim()) return true;
    const query = inStockFilters.search.toLowerCase().replace(/\s+/g, '');
    return (
      (part.article && part.article.toLowerCase().replace(/\s+/g, '').includes(query)) ||
      (normalizeInternalCodeForSearch(part.internal_code).toLowerCase().replace(/\s+/g, '').includes(query)) ||
      (part.name && part.name.toLowerCase().includes(inStockFilters.search.toLowerCase()))
    );
  }), [products, inStockFilters]);

  const sortedDisplayParts = React.useMemo(() => {
    const items = [...displayParts];
    const sortOrder = inStockFilters.sort;

    if (sortOrder === 'date_desc') {
      items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortOrder === 'date_asc') {
      items.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else if (sortOrder === 'name_asc' || sortOrder === 'name_desc') {
      items.sort((a, b) => {
        const aName = (a.name || a.brand || a.article || '').toString().toLowerCase();
        const bName = (b.name || b.brand || b.article || '').toString().toLowerCase();
        if (aName < bName) return sortOrder === 'name_asc' ? -1 : 1;
        if (aName > bName) return sortOrder === 'name_asc' ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [displayParts, inStockFilters.sort]);

  const displayModerationParts = React.useMemo(() => {
    let items = [
      ...(pendingItems || []).map((part) => ({ ...part, moderationKind: 'pending' })),
      ...(rejectedItems || []).map((part) => ({ ...part, moderationKind: 'rejected' })),
    ];

    if (moderationFilters.hideRejected) {
      items = items.filter((part) => part.moderationKind !== 'rejected');
    }

    if (moderationFilters.storage) {
      items = items.filter((part) => String(part.storage_location_id) === String(moderationFilters.storage));
    }

    if (!moderationFilters.search.trim()) return items;

    const query = moderationFilters.search.toLowerCase().replace(/\s+/g, '');
    return items.filter((part) =>
      (part.article && part.article.toLowerCase().replace(/\s+/g, '').includes(query)) ||
      (normalizeInternalCodeForSearch(part.internal_code).toLowerCase().replace(/\s+/g, '').includes(query)) ||
      (part.name && part.name.toLowerCase().includes(moderationFilters.search.toLowerCase()))
    );
  }, [pendingItems, rejectedItems, moderationFilters]);

  const sortedModerationParts = React.useMemo(() => {
    const items = [...displayModerationParts];
    const sortOrder = moderationFilters.sort;

    if (sortOrder === 'date_desc') {
      items.sort((a, b) => {
        const aDate = a.moderationKind === 'rejected' ? (a.rejected_at || a.created_at) : a.created_at;
        const bDate = b.moderationKind === 'rejected' ? (b.rejected_at || b.created_at) : b.created_at;
        return new Date(bDate || 0) - new Date(aDate || 0);
      });
    } else if (sortOrder === 'date_asc') {
      items.sort((a, b) => {
        const aDate = a.moderationKind === 'rejected' ? (a.rejected_at || a.created_at) : a.created_at;
        const bDate = b.moderationKind === 'rejected' ? (b.rejected_at || b.created_at) : b.created_at;
        return new Date(aDate || 0) - new Date(bDate || 0);
      });
    } else if (sortOrder === 'name_asc' || sortOrder === 'name_desc') {
      items.sort((a, b) => {
        const aName = (a.name || a.brand || a.article || '').toString().toLowerCase();
        const bName = (b.name || b.brand || b.article || '').toString().toLowerCase();
        if (aName < bName) return sortOrder === 'name_asc' ? -1 : 1;
        if (aName > bName) return sortOrder === 'name_asc' ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [displayModerationParts, moderationFilters.sort]);

  const moderationItemsCount = (pendingItems?.length || 0) + (rejectedItems?.length || 0);

  const statsParts = isModerationTab ? sortedModerationParts : sortedDisplayParts;
  const totalValue = statsParts.reduce((sum, part) => sum + ((Number(part.price) || 0) * (Number(part.quantity) || 0)), 0);
  const totalQuantity = statsParts.reduce((sum, part) => sum + (Number(part.quantity) || 0), 0);

  const handleOpenModal = (part, type) => {
    setSelectedPart(part);
    setOperationType(type);
    setModalOpen(true);
  };

  const handleOpenPrintModal = (part) => {
    if (activeTab === 'pending') {
      setSelectedPart({
        ...part,
        moderationKind: part.moderationKind || 'pending',
      });
    } else {
      const { moderationKind: _ignored, ...stockPart } = part;
      setSelectedPart(stockPart);
    }
    setPrintModalOpen(true);
  };

  const handleDeletePending = async (part) => {
    if (!part?.id) return;
    if (!window.confirm('Удалить запчасть с модерации?')) return;

    try {
      await dispatch(deletePendingProduct(part.id)).unwrap();
      const partKey = getModerationPartKey(part);
      if (selectedPart?.id === part.id && selectedPart?.moderationKind !== 'rejected') {
        setPrintModalOpen(false);
        setSelectedPart(null);
      }
      if (expandedPartId === partKey) {
        setExpandedPartId(null);
      }
      setPendingStorageCellsByProduct((prev) => {
        const next = { ...prev };
        delete next[part.id];
        return next;
      });
    } catch (err) {
      alert(typeof err === 'string' ? err : 'Не удалось удалить запчасть с модерации');
    }
  };

  const handleDeleteRejected = async (part) => {
    if (!part?.id) return;
    if (!window.confirm('Удалить отклонённую запчасть?')) return;

    try {
      await dispatch(deleteRejectedProduct(part.id)).unwrap();
      const partKey = getModerationPartKey(part);
      if (expandedPartId === partKey) {
        setExpandedPartId(null);
      }
    } catch (err) {
      alert(typeof err === 'string' ? err : 'Не удалось удалить отклонённую запчасть');
    }
  };

  const handleEditRejected = (part) => {
    if (!part?.id) return;
    navigate(`/my-parts/resubmit/${part.id}`);
  };

  const handleEditPending = (part) => {
    if (!part?.id) return;
    navigate(`/my-parts/edit-pending/${part.id}`);
  };

  const handleModerationEdit = (part) => {
    if (part.moderationKind === 'rejected') {
      handleEditRejected(part);
      return;
    }
    handleEditPending(part);
  };

  const handleModerationDelete = (part) => {
    if (part.moderationKind === 'rejected') {
      handleDeleteRejected(part);
      return;
    }
    handleDeletePending(part);
  };

  const getStorageCellsForPart = (part, isPending = false) => {
    if (!part?.id) return [];
    if (isPending) {
      return pendingStorageCellsByProduct[part.id] || [];
    }
    return productStorageCells[part.id] || [];
  };

  const handleOpenMediaModal = (mediaItems, initialIndex = 0) => {
    console.log('Opening media modal with:', mediaItems, 'at index:', initialIndex);
    
    // Convert media items to format expected by MediaModal
    const formattedMedia = mediaItems.map(item => {
      const url = typeof item === 'string' ? item : (item.full_url || item.photo_url || item.video_url || '');
      console.log('Processing item:', item, 'URL before normalize:', url);
      // Normalize the URL to add backend base URL if needed
      const normalizedUrl = normalizeImageUrl(url);
      console.log('Normalized URL:', normalizedUrl);
      // Determine if it's a video or photo based on URL extension or item type
      const isVideo = normalizedUrl.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/);
      return {
        type: isVideo ? 'video' : 'image',
        src: normalizedUrl
      };
    });
    
    console.log('Formatted media:', formattedMedia);
    setCurrentMediaItems(formattedMedia);
    setCurrentMediaIndex(initialIndex);
    setMediaModalOpen(true);
  };

  const toggleExpand = (id) => {
    setExpandedPartId(expandedPartId === id ? null : id);
  };

  const handlePartSelect = (partId) => {
    setSelectedParts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(partId)) {
        newSet.delete(partId);
      } else {
        newSet.add(partId);
      }
      return newSet;
    });
  };

  const allDisplayedSelected = displayParts.length > 0
    && displayParts.every((part) => selectedParts.has(part.id));

  const handleToggleSelectAllDisplayed = () => {
    if (allDisplayedSelected) {
      const newSelected = new Set(selectedParts);
      displayParts.forEach((part) => newSelected.delete(part.id));
      setSelectedParts(newSelected);
      return;
    }
    const newSelected = new Set(selectedParts);
    displayParts.forEach((part) => newSelected.add(part.id));
    setSelectedParts(newSelected);
  };

  // Функция для переключения мобильного меню действий
  const toggleMobileActions = (partId) => {
    setMobileActionsOpen(mobileActionsOpen === partId ? null : partId);
  };

  // Закрытие мобильного меню действий при клике вне
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.mobile-actions-dropdown')) {
        setMobileActionsOpen(null);
      }
    };

    if (mobileActionsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mobileActionsOpen]);

  // Закрытие dropdown массовых действий при клике вне
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.actions-dropdown')) {
        setShowBulkActions(false);
      }
    };

    if (showBulkActions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBulkActions]);

  const handleExportPart = async (part) => {
    if (!user?.organization_id || !part?.id) return;
    try {
      const started = await apiRequest(`/organizations/${user.organization_id}/avito/autoload/export-async`, {
        method: 'POST',
        body: JSON.stringify({ product_ids: [part.id] }),
      });
      setAvitoJob(started);
    } catch (e) {
      alert(`Не удалось экспортировать: ${e.message || 'ошибка'}`);
    }
  };

  const handleExportPartDrom = async (part) => {
    if (!user?.organization_id || !part?.id) return;
    try {
      await apiRequest(`/organizations/${user.organization_id}/drom/autoload/export`, {
        method: 'POST',
        body: JSON.stringify({ product_ids: [part.id] }),
      });
      alert('Товар экспортирован в Drom');
    } catch (e) {
      alert(`Не удалось экспортировать в Drom: ${e.message || 'ошибка'}`);
    }
  };

  const handleBulkAction = async () => {
    if (!user?.organization_id || selectedParts.size === 0) return;
    try {
      const started = await apiRequest(`/organizations/${user.organization_id}/avito/autoload/export-async`, {
        method: 'POST',
        body: JSON.stringify({ product_ids: Array.from(selectedParts) }),
      });
      setAvitoJob(started);
    } catch (e) {
      alert(`Не удалось выполнить экспорт: ${e.message || 'ошибка'}`);
    }
  };

  const handleBulkExportDrom = async () => {
    if (!user?.organization_id || selectedParts.size === 0) return;
    try {
      await apiRequest(`/organizations/${user.organization_id}/drom/autoload/export`, {
        method: 'POST',
        body: JSON.stringify({ product_ids: Array.from(selectedParts) }),
      });
      alert(`Экспорт в Drom выполнен. Товаров: ${selectedParts.size}`);
    } catch (e) {
      alert(`Не удалось выполнить экспорт в Drom: ${e.message || 'ошибка'}`);
    }
  };

  const renderBulkActionsMenu = (menuClassName) => (
    <div className={menuClassName}>
      <div className="py-1">
        <button
          onClick={(e) => { e.stopPropagation(); handleBulkAction(); setShowBulkActions(false); }}
          disabled={selectedParts.size === 0}
          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <img src="/logos/avito.png" alt="" className="w-4 h-4" />
          Экспорт Avito
        </button>
        {dromIntegrationReady && (
          <button
            onClick={(e) => { e.stopPropagation(); handleBulkExportDrom(); setShowBulkActions(false); }}
            disabled={selectedParts.size === 0}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <img src="/logos/drom.png" alt="" className="w-4 h-4" />
            Экспорт Drom
          </button>
        )}
      </div>
    </div>
  );

  useEffect(() => {
    if (!avitoJob?.id || !user?.organization_id) return undefined;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const data = await apiRequest(`/organizations/${user.organization_id}/avito/autoload/jobs/${avitoJob.id}`, { method: 'GET' });
        if (!cancelled) {
          setAvitoJob(data);
          if (data.status === 'completed') {
            clearInterval(timer);
            alert(`Экспорт Avito завершен. Обработано: ${data.processed_count}/${data.total_count}`);
          } else if (data.status === 'failed') {
            clearInterval(timer);
            alert(`Экспорт Avito завершился ошибкой: ${data.error_summary || 'неизвестная ошибка'}`);
          }
        }
      } catch (e) {
        // keep polling; transient errors are tolerated
      }
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [avitoJob?.id, user?.organization_id]);

  const handleConfirm = async () => {
    if (!selectedPart || !operationType) return;

    const quantity = parseInt(formData.quantity, 10);
    if (!quantity || quantity <= 0 || quantity > selectedPart.quantity) {
    
      return;
    }

    const stockOutData = {
      product_id: selectedPart.id,
      quantity: quantity,
      storage_location_id: selectedPart.storage_location_id,
      organization_id: user.organization_id,
      user_id: user.id,
      acquired_product_id: null,
      movement_date: new Date().toISOString().split('T')[0],
      sale_price: 0,
      reason: null,
    };

    if (operationType === 'sale') {
      const price = parseFloat(formData.price);
      if (!price || price <= 0) {
      
        return;
      }
      stockOutData.sale_price = price;
    } else {
      stockOutData.reason = formData.reason || 'Списание';
    }

    try {
      await dispatch(createStockOut(stockOutData)).unwrap();

      const newQuantity = selectedPart.quantity - quantity;
      dispatch(updateProductQuantityAPI({ productId: selectedPart.id, newQuantity }));



      setModalOpen(false);
    } catch (err) {
      alert('Не удалось создать запись расхода: ' + (err.message || 'ошибка'));
    }
  };


  useEffect(() => {
    if (!modalOpen) {
      setSelectedPart(null);
      setOperationType(null);
      setFormData({ quantity: '', price: '', reason: '' });
    }
  }, [modalOpen])


  // Sync URL parameters with component state (only on /my-parts, без гонки с navigate)
  useEffect(() => {
    if (location.pathname !== '/my-parts') return;

    const params = new URLSearchParams();
    const filters = isModerationTab ? moderationFilters : inStockFilters;

    if (filters.search) {
      params.set('q', filters.search);
    }

    if (filters.storage) {
      params.set('storage', filters.storage);
    }

    if (isModerationTab) {
      params.set('tab', 'pending');
      if (moderationFilters.hideRejected) {
        params.set('hide_rejected', '1');
      }
    }

    const next = params.toString();
    const current = searchParams.toString();
    if (next === current) return;

    setSearchParams(params, { replace: true });
  }, [
    location.pathname,
    inStockFilters,
    moderationFilters,
    isModerationTab,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    const params = {};
    if (inStockFilters.storage) {
      params.storage_location_id = inStockFilters.storage;
    }

    dispatch(fetchMyProducts(params));
    if (user?.organization_id) {
      dispatch(fetchStorageLocations(user.organization_id));
      dispatch(fetchStorageCells());
    }
  }, [dispatch, user?.organization_id, inStockFilters.storage]);

  useEffect(() => {
    if (!user?.organization_id) {
      setAvitoIntegrationReady(false);
      return;
    }
    let active = true;
    apiRequest(`/organizations/${user.organization_id}/avito/credentials`, { method: 'GET' })
      .then((data) => {
        if (!active) return;
        setAvitoIntegrationReady(
          Boolean(data?.client_id)
            && Boolean(data?.client_secret_configured)
            && Boolean(data?.avito_user_id)
            && data?.enabled !== false
            && data?.pro_active !== false
        );
      })
      .catch(() => {
        if (active) setAvitoIntegrationReady(false);
      });
    return () => {
      active = false;
    };
  }, [user?.organization_id]);

  useEffect(() => {
    if (!user?.organization_id) {
      setDromIntegrationReady(false);
      return;
    }
    let active = true;
    apiRequest(`/organizations/${user.organization_id}/drom/credentials`, { method: 'GET' })
      .then((data) => {
        if (!active) return;
        setDromIntegrationReady(!!data?.is_enabled);
      })
      .catch(() => {
        if (active) setDromIntegrationReady(false);
      });
    return () => {
      active = false;
    };
  }, [user?.organization_id]);

  const loadModerationParts = React.useCallback(async () => {
    if (!user?.id) return;
    setModerationLoading(true);
    setModerationLoadError(null);
    try {
      await Promise.all([
        dispatch(fetchMyPendingProducts()).unwrap(),
        dispatch(fetchMyRejectedProducts()).unwrap(),
      ]);
    } catch (err) {
      setModerationLoadError(typeof err === 'string' ? err : 'Ошибка загрузки запчастей');
    } finally {
      setModerationLoading(false);
    }
  }, [dispatch, user?.id]);

  // Load pending and rejected products when pending tab is active
  useEffect(() => {
    if (activeTab === 'pending' && user?.id) {
      loadModerationParts();
    }
  }, [activeTab, user?.id, loadModerationParts]);

  useEffect(() => {
    if (activeTab !== 'pending' || !pendingItems?.length) return undefined;

    let cancelled = false;
    const loadPendingStorageCells = async () => {
      const entries = await Promise.all(
        pendingItems.map(async (part) => {
          if (!part?.id) return null;
          try {
            const cells = await apiRequest(`/pending-product-storage-cells/?pending_product_id=${part.id}`);
            return [part.id, Array.isArray(cells) ? cells : []];
          } catch {
            return [part.id, []];
          }
        })
      );

      if (cancelled) return;
      setPendingStorageCellsByProduct((prev) => {
        const next = { ...prev };
        entries.forEach((entry) => {
          if (!entry) return;
          const [partId, cells] = entry;
          next[partId] = cells;
        });
        return next;
      });
    };

    loadPendingStorageCells();
    return () => {
      cancelled = true;
    };
  }, [activeTab, pendingItems]);

  // Create memoized product IDs that need storage cell data
  const productIdsNeedingData = React.useMemo(() => {
    if (displayParts.length === 0 || loading) return [];
    
    const productIds = displayParts.map(part => part.id);
    return productIds.filter(productId => 
      !productStorageCells[productId] || productStorageCells[productId].length === 0
    );
  }, [displayParts.length, loading, JSON.stringify(Object.keys(productStorageCells || {}))]);

  // Fetch product storage cells for all displayed products - optimized to avoid continuous requests
  useEffect(() => {
    if (productIdsNeedingData.length > 0) {
      productIdsNeedingData.forEach(productId => {
        dispatch(fetchProductStorageCells(productId));
      });
    }
  }, [dispatch, productIdsNeedingData]);
  
  // Refresh product storage cell data when storage cells are modified
  // This ensures we get updated data after additions/deletions
  useEffect(() => {
    // Force refresh of all currently displayed product storage cell data
    if (lastModified) {
      displayParts.forEach(part => {
        if (part.id) {
          dispatch(fetchProductStorageCells(part.id));
        }
      });
      
      // Also refresh storage cells data
      dispatch(fetchStorageCells());
    }
  }, [lastModified]); // Trigger when storage cells are modified

  // Check if user has permission to view this page
  // Admin and sellers always have access
  // Employees need 'my-parts' permission code
  const hasPermission = user?.is_admin || user?.is_seller || 
    (user?.is_employee && permissionCodes && permissionCodes.includes('my-parts'));

  // Check auth - wait for user data to load
  useEffect(() => {
    if (user === undefined || user === null) {
      const token = localStorage.getItem('token');
      if (token) return;
    }
    setAuthChecked(true);
    if (!hasPermission) navigate('/', { replace: true });
  }, [user, permissionCodes, hasPermission, navigate]);

  // Show loading while auth data is loading
  if (!authChecked) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasPermission) return <Navigate to="/" replace />;

  const getStorageAddress = (locationId) => {
    if (!locationId) return '—';
    const loc = storageLocations.find(l => l.id === locationId);
    return loc ? (loc.address || `Склад #${locationId}`) : `Склад #${locationId}`;
  };

  const getCellName = (cellId) => {
    if (!cellId) return `Ячейка #${cellId}`;
    const cell = storageCells.find(c => c.id === cellId);
    return cell ? cell.name : `Ячейка #${cellId}`;
  };



  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-2xl sm:text-2xl font-bold text-gray-800">Мои запчасти</h1>
        <div className="text-left sm:text-right">
          <div className="text-xl sm:text-2xl font-bold text-gray-700">
            {totalValue.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-sm text-gray-500">
            {activeFilters.storage
              ? (isModerationTab ? 'Стоимость по складу (модерация)' : 'Общая стоимость склада')
              : (isModerationTab ? 'Стоимость на модерации' : 'Общая стоимость всех складов')}
          </div>
          <div className="text-lg font-semibold text-gray-700 mt-1">
            {totalQuantity.toLocaleString('ru-RU')} шт.
          </div>
          <div className="text-sm text-gray-500">
            {activeFilters.storage
              ? (isModerationTab ? 'Количество по складу (модерация)' : 'Общее количество склада')
              : (isModerationTab ? 'Количество на модерации' : 'Общее количество всех складов')}
          </div>
        </div>
      </div>

      {/* Фильтр по складу, поиск и сортировка */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 md:items-end">
        {/* Фильтр по складу */}
        <div className="md:w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">Склад</label>
          <select
            value={activeFilters.storage}
            onChange={(e) => updateActiveFilters({ storage: e.target.value })}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="">Все склады</option>
            {storageLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.address}
              </option>
            ))}
          </select>
        </div>
        
        {/* Поисковое поле */}
        <div className="flex-1 max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Поиск {activeFilters.storage && '(в выбранном складе)'}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Поиск по номеру, внутр. коду или названию..."
              value={activeFilters.search}
              onChange={(e) => updateActiveFilters({ search: e.target.value })}
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
            {activeFilters.search && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  onClick={() => updateActiveFilters({ search: '' })}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {isModerationTab && (
          <div className="md:w-auto flex items-end">
            <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md bg-white cursor-pointer min-h-[40px]">
              <input
                type="checkbox"
                checked={moderationFilters.hideRejected}
                onChange={(e) => updateActiveFilters({ hideRejected: e.target.checked })}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 whitespace-nowrap">Скрыть отклонённые</span>
            </label>
          </div>
        )}

        {/* Сортировка */}
        <div className="md:w-64 relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Сортировка
          </label>
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="w-full px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-between gap-2 bg-gray-200 text-gray-700 hover:bg-gray-300 min-h-[40px]"
            title="Сортировка"
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              <span>Выбор порядка</span>
            </span>
            <svg className={`w-4 h-4 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showSortDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-30">
              <button
                onClick={() => { updateActiveFilters({ sort: 'date_desc' }); setShowSortDropdown(false); }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${activeFilters.sort === 'date_desc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
              >
                <div className="flex items-center justify-between">
                  <span>Сначала новые</span>
                  {activeFilters.sort === 'date_desc' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
              <button
                onClick={() => { updateActiveFilters({ sort: 'date_asc' }); setShowSortDropdown(false); }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${activeFilters.sort === 'date_asc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
              >
                <div className="flex items-center justify-between">
                  <span>Сначала старые</span>
                  {activeFilters.sort === 'date_asc' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
              <button
                onClick={() => { updateActiveFilters({ sort: 'name_asc' }); setShowSortDropdown(false); }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${activeFilters.sort === 'name_asc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
              >
                <div className="flex items-center justify-between">
                  <span>По алфавиту (А–Я)</span>
                  {activeFilters.sort === 'name_asc' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
              <button
                onClick={() => { updateActiveFilters({ sort: 'name_desc' }); setShowSortDropdown(false); }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${activeFilters.sort === 'name_desc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
              >
                <div className="flex items-center justify-between">
                  <span>По алфавиту (Я–А)</span>
                  {activeFilters.sort === 'name_desc' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-start mb-6 gap-4">
        <button
          onClick={() => navigate('/my-parts/add')}
          className="px-6 py-3 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-base font-medium min-h-[48px] sm:min-h-0"
        >
          Добавить запчасть
        </button>
        {avitoJob && (
          <div className="text-sm text-gray-600">
            Avito export: {avitoJob.status} ({avitoJob.processed_count || 0}/{avitoJob.total_count || 0})
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('in-stock')}
            className={`font-medium text-lg sm:text-base ${activeTab === 'in-stock' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <div className="pb-2 inline-block border-b-4 border-blue-500">
              В наличии
              {products.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {products.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`font-medium text-lg sm:text-base ${activeTab === 'pending' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <div className="pb-2 inline-block border-b-4 border-yellow-500">
              На модерации
              {moderationItemsCount > 0 && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  {moderationItemsCount}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'in-stock' && (
        loading ? (
        <div className="mt-8 text-center py-16 px-6">
          <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Загрузка запчастей...</h2>
          <p className="text-gray-600 text-base">Пожалуйста, подождите</p>
        </div>
      ) : error ? (
        <div className="mt-8 text-center py-16 px-6">
          <div className="bg-red-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Ошибка загрузки запчастей</h2>
          <p className="text-gray-500 mb-6 text-base">{error}</p>
          <button
            onClick={() => dispatch(fetchMyProducts())}
            className="inline-flex items-center px-5 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 min-h-[48px]"
          >
            Попробовать снова
          </button>
        </div>
      ) : displayParts.length === 0 ? (
        <div className="mt-12 text-center py-16 px-6">
          <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {inStockFilters.search ? 'Ничего не найдено' : 'Запчастей нет'}
          </h2>
          <p className="text-gray-600 text-base mb-6">
            {inStockFilters.search
              ? `По запросу "${inStockFilters.search}" ${inStockFilters.storage ? 'в выбранном складе ' : ''}ничего не найдено. Попробуйте изменить поисковый запрос.`
              : inStockFilters.storage 
                ? 'В выбранном складе пока нет запчастей'
                : 'У вас пока нет добавленных запчастей'
            }
          </p>
          {!inStockFilters.search && (
            <button
              onClick={() => navigate('/my-parts/add')}
              className="inline-flex items-center px-5 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 min-h-[48px]"
            >
              Добавить первую запчасть
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop version - table */}
          <div className="hidden md:block w-full">
            {avitoIntegrationReady && (
              <div className="mb-3 flex items-center justify-between py-2 border-b border-gray-200">
                <span className="text-sm text-gray-500">
                  <span className="ml-2">Выбрано: {selectedParts.size}</span>
                  {inStockFilters.search && selectedParts.size > 0 && (
                    <span className="ml-2 text-indigo-600">
                      (из {displayParts.length} найденных)
                    </span>
                  )}
                </span>
                <div ref={bulkActionsPlacement.anchorRef} className="relative actions-dropdown">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowBulkActions(!showBulkActions); }}
                    disabled={selectedParts.size === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                    <span className="hidden sm:inline">Действия</span>
                  </button>

                  {showBulkActions && renderBulkActionsMenu(
                    buildActionsDropdownMenuClassName(bulkActionsPlacement.openUp, 'w-40 z-50')
                  )}
                </div>
              </div>
            )}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allDisplayedSelected}
                      onChange={handleToggleSelectAllDisplayed}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" colSpan={4}>Запчасть</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Остаток</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Цена</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedDisplayParts.map((part) => (
                  <CardPart
                    key={part.id}
                    part={part}
                    getStorageAddress={getStorageAddress}
                    getCellName={getCellName}
                    onSale={(p) => handleOpenModal(p, 'sale')}
                    onWriteoff={(p) => handleOpenModal(p, 'writeoff')}
                    onPrint={(p) => handleOpenPrintModal(p)}
                    onExport={(p) => handleExportPart(p)}
                    showExport={avitoIntegrationReady}
                    onExportDrom={(p) => handleExportPartDrom(p)}
                    showDromExport={dromIntegrationReady}
                    onToggleExpand={() => toggleExpand(part.id)}
                    isExpanded={expandedPartId === part.id}
                    isSelected={selectedParts.has(part.id)}
                    onSelect={() => handlePartSelect(part.id)}
                    onImageClick={handleOpenMediaModal}
                    productStorageCells={productStorageCells[part.id] || []}
                    imageErrors={imageErrors}
                    onImageError={(partId) => setImageErrors(prev => ({ ...prev, [partId]: true }))}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile version - card layout */}
          <div className="md:hidden">
            <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allDisplayedSelected}
                    onChange={handleToggleSelectAllDisplayed}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span>Выбрать всё</span>
                </label>
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  Выбрано: {selectedParts.size}
                  {inStockFilters.search && selectedParts.size > 0 && (
                    <span className="text-indigo-600"> / {displayParts.length}</span>
                  )}
                </span>
              </div>
              {avitoIntegrationReady && (
                <div ref={mobileBulkActionsPlacement.anchorRef} className="relative actions-dropdown flex justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowBulkActions(!showBulkActions); }}
                    disabled={selectedParts.size === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                    <span>Действия</span>
                  </button>

                  {showBulkActions && renderBulkActionsMenu(
                    buildActionsDropdownMenuClassName(mobileBulkActionsPlacement.openUp, 'w-44 z-50')
                  )}
                </div>
              )}
            </div>
            {sortedDisplayParts.map((part) => (
              <CardPart
                key={part.id}
                renderMode="card"
                part={part}
                getStorageAddress={getStorageAddress}
                getCellName={getCellName}
                onSale={(p) => handleOpenModal(p, 'sale')}
                onWriteoff={(p) => handleOpenModal(p, 'writeoff')}
                onPrint={(p) => handleOpenPrintModal(p)}
                onExport={(p) => handleExportPart(p)}
                showExport={avitoIntegrationReady}
                onExportDrom={(p) => handleExportPartDrom(p)}
                showDromExport={dromIntegrationReady}
                onToggleExpand={() => toggleExpand(part.id)}
                isExpanded={expandedPartId === part.id}
                isSelected={selectedParts.has(part.id)}
                onSelect={() => handlePartSelect(part.id)}
                onImageClick={handleOpenMediaModal}
                productStorageCells={productStorageCells[part.id] || []}
                imageErrors={imageErrors}
                onImageError={(partId) => setImageErrors(prev => ({ ...prev, [partId]: true }))}
              />
            ))}
          </div>
        </>
      ))}

      {activeTab === 'pending' && (
        moderationLoading ? (
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
        ) : moderationLoadError ? (
          <div className="mt-8 text-center py-16 px-6">
            <div className="bg-red-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-medium text-gray-900 mb-2">Ошибка загрузки запчастей</h2>
            <p className="text-gray-500 mb-6 text-base">{moderationLoadError}</p>
            <button
              onClick={loadModerationParts}
              className="inline-flex items-center px-5 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 min-h-[48px]"
            >
              Попробовать снова
            </button>
          </div>
        ) : sortedModerationParts.length === 0 ? (
          <div className="mt-12 text-center py-16 px-6">
            <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {moderationFilters.search || moderationFilters.storage
                ? 'Ничего не найдено'
                : moderationFilters.hideRejected && moderationItemsCount > 0
                  ? 'Отклонённые скрыты'
                  : 'Запчастей на модерации нет'}
            </h2>
            <p className="text-gray-600 text-base mb-6">
              {moderationFilters.search
                ? `По запросу "${moderationFilters.search}" ничего не найдено среди запчастей на модерации.`
                : moderationFilters.storage
                  ? 'В выбранном складе нет запчастей на модерации.'
                  : moderationFilters.hideRejected && moderationItemsCount > 0
                    ? 'Снимите галочку «Скрыть отклонённые», чтобы увидеть отклонённые запчасти.'
                    : 'У вас пока нет запчастей, ожидающих модерации'}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block w-full">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" colSpan={4}>Запчасть</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Остаток</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Цена</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Действия</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedModerationParts.map((part) => (
                    <CardPart
                      key={getModerationPartKey(part)}
                      variant="moderation"
                      moderationKind={part.moderationKind}
                      part={part}
                      getStorageAddress={getStorageAddress}
                      getCellName={getCellName}
                      onPrint={handleOpenPrintModal}
                      onDelete={handleModerationDelete}
                      onEdit={handleModerationEdit}
                      onToggleExpand={() => toggleExpand(getModerationPartKey(part))}
                      isExpanded={expandedPartId === getModerationPartKey(part)}
                      onImageClick={handleOpenMediaModal}
                      productStorageCells={part.moderationKind === 'pending' ? getStorageCellsForPart(part, true) : []}
                      imageErrors={imageErrors}
                      onImageError={(partId) => setImageErrors((prev) => ({ ...prev, [partId]: true }))}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden">
              {sortedModerationParts.map((part) => (
                <CardPart
                  key={getModerationPartKey(part)}
                  renderMode="card"
                  variant="moderation"
                  moderationKind={part.moderationKind}
                  part={part}
                  getStorageAddress={getStorageAddress}
                  getCellName={getCellName}
                  onPrint={handleOpenPrintModal}
                  onDelete={handleModerationDelete}
                  onEdit={handleModerationEdit}
                  onToggleExpand={() => toggleExpand(getModerationPartKey(part))}
                  isExpanded={expandedPartId === getModerationPartKey(part)}
                  onImageClick={handleOpenMediaModal}
                  productStorageCells={part.moderationKind === 'pending' ? getStorageCellsForPart(part, true) : []}
                  imageErrors={imageErrors}
                  onImageError={(partId) => setImageErrors((prev) => ({ ...prev, [partId]: true }))}
                />
              ))}
            </div>
          </>
        )
      )}

      <StockOutModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedPart={selectedPart}
        operationType={operationType}
        formData={formData}
        onFormChange={(field, value) =>
          setFormData(prev => ({ ...prev, [field]: value }))
        }
        onConfirm={handleConfirm}
      />

      <MediaModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        mediaItems={currentMediaItems}
        initialIndex={currentMediaIndex}
      />

      <PrintReceiptModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        selectedPart={selectedPart}
        productStorageCells={
          selectedPart
            ? getStorageCellsForPart(selectedPart, activeTab === 'pending')
            : []
        }
      />
    </div>
  );
}

export default MyParts;