import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchStockOuts, createReturn } from '../../redux/slices/StockOutSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import { fetchProducts } from '../../redux/slices/ProductSlice';
import { fetchStockIns } from '../../redux/slices/StockInSlice';
import { Navigate } from 'react-router-dom';
import { StockOutRow } from './StockOutRow';
import { MobileStockOutCard } from './MobileStockOutCard';
import PhotoThumbnail from '../../components/PhotoGallery/PhotoThumbnail';
import MediaModal from '../../components/MediaModal/MediaModal';
import { normalizeImageUrl } from '../../utils/apiClient';
import ReturnModal from './ReturnModal';

export const StockOutList = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { items: stockOuts, loading, error } = useSelector((state) => state.stockOut);
  const { storageLocations } = useSelector((state) => state.organization);
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [itemsToReturn, setItemsToReturn] = useState([]);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Состояние для медиа модалки
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [currentMediaItems, setCurrentMediaItems] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  // Сортировка: по умолчанию сначала новые
  const [sortOrder, setSortOrder] = useState('date_desc'); // 'date_desc', 'date_asc', 'name_asc', 'name_desc'
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Check if user has permission to view this page
  // Admin and sellers always have access
  // Employees need 'stock-out' permission code
  const hasPermission = user?.is_admin || user?.is_seller || 
    (user?.is_employee && permissionCodes && permissionCodes.includes('stock-out'));

  // Fetch data - must be before any early returns
  useEffect(() => {
    if (authChecked && hasPermission && (user?.is_seller || user?.is_employee) && user.organization_id) {
      dispatch(fetchStockOuts());
      dispatch(fetchStorageLocations(user.organization_id));
    }
  }, [dispatch, user, authChecked, hasPermission]);

  // Check auth - wait for user data to load
  useEffect(() => {
    if (user === undefined || user === null) {
      const token = localStorage.getItem('token');
      if (token) return;
    }
    setAuthChecked(true);
    if (!hasPermission) navigate('/', { replace: true });
  }, [user, permissionCodes, hasPermission, navigate]);

  // Отсортированный список расходов
  // Важно: хук должен вызываться до любых ранних return.
  const sortedStockOuts = React.useMemo(() => {
    const items = Array.isArray(stockOuts) ? [...stockOuts] : [];
    if (sortOrder === 'date_desc') {
      // Сначала новые
      items.sort((a, b) => new Date(b.movement_date || 0) - new Date(a.movement_date || 0));
    } else if (sortOrder === 'date_asc') {
      // Сначала старые
      items.sort((a, b) => new Date(a.movement_date || 0) - new Date(b.movement_date || 0));
    } else if (sortOrder === 'name_asc' || sortOrder === 'name_desc') {
      items.sort((a, b) => {
        const aName = (a.product?.name || a.product?.brand || a.product?.article || '').toString().toLowerCase();
        const bName = (b.product?.name || b.product?.brand || b.product?.article || '').toString().toLowerCase();
        if (aName < bName) return sortOrder === 'name_asc' ? -1 : 1;
        if (aName > bName) return sortOrder === 'name_asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [stockOuts, sortOrder]);

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

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === stockOuts.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(stockOuts.map(item => item.id));
    }
  };

  const handleReturnItem = (item) => {
    setItemsToReturn([item]);
    setReturnModalOpen(true);
  };

  const handleReturnSelected = () => {
    const selectedStockOuts = stockOuts.filter(item => selectedItems.includes(item.id));
    setItemsToReturn(selectedStockOuts);
    setReturnModalOpen(true);
  };

  const handleReturnConfirm = async (returnData) => {
    try {
      // Оборачиваем данные в объект с полем items, как ожидает бекенд
      const payload = { items: returnData };
      await dispatch(createReturn(payload)).unwrap();
      // После успешного возврата обновляем списки расходов, товаров и поступлений
      dispatch(fetchStockOuts());
      dispatch(fetchProducts());
      dispatch(fetchStockIns());
      // Закрываем модальное окно и очищаем выбранные элементы
      setReturnModalOpen(false);
      setItemsToReturn([]);
      setSelectedItems([]);
    } catch (error) {
      console.error('Ошибка при возврате:', error);
    }
  };

  const toggleMobileActions = (itemId) => {
    setMobileActionsOpen(mobileActionsOpen === itemId ? null : itemId);
  };

  const handleRemoveItemFromReturn = (itemId) => {
    setSelectedItems(prev => prev.filter(id => id !== itemId));
    setItemsToReturn(prev => prev.filter(item => item.id !== itemId));
  };

  const toggleExpand = (id) => {
    setExpandedDocId(expandedDocId === id ? null : id);
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

  // Вспомогательная функция — как в MyParts
  const getStorageAddress = (locationId) => {
    if (!locationId) return '—';
    const loc = storageLocations.find(l => l.id === locationId);
    return loc ? (loc.address || `Склад #${locationId}`) : `Склад #${locationId}`;
  };

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-2xl sm:text-2xl font-bold text-gray-800">Расходы (списание/продажа)</h1>

        {/* Кнопка сортировки как в /autoparts/used */}
        <div className="relative">
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 bg-gray-200 text-gray-700 hover:bg-gray-300 min-h-[40px]"
            title="Сортировка"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            <span className="hidden sm:inline">Сортировка</span>
            <svg className={`w-4 h-4 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showSortDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-30">
              <button
                onClick={() => { setSortOrder('date_desc'); setShowSortDropdown(false); }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${sortOrder === 'date_desc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
              >
                <div className="flex items-center justify-between">
                  <span>Сначала новые</span>
                  {sortOrder === 'date_desc' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
              <button
                onClick={() => { setSortOrder('date_asc'); setShowSortDropdown(false); }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${sortOrder === 'date_asc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
              >
                <div className="flex items-center justify-between">
                  <span>Сначала старые</span>
                  {sortOrder === 'date_asc' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
              <button
                onClick={() => { setSortOrder('name_asc'); setShowSortDropdown(false); }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${sortOrder === 'name_asc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
              >
                <div className="flex items-center justify-between">
                  <span>По алфавиту (А–Я)</span>
                  {sortOrder === 'name_asc' && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
              <button
                onClick={() => { setSortOrder('name_desc'); setShowSortDropdown(false); }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${sortOrder === 'name_desc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
              >
                <div className="flex items-center justify-between">
                  <span>По алфавиту (Я–А)</span>
                  {sortOrder === 'name_desc' && (
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

      {loading ? (
        <div className="text-center py-16 px-6">
          <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Загрузка расходов...</h2>
          <p className="text-gray-600 text-base">Пожалуйста, подождите</p>
        </div>
      ) : error ? (
        <div className="text-center py-16 px-6">
          <div className="bg-red-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Ошибка загрузки расходов</h2>
          <p className="text-gray-500 mb-6 text-base">{typeof error === 'object' ? JSON.stringify(error) : error}</p>
          <button
            onClick={() => dispatch(fetchStockOuts())}
            className="inline-flex items-center px-5 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 min-h-[48px]"
          >
            Попробовать снова
          </button>
        </div>
      ) : stockOuts.length === 0 ? (
        <div className="text-center py-16 px-6">
          <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Расходы отсутствуют</h2>
          <p className="text-gray-600 text-base">Здесь будут отображаться записи о расходах запчастей</p>
        </div>
      ) : (
        <>
          {/* Групповые действия */}
          {selectedItems.length > 0 && (
            <div className="mb-3 flex items-center justify-between py-2 border-b border-gray-200">
              <span className="text-sm text-gray-500">
                Выбрано: {selectedItems.length}
              </span>
              <div className="relative actions-dropdown">
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                  <span className="hidden sm:inline">Действия</span>
                </button>

                {showBulkActions && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10 actions-dropdown">
                    <button
                      onClick={() => {
                        handleReturnSelected();
                        setShowBulkActions(false);
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
          )}

          {/* Десктопная версия - таблица */}
          <div className="hidden md:block w-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === stockOuts.length && stockOuts.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Товар</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кол-во</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена</th>
                  <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedStockOuts.map((item) => (
                  <StockOutRow
                    key={item.id}
                    item={item}
                    getStorageAddress={getStorageAddress}
                    onToggleExpand={() => toggleExpand(item.id)}
                    isExpanded={expandedDocId === item.id}
                    isSelected={selectedItems.includes(item.id)}
                    onSelect={() => handleSelectItem(item.id)}
                    onReturn={() => handleReturnItem(item)}
                    onImageClick={handleOpenMediaModal}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Групповые действия для мобильной версии */}
          {selectedItems.length > 0 && (
            <div className="md:hidden bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-gray-900">
                  Выбрано: {selectedItems.length}
                </span>
                <div className="relative mobile-actions-dropdown">
                  <button
                    onClick={() => setShowBulkActions(!showBulkActions)}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors min-h-[44px]"
                  >
                    Действия
                    <img
                      src="/img/arrow_sm.svg"
                      alt=""
                      className={`w-3 h-3 transition-transform duration-200 filter brightness-0 ${showBulkActions ? 'rotate-90' : ''}`}
                      style={{ filter: 'brightness(0) saturate(100%) invert(100%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%)' }}
                    />
                  </button>

                  {showBulkActions && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 mobile-actions-dropdown w-32 mx-auto">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            handleReturnSelected();
                            setShowBulkActions(false);
                          }}
                          className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50"
                        >
                          Вернуть выбранные
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Чекбокс "Выбрать все" для мобильных */}
          {stockOuts.length > 1 && (
            <div className="md:hidden flex items-center justify-between bg-gray-50 rounded-lg p-3 mb-4">
              <span className="text-sm font-medium text-gray-700">Выбрать все</span>
              <input
                type="checkbox"
                checked={selectedItems.length === stockOuts.length && stockOuts.length > 0}
                onChange={() => {
                  if (selectedItems.length === stockOuts.length) {
                    setSelectedItems([]);
                  } else {
                    setSelectedItems(stockOuts.map(item => item.id));
                  }
                }}
                className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
            </div>
          )}

          {/* Мобильная версия - карточки */}
          <div className="md:hidden space-y-2">
            {sortedStockOuts.map((item) => {
              // Get first photo URL
              const firstPhoto = item.product?.photos?.[0];
              const photoUrl = firstPhoto?.url || (firstPhoto?.file_path ? `/uploads/${firstPhoto.file_path}` : null);
              
              return (
                <MobileStockOutCard
                  key={item.id}
                  item={item}
                  photoUrl={photoUrl}
                  selectedItems={selectedItems}
                  handleSelectItem={handleSelectItem}
                  toggleExpand={toggleExpand}
                  expandedDocId={expandedDocId}
                  toggleMobileActions={toggleMobileActions}
                  mobileActionsOpen={mobileActionsOpen}
                  handleReturnItem={handleReturnItem}
                  setMobileActionsOpen={setMobileActionsOpen}
                  getStorageAddress={getStorageAddress}
                />
              );
            })}
          </div>
        </>
      )}

      <ReturnModal
        isOpen={returnModalOpen}
        onClose={() => {
          setReturnModalOpen(false);
          setItemsToReturn([]);
        }}
        items={itemsToReturn}
        onConfirm={handleReturnConfirm}
        onRemoveItem={handleRemoveItemFromReturn}
      />

      <MediaModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        mediaItems={currentMediaItems}
        initialIndex={currentMediaIndex}
      />
    </div>
  );
};
