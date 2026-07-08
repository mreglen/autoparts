import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Navigate, useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import PhotoThumbnail from '../../components/PhotoGallery/PhotoThumbnail';
import MediaModal from '../../components/MediaModal/MediaModal';
import { normalizeImageUrl, apiRequest, API_LONG_REQUEST_TIMEOUT_MS } from '../../utils/apiClient';
import { stripHtmlTags } from '../../utils/text';
import { fetchMyProducts, fetchMyPendingProducts, fetchMyRejectedProducts, deletePendingProduct, deleteRejectedProduct, updateProductQuantityAPI, fetchMyProductDrafts, deleteProductDraft, submitProductDraft, selectMyProductsTotal, selectMyProductsTotalQuantity, selectMyProductsTotalValue, selectMyProductsPage, selectMyProductsHasMore, selectMyProductsLoadingMore, selectMyProductsFilterKey, selectDraftItems, selectDraftLoading, selectDraftError } from '../../redux/slices/ProductSlice';
import { formatDraftTitle } from '../../utils/productDraftUtils';
import { createStockOut } from '../../redux/slices/StockOutSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import { fetchProductStorageCellsBatch, fetchStorageCells, invalidateProductStorageCells } from '../../redux/slices/StorageCellsSlice';
import StockOutModal from './StockOutModal/StockOutModal';
import PrintReceiptModal from './PrintReceiptModal/PrintReceiptModal';
import { useActionsDropdownPlacement } from '../../hooks/useActionsDropdownPlacement';
import { buildActionsDropdownMenuClassName } from '../../utils/actionsDropdownPlacement';
import StorageCellsDisplayTable from '../../components/StorageCellsTable/StorageCellsDisplayTable';
import { normalizeInternalCodeForSearch, INTERNAL_CODE_LABEL, formatInternalCodeDisplay } from '../../utils/internalCode';
import { normalizeArticle } from '../../utils/productDisplayName';
import MyPartsRowSkeleton from '../../components/skeletons/MyPartsRowSkeleton';
import { useAuthReady } from '../../hooks/useAuthReady';
import { userHasWarehouseQrAccess } from '../../hooks/useWarehousePermissions';
import { formatDromExportMessage } from '../../utils/dromExport';

const CardPart = ({
  part,
  variant = 'stock',
  moderationKind = 'pending',
  getStorageAddress,
  cellCatalog = [],
  onSale,
  onWriteoff,
  onPrint,
  onDelete,
  onEdit,
  onExport,
  showExport,
  onExportDrom,
  showDromExport,
  dromExporting = false,
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
              disabled={dromExporting}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <img src="/logos/drom.png" alt="" className="w-4 h-4" />
              {dromExporting ? 'Экспорт Drom…' : 'Экспорт Drom'}
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
                {INTERNAL_CODE_LABEL}: <span className="font-mono">{formatInternalCodeDisplay(part.internal_code)}</span>
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
                    {INTERNAL_CODE_LABEL}: <span className="font-mono">{formatInternalCodeDisplay(part.internal_code)}</span>
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
                {productStorageCells?.length > 0 && (
                  <div className="mt-2 max-w-lg">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Адресное хранение
                    </div>
                    <StorageCellsDisplayTable
                      productStorageCells={productStorageCells}
                      cellCatalog={cellCatalog}
                      compact
                    />
                  </div>
                )}
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
                  {productStorageCells?.length > 0 && (
                    <div className="mt-2 max-w-lg">
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Адресное хранение
                      </div>
                      <StorageCellsDisplayTable
                        productStorageCells={productStorageCells}
                        cellCatalog={cellCatalog}
                        compact
                      />
                    </div>
                  )}
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

const formatDraftUpdatedAt = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const DraftCard = ({ draft, onContinue, onSubmit, onDelete }) => {
  const [showActions, setShowActions] = useState(false);
  const actionsPlacement = useActionsDropdownPlacement(showActions, 160);
  const firstPhoto = draft.photos?.[0];
  const photoUrl = firstPhoto ? normalizeImageUrl(firstPhoto) : null;

  const renderActionsMenu = (menuClassName) => (
    <div className={menuClassName}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onContinue(draft); setShowActions(false); }}
        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Продолжить
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSubmit(draft); setShowActions(false); }}
        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        На модерацию
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(draft); setShowActions(false); }}
        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Удалить
      </button>
    </div>
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                Нет фото
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-gray-900">
              {formatDraftTitle(draft)}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Обновлён: {formatDraftUpdatedAt(draft.updated_at)}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {draft.photos?.length || 0} фото · {draft.videos?.length || 0} видео
            </p>
          </div>
        </div>
        <div ref={actionsPlacement.anchorRef} className="relative actions-dropdown shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
            <span>Действия</span>
          </button>
          {showActions && renderActionsMenu(buildActionsDropdownMenuClassName(actionsPlacement.openUp, 'w-48 z-50'))}
        </div>
      </div>
    </div>
  );
};

const DEFAULT_IN_STOCK_FILTERS = { storage: '', cell: '', cellValue: '', sort: 'date_desc' };
const DEFAULT_MODERATION_FILTERS = { storage: '', cell: '', cellValue: '', sort: 'date_desc', hideRejected: false };
const MY_PARTS_SORT_OPTIONS = [
  { value: 'date_desc', label: 'Сначала новые' },
  { value: 'date_asc', label: 'Сначала старые' },
  { value: 'price_asc', label: 'Цена: по возрастанию' },
  { value: 'price_desc', label: 'Цена: по убыванию' },
];
const MY_PARTS_SORT_LABELS = Object.fromEntries(
  MY_PARTS_SORT_OPTIONS.map(({ value, label }) => [value, label]),
);
const URL_SEARCH_DEBOUNCE_MS = 400;
const MY_PRODUCTS_PAGE_SIZE = 30;

const buildMyProductsRequest = ({ page = 1, storage, cell, cellValue, q, sort, stock, noPhoto, append = false } = {}) => ({
  page,
  page_size: MY_PRODUCTS_PAGE_SIZE,
  sort: sort || 'date_desc',
  ...(storage ? { storage_location_id: storage } : {}),
  ...(cell ? { storage_cell_id: cell } : {}),
  ...(cell && cellValue ? { storage_cell_value: cellValue } : {}),
  ...(q?.trim() ? { q: q.trim() } : {}),
  ...(stock ? { stock } : {}),
  ...(noPhoto ? { no_photo: true } : {}),
  append,
});

const getModerationPartKey = (part) => `${part.moderationKind || 'pending'}-${part.id}`;

function MyParts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isReady } = useAuthReady();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const { items: products, pendingItems, rejectedItems, loading, error } = useSelector((state) => state.products);
  const myProductsTotal = useSelector(selectMyProductsTotal);
  const myProductsTotalQuantity = useSelector(selectMyProductsTotalQuantity);
  const myProductsTotalValue = useSelector(selectMyProductsTotalValue);
  const myProductsPage = useSelector(selectMyProductsPage);
  const myProductsHasMore = useSelector(selectMyProductsHasMore);
  const myProductsLoadingMore = useSelector(selectMyProductsLoadingMore);
  const myProductsFilterKey = useSelector(selectMyProductsFilterKey);
  const draftItems = useSelector(selectDraftItems);
  const draftLoading = useSelector(selectDraftLoading);
  const draftError = useSelector(selectDraftError);
  const loadMoreSentinelRef = useRef(null);
  const moderationHydratedRef = useRef(false);
  const draftsHydratedRef = useRef(false);
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
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const selectAllCheckboxRef = useRef(null);
  const selectAllCheckboxMobileRef = useRef(null);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(null); // ID запчасти с открытым меню действий
  const [showBulkActions, setShowBulkActions] = useState(false);
  const bulkActionsPlacement = useActionsDropdownPlacement(showBulkActions, 130);
  const mobileBulkActionsPlacement = useActionsDropdownPlacement(showBulkActions, 130);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'in-stock');
  const initialUrlSearch = searchParams.get('q') || '';
  const [inStockFilters, setInStockFilters] = useState(() => ({
    ...DEFAULT_IN_STOCK_FILTERS,
    storage: searchParams.get('tab') === 'pending' ? '' : (searchParams.get('storage') || ''),
    cell: searchParams.get('tab') === 'pending' ? '' : (searchParams.get('cell') || ''),
    cellValue: searchParams.get('tab') === 'pending' ? '' : (searchParams.get('cell_value') || ''),
  }));
  const [moderationFilters, setModerationFilters] = useState(() => ({
    ...DEFAULT_MODERATION_FILTERS,
    storage: searchParams.get('tab') === 'pending' ? (searchParams.get('storage') || '') : '',
    cell: searchParams.get('tab') === 'pending' ? (searchParams.get('cell') || '') : '',
    cellValue: searchParams.get('tab') === 'pending' ? (searchParams.get('cell_value') || '') : '',
    hideRejected: searchParams.get('hide_rejected') === '1',
  }));
  const [cellValueOptions, setCellValueOptions] = useState([]);
  const [cellValueOptionsLoading, setCellValueOptionsLoading] = useState(false);
  const [inStockSearchDraft, setInStockSearchDraft] = useState(
    searchParams.get('tab') === 'pending' ? '' : initialUrlSearch,
  );
  const [moderationSearchDraft, setModerationSearchDraft] = useState(
    searchParams.get('tab') === 'pending' ? initialUrlSearch : '',
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'pending' || tab === 'in-stock' || tab === 'drafts') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const isModerationTab = activeTab === 'pending';
  const isDraftsTab = activeTab === 'drafts';
  const activeFilters = isModerationTab ? moderationFilters : inStockFilters;
  const searchDraft = isModerationTab ? moderationSearchDraft : inStockSearchDraft;
  const setSearchDraft = isModerationTab ? setModerationSearchDraft : setInStockSearchDraft;
  const [inStockDebouncedSearch, setInStockDebouncedSearch] = useState(inStockSearchDraft);
  const [moderationDebouncedSearch, setModerationDebouncedSearch] = useState(moderationSearchDraft);
  const debouncedSearch = isModerationTab ? moderationDebouncedSearch : inStockDebouncedSearch;
  const searchInputRef = useRef(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setInStockDebouncedSearch(inStockSearchDraft);
    }, URL_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [inStockSearchDraft]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setModerationDebouncedSearch(moderationSearchDraft);
    }, URL_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [moderationSearchDraft]);
  const updateActiveFilters = (patch) => {
    if (isModerationTab) {
      setModerationFilters((prev) => {
        const next = { ...prev, ...patch };
        if ('storage' in patch && String(patch.storage) !== String(prev.storage)) {
          next.cell = '';
          next.cellValue = '';
        }
        if ('cell' in patch && String(patch.cell) !== String(prev.cell)) {
          next.cellValue = '';
        }
        return next;
      });
    } else {
      setInStockFilters((prev) => {
        const next = { ...prev, ...patch };
        if ('storage' in patch && String(patch.storage) !== String(prev.storage)) {
          next.cell = '';
          next.cellValue = '';
        }
        if ('cell' in patch && String(patch.cell) !== String(prev.cell)) {
          next.cellValue = '';
        }
        return next;
      });
    }
  };
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [currentMediaItems, setCurrentMediaItems] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [avitoIntegrationReady, setAvitoIntegrationReady] = useState(false);
  const [avitoJob, setAvitoJob] = useState(null);
  const [dromIntegrationReady, setDromIntegrationReady] = useState(false);
  const [dromExporting, setDromExporting] = useState(false);
  const [imageErrors, setImageErrors] = useState({}); // Track image errors by part ID
  const [formData, setFormData] = useState({
    quantity: '',
    price: '',
    reason: '',
  });

  // Сортировка: по умолчанию сначала новые
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const displayParts = products;
  const sortedDisplayParts = products;

  const stockFilter = searchParams.get('stock') || '';
  const noPhotoFilter = searchParams.get('no_photo') === '1';

  const inStockFilterKey = useMemo(
    () => JSON.stringify({
      storage: inStockFilters.storage || '',
      cell: inStockFilters.cell || '',
      cellValue: inStockFilters.cellValue || '',
      q: inStockDebouncedSearch.trim(),
      sort: inStockFilters.sort || 'date_desc',
      stock: stockFilter,
      no_photo: noPhotoFilter,
    }),
    [inStockFilters.storage, inStockFilters.cell, inStockFilters.cellValue, inStockDebouncedSearch, inStockFilters.sort, stockFilter, noPhotoFilter],
  );

  const selectionResetKey = useMemo(
    () => JSON.stringify({
      tab: activeTab,
      storage: activeFilters.storage || '',
      cell: activeFilters.cell || '',
      cellValue: activeFilters.cellValue || '',
      q: debouncedSearch.trim(),
    }),
    [activeTab, activeFilters.storage, activeFilters.cell, activeFilters.cellValue, debouncedSearch],
  );

  const availableStorageCells = useMemo(() => {
    const storageId = activeFilters.storage;
    if (!storageId) return [];
    return storageCells.filter((cell) => String(cell.storage_location_id) === String(storageId));
  }, [activeFilters.storage, storageCells]);

  const selectedCellName = useMemo(() => {
    if (!activeFilters.cell) return '';
    const cell = storageCells.find((item) => String(item.id) === String(activeFilters.cell));
    return cell?.name || '';
  }, [activeFilters.cell, storageCells]);

  const moderationCellValueOptions = useMemo(() => {
    if (!moderationFilters.cell) return [];
    const values = new Set();
    [...(pendingItems || []), ...(rejectedItems || [])].forEach((part) => {
      (pendingStorageCellsByProduct[part.id] || []).forEach((link) => {
        if (String(link.storage_cell_id) !== String(moderationFilters.cell)) return;
        const value = String(link.value || '').trim();
        if (value) values.add(value);
      });
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [moderationFilters.cell, pendingItems, rejectedItems, pendingStorageCellsByProduct]);

  const activeCellValueOptions = isModerationTab ? moderationCellValueOptions : cellValueOptions;

  const loadMoreMyProducts = useCallback(() => {
    if (
      activeTab !== 'in-stock'
      || loading
      || myProductsLoadingMore
      || !myProductsHasMore
      || products.length >= myProductsTotal
    ) {
      return;
    }
    dispatch(fetchMyProducts(buildMyProductsRequest({
      page: myProductsPage + 1,
      storage: inStockFilters.storage,
      cell: inStockFilters.cell,
      cellValue: inStockFilters.cellValue,
      q: inStockDebouncedSearch,
      sort: inStockFilters.sort,
      stock: stockFilter,
      noPhoto: noPhotoFilter,
      append: true,
    })));
  }, [
    activeTab,
    loading,
    myProductsLoadingMore,
    myProductsHasMore,
    products.length,
    myProductsTotal,
    dispatch,
    myProductsPage,
    inStockFilters.storage,
    inStockFilters.cell,
    inStockFilters.cellValue,
    inStockFilters.sort,
    inStockDebouncedSearch,
    stockFilter,
    noPhotoFilter,
  ]);

  useEffect(() => {
    if (activeTab !== 'in-stock' || !myProductsHasMore || loading || myProductsLoadingMore) {
      return undefined;
    }
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreMyProducts();
        }
      },
      { root: null, rootMargin: '160px', threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, myProductsHasMore, loading, myProductsLoadingMore, loadMoreMyProducts, products.length]);

  const isInitialMyProductsLoad = activeTab === 'in-stock' && loading && products.length === 0;
  const isInitialModerationLoad = activeTab === 'pending' && moderationLoading
    && (pendingItems?.length || 0) === 0
    && (rejectedItems?.length || 0) === 0;
  const isInitialDraftsLoad = activeTab === 'drafts' && draftLoading && draftItems.length === 0;

  const pendingIdsNeedingCells = useMemo(() => {
    if (activeTab !== 'pending' || !pendingItems?.length) return [];
    return pendingItems
      .map((part) => part.id)
      .filter((id) => (
        id != null
        && !Object.prototype.hasOwnProperty.call(pendingStorageCellsByProduct, id)
      ));
  }, [activeTab, pendingItems, pendingStorageCellsByProduct]);

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

    if (moderationFilters.cell) {
      items = items.filter((part) => {
        const links = pendingStorageCellsByProduct[part.id] || [];
        return links.some((link) => {
          if (String(link.storage_cell_id) !== String(moderationFilters.cell)) return false;
          if (!moderationFilters.cellValue) return true;
          return String(link.value || '').trim() === String(moderationFilters.cellValue).trim();
        });
      });
    }

    if (!moderationDebouncedSearch.trim()) return items;

    const queryNorm = normalizeArticle(moderationDebouncedSearch);
    const queryLower = moderationDebouncedSearch.toLowerCase();
    return items.filter((part) => {
      const articleNorm = normalizeArticle(part.article || '');
      const nameNorm = normalizeArticle(part.name || '');
      const codeNorm = normalizeArticle(normalizeInternalCodeForSearch(part.internal_code));
      return (
        (queryNorm && articleNorm.includes(queryNorm))
        || (queryNorm && codeNorm.includes(queryNorm))
        || (queryNorm && nameNorm.includes(queryNorm))
        || (part.name && part.name.toLowerCase().includes(queryLower))
      );
    });
  }, [pendingItems, rejectedItems, moderationFilters.hideRejected, moderationFilters.storage, moderationFilters.cell, moderationFilters.cellValue, moderationDebouncedSearch, pendingStorageCellsByProduct]);

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
    } else if (sortOrder === 'price_asc' || sortOrder === 'price_desc') {
      items.sort((a, b) => {
        const aPrice = Number(a.price) || 0;
        const bPrice = Number(b.price) || 0;
        if (aPrice < bPrice) return sortOrder === 'price_asc' ? -1 : 1;
        if (aPrice > bPrice) return sortOrder === 'price_asc' ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [displayModerationParts, moderationFilters.sort]);

  const moderationItemsCount = (pendingItems?.length || 0) + (rejectedItems?.length || 0);

  const statsParts = isModerationTab ? sortedModerationParts : sortedDisplayParts;
  const clientStatsValue = statsParts.reduce(
    (sum, part) => sum + ((Number(part.price) || 0) * (Number(part.quantity) || 0)),
    0,
  );
  const clientStatsQuantity = statsParts.reduce(
    (sum, part) => sum + (Number(part.quantity) || 0),
    0,
  );
  const inStockListFullyLoaded = !isModerationTab && products.length >= myProductsTotal;
  const totalValue = isModerationTab
    ? clientStatsValue
    : (inStockListFullyLoaded ? clientStatsValue : myProductsTotalValue);
  const totalQuantity = isModerationTab
    ? clientStatsQuantity
    : (inStockListFullyLoaded ? clientStatsQuantity : myProductsTotalQuantity);

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

  const allFilteredSelected = myProductsTotal > 0 && selectedParts.size === myProductsTotal;
  const someSelected = selectedParts.size > 0 && selectedParts.size < myProductsTotal;

  useEffect(() => {
    [selectAllCheckboxRef, selectAllCheckboxMobileRef].forEach((ref) => {
      if (ref.current) {
        ref.current.indeterminate = someSelected;
      }
    });
  }, [someSelected]);

  useEffect(() => {
    setSelectedParts(new Set());
  }, [selectionResetKey]);

  const handleToggleSelectAll = async () => {
    if (selectAllLoading) return;
    if (allFilteredSelected) {
      setSelectedParts(new Set());
      return;
    }
    setSelectAllLoading(true);
    try {
      const params = new URLSearchParams();
      if (inStockFilters.storage) params.set('storage_location_id', inStockFilters.storage);
      if (inStockFilters.cell) params.set('storage_cell_id', inStockFilters.cell);
      if (inStockFilters.cell && inStockFilters.cellValue) {
        params.set('storage_cell_value', inStockFilters.cellValue);
      }
      if (inStockDebouncedSearch.trim()) params.set('q', inStockDebouncedSearch.trim());
      params.set('sort', inStockFilters.sort || 'date_desc');
      const qs = params.toString();
      const data = await apiRequest(`/products/ids${qs ? `?${qs}` : ''}`);
      setSelectedParts(new Set(data.ids || []));
      if (data.truncated) {
        alert(`Выбрано ${(data.ids || []).length} из ${data.total}. Уточните фильтр для выбора всех позиций.`);
      }
    } catch (err) {
      alert(err.message || 'Не удалось выбрать все позиции');
    } finally {
      setSelectAllLoading(false);
    }
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

  // Закрытие dropdown сортировки при клике вне
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.sort-dropdown')) {
        setShowSortDropdown(false);
      }
    };

    if (showSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortDropdown]);

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
    if (!user?.organization_id || !part?.id || dromExporting) return;
    setDromExporting(true);
    try {
      const data = await apiRequest(`/organizations/${user.organization_id}/drom/autoload/export`, {
        method: 'POST',
        body: JSON.stringify({ product_ids: [part.id] }),
        timeoutMs: API_LONG_REQUEST_TIMEOUT_MS,
      });
      alert(formatDromExportMessage(data));
    } catch (e) {
      alert(`Не удалось экспортировать в Drom: ${e.message || 'ошибка'}`);
    } finally {
      setDromExporting(false);
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
    if (!user?.organization_id || selectedParts.size === 0 || dromExporting) return;
    setDromExporting(true);
    try {
      const data = await apiRequest(`/organizations/${user.organization_id}/drom/autoload/export`, {
        method: 'POST',
        body: JSON.stringify({ product_ids: Array.from(selectedParts) }),
        timeoutMs: API_LONG_REQUEST_TIMEOUT_MS,
      });
      alert(formatDromExportMessage(data));
    } catch (e) {
      alert(`Не удалось выполнить экспорт в Drom: ${e.message || 'ошибка'}`);
    } finally {
      setDromExporting(false);
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
            disabled={selectedParts.size === 0 || dromExporting}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <img src="/logos/drom.png" alt="" className="w-4 h-4" />
            {dromExporting ? 'Экспорт Drom…' : 'Экспорт Drom'}
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


  // Sync URL parameters with component state (debounced search — avoids mobile keyboard dismiss)
  useEffect(() => {
    if (location.pathname !== '/my-parts') return;

    const params = new URLSearchParams();
    const storage = isModerationTab ? moderationFilters.storage : inStockFilters.storage;
    const cell = isModerationTab ? moderationFilters.cell : inStockFilters.cell;
    const cellValue = isModerationTab ? moderationFilters.cellValue : inStockFilters.cellValue;

    if (debouncedSearch) {
      params.set('q', debouncedSearch);
    }

    if (storage) {
      params.set('storage', storage);
    }

    if (cell) {
      params.set('cell', cell);
    }

    if (cellValue) {
      params.set('cell_value', cellValue);
    }

    if (isModerationTab) {
      params.set('tab', 'pending');
      if (moderationFilters.hideRejected) {
        params.set('hide_rejected', '1');
      }
    } else if (isDraftsTab) {
      params.set('tab', 'drafts');
    }

    const next = params.toString();
    const currentSearch = location.search.startsWith('?')
      ? location.search.slice(1)
      : location.search;
    if (next === currentSearch) return;

    setSearchParams(params, { replace: true });
  }, [
    location.pathname,
    debouncedSearch,
    inStockFilters.storage,
    inStockFilters.cell,
    inStockFilters.cellValue,
    moderationFilters.storage,
    moderationFilters.cell,
    moderationFilters.cellValue,
    moderationFilters.hideRejected,
    isModerationTab,
    isDraftsTab,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!isReady || !user?.organization_id) return;
    dispatch(fetchStorageLocations(user.organization_id));
  }, [dispatch, isReady, user?.organization_id]);

  useEffect(() => {
    if (!isReady || !user?.organization_id) return;
    dispatch(fetchStorageCells(activeFilters.storage || undefined));
  }, [dispatch, isReady, user?.organization_id, activeFilters.storage]);

  useEffect(() => {
    if (isModerationTab || !activeFilters.cell) {
      if (!isModerationTab && !activeFilters.cell) {
        setCellValueOptions([]);
        setCellValueOptionsLoading(false);
      }
      return undefined;
    }

    let cancelled = false;
    setCellValueOptionsLoading(true);

    const params = new URLSearchParams({ storage_cell_id: String(activeFilters.cell) });
    if (activeFilters.storage) {
      params.set('storage_location_id', String(activeFilters.storage));
    }

    apiRequest(`/products/storage-cell-values?${params.toString()}`)
      .then((values) => {
        if (cancelled) return;
        setCellValueOptions(Array.isArray(values) ? values : []);
      })
      .catch(() => {
        if (!cancelled) setCellValueOptions([]);
      })
      .finally(() => {
        if (!cancelled) setCellValueOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isModerationTab, activeFilters.cell, activeFilters.storage]);

  useEffect(() => {
    if (!activeFilters.cellValue || activeCellValueOptions.length === 0) return;
    if (!activeCellValueOptions.includes(activeFilters.cellValue)) {
      updateActiveFilters({ cellValue: '' });
    }
  }, [activeFilters.cellValue, activeCellValueOptions]);

  useEffect(() => {
    if (activeTab !== 'in-stock' || !isReady || !user?.organization_id) return;

    const alreadyLoaded =
      myProductsFilterKey === inStockFilterKey
      && myProductsFilterKey !== null
      && (products.length > 0 || myProductsTotal === 0);
    if (!alreadyLoaded) {
      dispatch(fetchMyProducts(buildMyProductsRequest({
        page: 1,
        storage: inStockFilters.storage,
        cell: inStockFilters.cell,
        cellValue: inStockFilters.cellValue,
        q: inStockDebouncedSearch,
        sort: inStockFilters.sort,
        stock: stockFilter,
        noPhoto: noPhotoFilter,
      })));
    }
  }, [
    dispatch,
    isReady,
    user?.organization_id,
    activeTab,
    inStockFilterKey,
    myProductsFilterKey,
    inStockFilters.storage,
    inStockFilters.cell,
    inStockFilters.cellValue,
    inStockFilters.sort,
    inStockDebouncedSearch,
    stockFilter,
    noPhotoFilter,
    products.length,
    myProductsTotal,
  ]);

  useEffect(() => {
    if (activeTab !== 'in-stock' || !user?.organization_id) {
      setAvitoIntegrationReady(false);
      return undefined;
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
  }, [activeTab, user?.organization_id]);

  useEffect(() => {
    if (activeTab !== 'in-stock' || !user?.organization_id) {
      setDromIntegrationReady(false);
      return undefined;
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
  }, [activeTab, user?.organization_id]);

  const loadModerationParts = React.useCallback(async ({ background = false } = {}) => {
    if (!user?.id) return;
    if (!background) {
      setModerationLoading(true);
    }
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

  useEffect(() => {
    if (activeTab !== 'pending' || !isReady || !user?.id) return;
    const background = moderationHydratedRef.current;
    loadModerationParts({ background });
    moderationHydratedRef.current = true;
  }, [activeTab, isReady, user?.id, loadModerationParts]);

  useEffect(() => {
    if (activeTab !== 'drafts' || !isReady || !user?.id) return;
    dispatch(fetchMyProductDrafts());
    draftsHydratedRef.current = true;
  }, [activeTab, isReady, user?.id, dispatch]);

  useEffect(() => {
    if (pendingIdsNeedingCells.length === 0) return undefined;

    let cancelled = false;
    const loadPendingStorageCells = async () => {
      const grouped = {};
      const chunkSize = 100;

      try {
        for (let i = 0; i < pendingIdsNeedingCells.length; i += chunkSize) {
          const chunk = pendingIdsNeedingCells.slice(i, i + chunkSize);
          const links = await apiRequest('/pending-product-storage-cells/by-pending-products', {
            method: 'POST',
            body: JSON.stringify({ pending_product_ids: chunk }),
          });
          chunk.forEach((id) => {
            grouped[id] = [];
          });
          (Array.isArray(links) ? links : []).forEach((link) => {
            if (!grouped[link.pending_product_id]) {
              grouped[link.pending_product_id] = [];
            }
            grouped[link.pending_product_id].push(link);
          });
        }
      } catch {
        pendingIdsNeedingCells.forEach((id) => {
          grouped[id] = [];
        });
      }

      if (cancelled) return;
      setPendingStorageCellsByProduct((prev) => ({ ...prev, ...grouped }));
    };

    loadPendingStorageCells();
    return () => {
      cancelled = true;
    };
  }, [pendingIdsNeedingCells]);

  const handleDeleteDraft = async (draft) => {
    if (!draft?.id) return;
    if (!window.confirm('Удалить черновик?')) return;
    try {
      await dispatch(deleteProductDraft(draft.id)).unwrap();
    } catch (err) {
      alert(typeof err === 'string' ? err : 'Не удалось удалить черновик');
    }
  };

  const handleSubmitDraft = async (draft) => {
    if (!draft?.id) return;
    try {
      await dispatch(submitProductDraft({
        draftId: draft.id,
        storageCells: draft.storage_cells || [],
      })).unwrap();
      await dispatch(fetchMyPendingProducts());
    } catch (err) {
      alert(typeof err === 'string' ? err : 'Не удалось отправить черновик на модерацию');
    }
  };

  const handleContinueDraft = (draft) => {
    if (!draft?.id) return;
    navigate(`/my-parts/drafts/${draft.id}/edit`);
  };

  // Create memoized product IDs that need storage cell data
  const productIdsNeedingData = React.useMemo(() => {
    if (displayParts.length === 0 || loading) return [];

    return displayParts
      .map((part) => part.id)
      .filter((productId) => (
        productId != null
        && !Object.prototype.hasOwnProperty.call(productStorageCells || {}, productId)
      ));
  }, [displayParts, loading, productStorageCells]);

  // Fetch product storage cells in one batched request to avoid rate limits
  useEffect(() => {
    if (productIdsNeedingData.length === 0) return undefined;

    dispatch(fetchProductStorageCellsBatch(productIdsNeedingData));
    return undefined;
  }, [dispatch, productIdsNeedingData]);
  
  // Refresh product storage cell data when storage cells are modified
  useEffect(() => {
    if (!lastModified) return;

    const productIds = displayParts.map((part) => part.id).filter(Boolean);
    if (productIds.length > 0) {
      dispatch(invalidateProductStorageCells(productIds));
      dispatch(fetchProductStorageCellsBatch(productIds));
    }

    dispatch(fetchStorageCells(activeFilters.storage || undefined));
  }, [dispatch, lastModified, displayParts, activeFilters.storage]);

  // Check if user has permission to view this page
  // Admin and sellers always have access
  // Employees need 'my-parts' permission code
  const hasPermission = user?.is_admin || user?.is_seller || 
    (user?.is_employee && permissionCodes && permissionCodes.includes('my-parts'));

  if (!isReady) {
    return (
      <div className="mt-4 sm:mt-5 px-4 sm:px-0">
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="hidden md:block">
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <MyPartsRowSkeleton key={index} renderMode="table" />
            ))}
          </div>
        </div>
        <div className="space-y-3 md:hidden">
          {Array.from({ length: 3 }, (_, index) => (
            <MyPartsRowSkeleton key={index} renderMode="card" />
          ))}
        </div>
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



  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div className="flex items-center gap-3 shrink-0">
          <h1 className="text-2xl font-bold text-gray-800">Мои запчасти</h1>
          {userHasWarehouseQrAccess(user, permissionCodes) && (
            <Link
              to="/warehouse/scan"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Сканировать QR"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h2m14 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span className="hidden sm:inline">QR</span>
            </Link>
          )}
        </div>
        {!isDraftsTab && (
          <div className="flex flex-wrap gap-x-6 gap-y-3 sm:justify-end">
            <div className="min-w-[7rem]">
              <div className="text-lg sm:text-xl font-bold text-gray-800 tabular-nums leading-tight">
                {totalValue.toLocaleString('ru-RU')} ₽
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {activeFilters.storage
                  ? (isModerationTab ? 'Стоимость по складу' : 'Стоимость склада')
                  : (isModerationTab ? 'Стоимость на модерации' : 'Стоимость всех складов')}
              </div>
            </div>
            <div className="min-w-[5rem]">
              <div className="text-lg sm:text-xl font-bold text-gray-800 tabular-nums leading-tight">
                {totalQuantity.toLocaleString('ru-RU')} шт.
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {activeFilters.storage
                  ? (isModerationTab ? 'Количество по складу' : 'Штук на складе')
                  : (isModerationTab ? 'На модерации' : 'Штук на всех складах')}
              </div>
            </div>
            {!isModerationTab && myProductsTotal > 0 && (
              <div className="min-w-[5rem]">
                <div className="text-lg sm:text-xl font-bold text-gray-800 tabular-nums leading-tight">
                  {myProductsTotal.toLocaleString('ru-RU')} поз.
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {activeFilters.storage ? 'Позиций на складе' : 'Позиций всего'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!isDraftsTab && (
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <div>
          <label htmlFor="my-parts-search" className="block text-xs font-medium text-gray-600 mb-1.5">
            Поиск{activeFilters.storage ? ' в выбранном складе' : ''}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              id="my-parts-search"
              ref={searchInputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="По номеру, внутр. коду или названию..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="block w-full h-10 pl-9 pr-9 border border-gray-300 rounded-lg bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <div className={`absolute inset-y-0 right-0 pr-3 flex items-center ${searchDraft ? '' : 'invisible pointer-events-none'}`}>
              <button
                type="button"
                onClick={() => setSearchDraft('')}
                className="text-gray-400 hover:text-gray-600 focus:outline-none"
                tabIndex={searchDraft ? 0 : -1}
                aria-hidden={!searchDraft}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${isModerationTab ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          <div className="min-w-0">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Склад</label>
            <select
              value={activeFilters.storage}
              onChange={(e) => updateActiveFilters({ storage: e.target.value })}
              className="block w-full h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
            <option value="">Все склады</option>
            {storageLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.address}
              </option>
            ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Ячейка</label>
            <select
              value={activeFilters.cell}
              onChange={(e) => updateActiveFilters({ cell: e.target.value })}
              disabled={!activeFilters.storage}
              className="block w-full h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
            >
            <option value="">{activeFilters.storage ? 'Все ячейки' : 'Сначала выберите склад'}</option>
            {availableStorageCells.map((cell) => (
              <option key={cell.id} value={cell.id}>
                {cell.name}
              </option>
            ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-medium text-gray-600 mb-1.5 truncate" title={selectedCellName || undefined}>
              {selectedCellName ? `Позиция · ${selectedCellName}` : 'Позиция'}
            </label>
            <select
              value={activeFilters.cellValue}
              onChange={(e) => updateActiveFilters({ cellValue: e.target.value })}
              disabled={!activeFilters.cell || (!isModerationTab && cellValueOptionsLoading)}
              className="block w-full h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
            >
            <option value="">
              {!activeFilters.cell
                ? 'Сначала выберите ячейку'
                : (!isModerationTab && cellValueOptionsLoading)
                  ? 'Загрузка…'
                  : activeCellValueOptions.length > 0
                    ? 'Все позиции'
                    : 'Нет заполненных позиций'}
            </option>
            {activeCellValueOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            </select>
          </div>

          <div className="min-w-0 relative sort-dropdown">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Сортировка</label>
            <button
              type="button"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm shadow-sm flex items-center justify-between gap-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              title="Сортировка"
              aria-expanded={showSortDropdown}
            >
              <span className="flex items-center gap-2 min-w-0 text-gray-700">
                <svg className="w-4 h-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                <span className="truncate">
                  {MY_PARTS_SORT_LABELS[activeFilters.sort] || 'Сначала новые'}
                </span>
              </span>
              <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSortDropdown && (
              <div className="absolute left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30">
                {MY_PARTS_SORT_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { updateActiveFilters({ sort: value }); setShowSortDropdown(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${activeFilters.sort === value ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{label}</span>
                      {activeFilters.sort === value && (
                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isModerationTab && (
            <div className="min-w-0 flex flex-col justify-end">
              <label className="inline-flex items-center gap-2 h-10 px-3 border border-gray-300 rounded-lg bg-white cursor-pointer shadow-sm">
                <input
                  type="checkbox"
                  checked={moderationFilters.hideRejected}
                  onChange={(e) => updateActiveFilters({ hideRejected: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Скрыть отклонённые</span>
              </label>
            </div>
          )}
        </div>
      </div>
      )}

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
        <div className="grid grid-cols-3 gap-1 sm:flex sm:gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('in-stock')}
            className={`min-w-0 font-medium text-xs sm:text-base ${
              activeTab === 'in-stock' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div
              className={`flex items-center justify-center gap-1 whitespace-nowrap pb-2 border-b-2 sm:border-b-4 border-blue-500 sm:justify-start ${
                activeTab === 'in-stock' ? 'opacity-100' : 'opacity-70'
              }`}
            >
              <span>В наличии</span>
              {myProductsTotal > 0 && (
                <span
                  className="inline-flex shrink-0 items-center rounded-full bg-indigo-100 px-1.5 py-0 text-[10px] font-medium text-indigo-800 sm:px-2.5 sm:py-0.5 sm:text-xs"
                  title={`${myProductsTotal} позиций`}
                >
                  {myProductsTotal}
                </span>
              )}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`min-w-0 font-medium text-xs sm:text-base ${
              activeTab === 'pending' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div
              className={`flex items-center justify-center gap-1 whitespace-nowrap pb-2 border-b-2 sm:border-b-4 border-yellow-500 sm:justify-start ${
                activeTab === 'pending' ? 'opacity-100' : 'opacity-70'
              }`}
            >
              <span className="sm:hidden">Модерация</span>
              <span className="hidden sm:inline">На модерации</span>
              {moderationItemsCount > 0 && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-yellow-100 px-1.5 py-0 text-[10px] font-medium text-yellow-800 sm:px-2.5 sm:py-0.5 sm:text-xs">
                  {moderationItemsCount}
                </span>
              )}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drafts')}
            className={`min-w-0 font-medium text-xs sm:text-base ${
              activeTab === 'drafts' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div
              className={`flex items-center justify-center gap-1 whitespace-nowrap pb-2 border-b-2 sm:border-b-4 border-slate-500 sm:justify-start ${
                activeTab === 'drafts' ? 'opacity-100' : 'opacity-70'
              }`}
            >
              <span>Черновики</span>
              {draftItems.length > 0 && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-1.5 py-0 text-[10px] font-medium text-slate-800 sm:px-2.5 sm:py-0.5 sm:text-xs">
                  {draftItems.length}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'in-stock' && (stockFilter || noPhotoFilter) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            {stockFilter === 'zero' && 'Показаны товары с нулевым остатком'}
            {stockFilter === 'low' && 'Показаны товары с низким остатком (1–2 шт.)'}
            {noPhotoFilter && !stockFilter && 'Показаны товары без фото'}
            {noPhotoFilter && stockFilter && ' · без фото'}
          </span>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('stock');
              next.delete('no_photo');
              setSearchParams(next, { replace: true });
            }}
            className="font-medium text-amber-800 hover:underline"
          >
            Сбросить фильтр
          </button>
        </div>
      )}

      {activeTab === 'in-stock' && (
        isInitialMyProductsLoad ? (
        <div className="mt-4">
          <div className="hidden md:block w-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" colSpan={4}>Запчасть</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Остаток</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Цена</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Array.from({ length: 8 }, (_, index) => (
                  <MyPartsRowSkeleton key={index} renderMode="table" />
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {Array.from({ length: 5 }, (_, index) => (
              <MyPartsRowSkeleton key={index} renderMode="card" />
            ))}
          </div>
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
            onClick={() => {
              dispatch(fetchMyProducts(buildMyProductsRequest({
                page: 1,
                storage: inStockFilters.storage,
                cell: inStockFilters.cell,
                cellValue: inStockFilters.cellValue,
                q: inStockDebouncedSearch,
                sort: inStockFilters.sort,
                stock: stockFilter,
                noPhoto: noPhotoFilter,
              })));
            }}
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
            {inStockDebouncedSearch ? 'Ничего не найдено' : 'Запчастей нет'}
          </h2>
          <p className="text-gray-600 text-base mb-6">
            {inStockDebouncedSearch
              ? `По запросу "${inStockDebouncedSearch}" ${inStockFilters.storage ? 'в выбранном складе ' : ''}ничего не найдено. Попробуйте изменить поисковый запрос.`
              : inStockFilters.storage 
                ? 'В выбранном складе пока нет запчастей'
                : 'У вас пока нет добавленных запчастей'
            }
          </p>
          {!inStockDebouncedSearch && (
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
                  {allFilteredSelected && myProductsTotal > 0 && (
                    <span className="ml-2 text-indigo-600">
                      (все {myProductsTotal.toLocaleString('ru-RU')} по фильтру)
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
                      ref={selectAllCheckboxRef}
                      type="checkbox"
                      checked={allFilteredSelected}
                      disabled={selectAllLoading || myProductsTotal === 0}
                      onChange={handleToggleSelectAll}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
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
                    cellCatalog={storageCells}
                    onSale={(p) => handleOpenModal(p, 'sale')}
                    onWriteoff={(p) => handleOpenModal(p, 'writeoff')}
                    onPrint={(p) => handleOpenPrintModal(p)}
                    onExport={(p) => handleExportPart(p)}
                    showExport={avitoIntegrationReady}
                    onExportDrom={(p) => handleExportPartDrom(p)}
                    showDromExport={dromIntegrationReady}
                    dromExporting={dromExporting}
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
                    ref={selectAllCheckboxMobileRef}
                    type="checkbox"
                    checked={allFilteredSelected}
                    disabled={selectAllLoading || myProductsTotal === 0}
                    onChange={handleToggleSelectAll}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
                  />
                  <span>{selectAllLoading ? 'Выбор…' : 'Выбрать всё'}</span>
                </label>
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  Выбрано: {selectedParts.size}
                  {allFilteredSelected && myProductsTotal > 0 && (
                    <span className="text-indigo-600"> / {myProductsTotal.toLocaleString('ru-RU')}</span>
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
                cellCatalog={storageCells}
                onSale={(p) => handleOpenModal(p, 'sale')}
                onWriteoff={(p) => handleOpenModal(p, 'writeoff')}
                onPrint={(p) => handleOpenPrintModal(p)}
                onExport={(p) => handleExportPart(p)}
                showExport={avitoIntegrationReady}
                onExportDrom={(p) => handleExportPartDrom(p)}
                showDromExport={dromIntegrationReady}
                dromExporting={dromExporting}
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

          {myProductsHasMore && (
            <div ref={loadMoreSentinelRef} className="mt-4 min-h-4" aria-hidden="true">
              {myProductsLoadingMore && (
                <div className="space-y-3">
                  <div className="hidden md:block">
                    <table className="min-w-full divide-y divide-gray-200">
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Array.from({ length: 3 }, (_, index) => (
                          <MyPartsRowSkeleton key={index} renderMode="table" />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="md:hidden space-y-3">
                    {Array.from({ length: 2 }, (_, index) => (
                      <MyPartsRowSkeleton key={index} renderMode="card" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ))}

      {activeTab === 'pending' && (
        isInitialModerationLoad ? (
          <div className="mt-4">
            <div className="hidden md:block">
              <div className="space-y-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <MyPartsRowSkeleton key={index} renderMode="table" />
                ))}
              </div>
            </div>
            <div className="space-y-3 md:hidden">
              {Array.from({ length: 3 }, (_, index) => (
                <MyPartsRowSkeleton key={index} renderMode="card" />
              ))}
            </div>
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
              {moderationDebouncedSearch || moderationFilters.storage
                ? 'Ничего не найдено'
                : moderationFilters.hideRejected && moderationItemsCount > 0
                  ? 'Отклонённые скрыты'
                  : 'Запчастей на модерации нет'}
            </h2>
            <p className="text-gray-600 text-base mb-6">
              {moderationDebouncedSearch
                ? `По запросу "${moderationDebouncedSearch}" ничего не найдено среди запчастей на модерации.`
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
                      cellCatalog={storageCells}
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
                  cellCatalog={storageCells}
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

      {activeTab === 'drafts' && (
        isInitialDraftsLoad ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
                <div className="flex gap-4">
                  <div className="h-16 w-16 rounded-xl bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-gray-200" />
                    <div className="h-3 w-1/2 rounded bg-gray-100" />
                    <div className="h-3 w-1/3 rounded bg-gray-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : draftError ? (
          <div className="mt-8 text-center py-16 px-6">
            <h2 className="text-xl font-medium text-gray-900 mb-2">Ошибка загрузки черновиков</h2>
            <p className="text-gray-500 mb-6">{draftError}</p>
            <button
              onClick={() => dispatch(fetchMyProductDrafts())}
              className="inline-flex items-center px-5 py-3 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Попробовать снова
            </button>
          </div>
        ) : draftItems.length === 0 ? (
          <div className="mt-12 text-center py-16 px-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Черновиков нет</h2>
            <p className="text-gray-600 text-base mb-6">
              Начните добавлять запчасть — форма сохранится автоматически, даже если вы выйдете со страницы.
            </p>
            <button
              onClick={() => navigate('/my-parts/add')}
              className="inline-flex items-center px-5 py-3 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Добавить запчасть
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {draftItems.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                onContinue={handleContinueDraft}
                onSubmit={handleSubmitDraft}
                onDelete={handleDeleteDraft}
              />
            ))}
          </div>
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