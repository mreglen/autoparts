import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Navigate, useNavigate, Link, useSearchParams } from 'react-router-dom';
import PhotoThumbnail from '../../components/PhotoGallery/PhotoThumbnail';
import MediaModal from '../../components/MediaModal/MediaModal';
import { normalizeImageUrl, apiRequest } from '../../utils/apiClient';
import { fetchMyProducts, fetchMyPendingProducts, fetchMyRejectedProducts, updateProductQuantityAPI } from '../../redux/slices/ProductSlice';
import { createStockOut } from '../../redux/slices/StockOutSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import { fetchProductStorageCells, fetchStorageCells } from '../../redux/slices/StorageCellsSlice';
import StockOutModal from './StockOutModal/StockOutModal';
import PendingParts from './PendingParts/PendingParts';
import PrintReceiptModal from './PrintReceiptModal/PrintReceiptModal';

const CardPart = ({ part, getStorageAddress, getCellName, onSale, onWriteoff, onPrint, onExport, showExport, onExportDrom, showDromExport, onToggleExpand, isExpanded, onImageClick, isSelected, onSelect, productStorageCells = [] }) => {
  const [showActions, setShowActions] = useState(false);

  
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

  return (
  <React.Fragment>
    <tr
      className="hover:bg-gray-50"
    >
      <td 
        className="px-2 py-3 whitespace-nowrap border-r border-gray-200"
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
        className="px-2 py-3 whitespace-nowrap text-sm font-medium text-gray-900 cursor-pointer"
        onClick={onToggleExpand}
      >
        {part.brand || '—'}
      </td>
      <td 
        className="px-2 py-3 whitespace-nowrap text-sm text-gray-500 font-mono cursor-pointer"
        onClick={onToggleExpand}
      >
        {part.article || '—'}
      </td>
      <td 
        className="hidden md:table-cell px-3 py-3 whitespace-nowrap text-sm text-gray-500 font-mono cursor-pointer"
        onClick={onToggleExpand}
      >
        {part.internal_code || '—'}
      </td>
      <td 
        className="px-2 py-3 text-sm text-gray-500 max-w-0 truncate sm:max-w-none sm:whitespace-normal cursor-pointer"
        onClick={onToggleExpand}
      >
        {part.name || '—'}
      </td>
      <td 
        className="px-2 py-3 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
        onClick={onToggleExpand}
      >
        {part.quantity || 0}
      </td>
      <td 
        className="px-2 py-3 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
        onClick={onToggleExpand}
      >
        {part.price != null && !isNaN(parseFloat(part.price)) ? `${parseFloat(part.price).toFixed(2)} ₽` : '—'}
      </td>
      <td 
        className="px-2 py-3 whitespace-nowrap cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-1">
          {/* Svoygarage icon - always shown */}
          <img 
            src="/logos/svoygarage.png" 
            alt="Свой Гараж" 
            className="w-5 h-5 object-contain"
            title="Свой Гараж"
          />
          {/* Avito icon - shown only if product is on Avito */}
          {part.is_on_avito && (
            <img 
              src="/logos/avito.png" 
              alt="Avito" 
              className="w-5 h-5 object-contain"
              title="Avito"
            />
          )}
          {/* Drom icon - shown only if product is on Drom */}
          {part.is_on_drom && (
            <img 
              src="/logos/drom.png" 
              alt="Drom" 
              className="w-5 h-5 object-contain"
              title="Drom"
            />
          )}
        </div>
      </td>
      <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-500">
        <div className="relative actions-dropdown">
          <button
            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
            className="text-gray-600 hover:text-gray-800 text-xs sm:text-sm font-medium border-2 border-gray-400 rounded px-2 py-1 bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-1"
          >
            Действия
            <img
              src="/img/arrow_sm.svg"
              alt=""
              className={`w-3 h-3 transition-transform duration-200 filter brightness-0 ${showActions ? 'rotate-90' : ''}`}
              style={{ filter: 'brightness(0) saturate(100%) invert(61%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(89%)' }}
            />
          </button>

          {showActions && (
            <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10 actions-dropdown">
              <div className="py-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onPrint(part); setShowActions(false); }}
                  className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900"
                >
                  Печать
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onSale(part); setShowActions(false); }}
                  className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900"
                >
                  Продать
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onWriteoff(part); setShowActions(false); }}
                  className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900"
                >
                  Списать
                </button>
                {showExport && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onExport(part); setShowActions(false); }}
                    className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900"
                  >
                    Экспорт Avito
                  </button>
                )}
                {showDromExport && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onExportDrom(part); setShowActions(false); }}
                    className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900"
                  >
                    Экспорт Drom
                  </button>
                )}
                <Link
                  to={`/my-parts/edit/${part.id}`}
                  onClick={(e) => { e.stopPropagation(); setShowActions(false); }}
                  className="block w-full px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900"
                >
                  Редактировать
                </Link>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>

    {/* Раскрывающаяся карточка */}
    {isExpanded && (
      <tr className="bg-gray-50">
        <td colSpan="10" className="px-6 py-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Фото и видео */}
            <div>
              <PhotoThumbnail 
                photos={part.photos || []} 
                videos={part.videos || []}
                onImageClick={onImageClick}
              />
            </div>

            {/* Описание и авто */}
            <div className="space-y-4">

              {/* Описание */}
              <div>
                <span className="text-xs text-gray-500">Описание</span>
                <div className="font-medium mt-1">
                  {part.description || '—'}
                </div>
              </div>

              {/* Дополнительная информация */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">Состояние</span>
                  <div className="font-medium mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${part.is_new ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {part.is_new ? 'Новый' : 'Б/у'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Склад</span>
                  <div className="font-medium mt-1">
                    {part.storage_location_id ? getStorageAddress(part.storage_location_id) : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Ответственный</span>
                  <div className="font-medium mt-1">
                    {part.creator_name || '—'}
                  </div>
                </div>
              </div>

              {/* Адрес хранения */}
              {productStorageCells && productStorageCells.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500">Адрес хранения</span>
                  <div className="mt-2">
                    <div className="px-3 py-2 bg-gray-50 rounded text-sm text-gray-700 border border-gray-200">
                      {productStorageCells
                        .map((cellLink) => cellLink.value)
                        .filter(value => value)
                        .join('; ')
                      }
                    </div>
                  </div>
                </div>
              )}

              {/* Автомобиль(и) */}
              {part.compatible_vehicles && part.compatible_vehicles.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500">Автомобиль</span>
                  <div className="mt-2 space-y-3">
                    {part.compatible_vehicles.map((vehicle) => (
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

function MyParts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const { items: products, pendingItems, rejectedItems, loading, error } = useSelector((state) => state.products);
  const [authChecked, setAuthChecked] = useState(false);

  const { storageLocations } = useSelector((state) => state.organization);
  const { productStorageCells, storageCells, lastModified } = useSelector((state) => state.storageCells);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [operationType, setOperationType] = useState(null);
  const [expandedPartId, setExpandedPartId] = useState(null);
  const [selectedParts, setSelectedParts] = useState(new Set());
  const [mobileActionsOpen, setMobileActionsOpen] = useState(null); // ID запчасти с открытым меню действий
  const [showBulkActions, setShowBulkActions] = useState(false); // Dropdown for bulk actions
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || ''); // Поисковый запрос
  const [selectedStorageLocation, setSelectedStorageLocation] = useState(searchParams.get('storage') || ''); // Выбранный склад
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'in-stock'); // 'in-stock' or 'pending'
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [currentMediaItems, setCurrentMediaItems] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [avitoIntegrationReady, setAvitoIntegrationReady] = useState(false);
  const [avitoJob, setAvitoJob] = useState(null);
  const [dromIntegrationReady, setDromIntegrationReady] = useState(false);
  const [formData, setFormData] = useState({
    quantity: '',
    price: '',
    reason: '',
  });

  // Сортировка: по умолчанию сначала новые
  const [sortOrder, setSortOrder] = useState('date_desc'); // 'date_desc', 'date_asc', 'name_asc', 'name_desc'
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Calculate displayParts BEFORE the useEffect that uses it
  const displayParts = products.filter(part => {
    // Если выбран склад, сначала проверяем принадлежность к складу
    if (selectedStorageLocation && part.storage_location_id != selectedStorageLocation) {
      return false;
    }
    
    // Поиск по всем полям
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase().replace(/\s+/g, ''); // Убираем пробелы из запроса
    return (
      (part.article && part.article.toLowerCase().replace(/\s+/g, '').includes(query)) ||
      (part.internal_code && part.internal_code.toLowerCase().replace(/\s+/g, '').includes(query)) ||
      (part.name && part.name.toLowerCase().includes(query))
    );
  });

  // Применяем сортировку к отфильтрованным запчастям
  const sortedDisplayParts = React.useMemo(() => {
    const items = [...displayParts];

    if (sortOrder === 'date_desc') {
      // Сначала новые
      items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortOrder === 'date_asc') {
      // Сначала старые
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
  }, [displayParts, sortOrder]);

  // Расчет общей суммы и количества
  const totalValue = displayParts.reduce((sum, part) => sum + (part.price * part.quantity), 0);
  const totalQuantity = displayParts.reduce((sum, part) => sum + part.quantity, 0);

  const handleOpenModal = (part, type) => {
    setSelectedPart(part);
    setOperationType(type);
    setModalOpen(true);
  };

  const handleOpenPrintModal = (part) => {
    setSelectedPart(part);
    setPrintModalOpen(true);
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


  // Sync URL parameters with component state
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (searchQuery) {
      params.set('q', searchQuery);
    } else {
      params.delete('q');
    }
    
    if (selectedStorageLocation) {
      params.set('storage', selectedStorageLocation);
    } else {
      params.delete('storage');
    }
    
    if (activeTab && activeTab !== 'in-stock') {
      params.set('tab', activeTab);
    } else {
      params.delete('tab');
    }
    
    setSearchParams(params);
  }, [searchQuery, selectedStorageLocation, activeTab, setSearchParams]);

  useEffect(() => {
    // Формируем параметры для запроса
    const params = {};
    if (selectedStorageLocation) {
      params.storage_location_id = selectedStorageLocation;
    }
    
    dispatch(fetchMyProducts(params));
    if (user?.organization_id) {
      dispatch(fetchStorageLocations(user.organization_id));
      // Загружаем все ячейки организации
      dispatch(fetchStorageCells());
    }
  }, [dispatch, user?.organization_id, selectedStorageLocation]);

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
          Boolean(data?.client_id) && Boolean(data?.client_secret_configured) && Boolean(data?.avito_user_id)
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

  // Load pending and rejected products when pending tab is active
  useEffect(() => {
    if (activeTab === 'pending' && user?.id) {
      dispatch(fetchMyPendingProducts());
      dispatch(fetchMyRejectedProducts());
    }
  }, [dispatch, activeTab, user?.id]);

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
            {selectedStorageLocation ? 'Общая стоимость склада' : 'Общая стоимость всех складов'}
          </div>
          <div className="text-lg font-semibold text-gray-700 mt-1">
            {totalQuantity.toLocaleString('ru-RU')} шт.
          </div>
          <div className="text-sm text-gray-500">
            {selectedStorageLocation ? 'Общее количество склада' : 'Общее количество всех складов'}
          </div>
        </div>
      </div>

      {/* Фильтр по складу, поиск и сортировка */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 md:items-end">
        {/* Фильтр по складу */}
        <div className="md:w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">Склад</label>
          <select
            value={selectedStorageLocation}
            onChange={(e) => setSelectedStorageLocation(e.target.value)}
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
            Поиск {selectedStorageLocation && '(в выбранном складе)'}
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
            {searchQuery && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  onClick={() => setSearchQuery('')}
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
              {(pendingItems?.length > 0 || rejectedItems?.length > 0) && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  {(pendingItems?.length || 0) + (rejectedItems?.length || 0)}
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
            {searchQuery ? 'Ничего не найдено' : 'Запчастей нет'}
          </h2>
          <p className="text-gray-600 text-base mb-6">
            {searchQuery
              ? `По запросу "${searchQuery}" ${selectedStorageLocation ? 'в выбранном складе ' : ''}ничего не найдено. Попробуйте изменить поисковый запрос.`
              : selectedStorageLocation 
                ? 'В выбранном складе пока нет запчастей'
                : 'У вас пока нет добавленных запчастей'
            }
          </p>
          {!searchQuery && (
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
          {/* Десктопная версия - таблица */}
          <div className="hidden md:block w-full">
            {avitoIntegrationReady && (
              <div className="mb-3 flex items-center justify-between py-2 border-b border-gray-200">
                <span className="text-sm text-gray-500">
                  <span className="ml-2">Выбрано: {selectedParts.size}</span>
                  {searchQuery && selectedParts.size > 0 && (
                    <span className="ml-2 text-indigo-600">
                      (из {displayParts.length} найденных)
                    </span>
                  )}
                </span>
                <div className="relative actions-dropdown">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowBulkActions(!showBulkActions); }}
                    disabled={selectedParts.size === 0}
                    className="text-gray-600 hover:text-gray-800 text-xs sm:text-sm font-medium border-2 border-gray-400 rounded px-2 py-1 bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Действия
                    <img
                      src="/img/arrow_sm.svg"
                      alt=""
                      className={`w-3 h-3 transition-transform duration-200 filter brightness-0 saturate-100 invert-61 sepia-0 saturate-0 hue-rotate-0deg brightness-90 contrast-89 ${showBulkActions ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {showBulkActions && (
                    <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10 actions-dropdown">
                      <div className="py-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleBulkAction(); setShowBulkActions(false); }}
                          disabled={selectedParts.size === 0}
                          className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Экспорт в Avito
                        </button>
                        {dromIntegrationReady && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleBulkExportDrom(); setShowBulkActions(false); }}
                            disabled={selectedParts.size === 0}
                            className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Экспорт в Drom
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={displayParts.length > 0 && selectedParts.size === displayParts.length}
                      onChange={() => {
                        if (selectedParts.size === displayParts.length) {
                          // Снимаем выделение со всех отображаемых запчастей
                          const newSelected = new Set(selectedParts);
                          displayParts.forEach(part => newSelected.delete(part.id));
                          setSelectedParts(newSelected);
                        } else {
                          // Выделяем все отображаемые запчасти
                          const newSelected = new Set(selectedParts);
                          displayParts.forEach(part => newSelected.add(part.id));
                          setSelectedParts(newSelected);
                        }
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Бренд</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Номер</th>
                  <th className="hidden md:table-cell px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Внутр. код</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Остаток</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена, ₽</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Выгрузка</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
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
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Мобильная версия - карточки */}
          <div className="md:hidden space-y-4">
            {/* Панель массовых действий для мобильных */}
            {avitoIntegrationReady && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-medium text-gray-900">
                    <span className="block text-sm mt-1">Выбрано: {selectedParts.size}</span>
                    {searchQuery && selectedParts.size > 0 && (
                      <span className="block text-sm text-indigo-600 mt-1">
                        из {displayParts.length} найденных
                      </span>
                    )}
                  </span>
                  <div className="relative actions-dropdown">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowBulkActions(!showBulkActions); }}
                      disabled={selectedParts.size === 0}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      Действия
                      <img
                        src="/img/arrow_sm.svg"
                        alt=""
                        className={`w-3 h-3 transition-transform duration-200 ${showBulkActions ? 'rotate-90' : ''}`}
                      />
                    </button>

                    {showBulkActions && (
                      <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10 actions-dropdown">
                        <div className="py-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleBulkAction(); setShowBulkActions(false); }}
                            disabled={selectedParts.size === 0}
                            className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Экспорт в Avito
                          </button>
                          {dromIntegrationReady && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleBulkExportDrom(); setShowBulkActions(false); }}
                              disabled={selectedParts.size === 0}
                              className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Экспорт в Drom
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Чекбокс "Выбрать все" для мобильных */}
            {displayParts.length > 1 && (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 mb-4">
                <span className="text-sm font-medium text-gray-700">Выбрать все</span>
                <input
                  type="checkbox"
                  checked={displayParts.length > 0 && selectedParts.size === displayParts.length}
                  onChange={() => {
                    if (selectedParts.size === displayParts.length) {
                      // Снимаем выделение со всех отображаемых запчастей
                      const newSelected = new Set(selectedParts);
                      displayParts.forEach(part => newSelected.delete(part.id));
                      setSelectedParts(newSelected);
                    } else {
                      // Выделяем все отображаемые запчасти
                      const newSelected = new Set(selectedParts);
                      displayParts.forEach(part => newSelected.add(part.id));
                      setSelectedParts(newSelected);
                    }
                  }}
                  className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              </div>
            )}

            {sortedDisplayParts.map((part) => (
              <div key={part.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                {/* Заголовок и чекбокс */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base font-semibold text-gray-900">{part.brand || '—'}</span>
                      <span className="text-sm text-gray-400">•</span>
                      <span className="text-sm text-gray-500 font-mono">{part.article || '—'}</span>
                    </div>
                    <h3 className="text-base font-medium text-gray-800 mb-2 leading-tight">{part.name || '—'}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      {part.internal_code && (
                        <span className="text-xs text-gray-500 font-mono">{part.internal_code}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <input
                      type="checkbox"
                      checked={selectedParts.has(part.id)}
                      onChange={() => handlePartSelect(part.id)}
                      className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900 mb-1">
                        {part.price != null && !isNaN(parseFloat(part.price)) ? `${parseFloat(part.price).toFixed(2)} ₽` : '—'}
                      </div>
                      <div className="text-sm text-gray-600">{part.quantity || 0} шт.</div>
                      {/* Export icons */}
                      <div className="flex items-center gap-1 mt-2 justify-end">
                        <img 
                          src="/logos/svoygarage.png" 
                          alt="Свой Гараж" 
                          className="w-5 h-5 object-contain"
                          title="Свой Гараж"
                        />
                        {part.is_on_avito && (
                          <img 
                            src="/logos/avito.png" 
                            alt="Avito" 
                            className="w-5 h-5 object-contain"
                            title="Avito"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Кнопка действий */}
                <div className="mb-4">
                  <div className="relative mobile-actions-dropdown">
                    <button
                      onClick={() => toggleMobileActions(part.id)}
                      className="w-full text-gray-600 hover:text-gray-800 text-sm font-medium border-2 border-gray-400 rounded px-2 py-1 bg-transparent hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                    >
                      Действия
                      <img
                        src="/img/arrow_sm.svg"
                        alt=""
                        className={`w-3 h-3 transition-transform duration-200 filter brightness-0 ${mobileActionsOpen === part.id ? 'rotate-90' : ''}`}
                        style={{ filter: 'brightness(0) saturate(100%) invert(61%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(89%)' }}
                      />
                    </button>

                    {mobileActionsOpen === part.id && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 mobile-actions-dropdown w-32 mx-auto">
                        <div className="py-1">
                          <button
                            onClick={() => {
                              handleOpenPrintModal(part);
                              setMobileActionsOpen(null);
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50"
                          >
                            Печать
                          </button>
                          <button
                            onClick={() => {
                              handleOpenModal(part, 'sale');
                              setMobileActionsOpen(null);
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50"
                          >
                            Продать
                          </button>
                          <button
                            onClick={() => {
                              handleOpenModal(part, 'writeoff');
                              setMobileActionsOpen(null);
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50"
                          >
                            Списать
                          </button>
                          {avitoIntegrationReady && (
                            <button
                              onClick={() => {
                                handleExportPart(part);
                                setMobileActionsOpen(null);
                              }}
                              className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50"
                            >
                              Экспорт Avito
                            </button>
                          )}
                          <Link
                            to={`/my-parts/edit/${part.id}`}
                            onClick={() => setMobileActionsOpen(null)}
                            className="block w-full px-3 py-2 text-sm text-black hover:bg-gray-50"
                          >
                            Редактировать
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Кнопка показа деталей */}
                <div className="pt-3 border-t border-gray-100">
                  <button
                    onClick={() => toggleExpand(part.id)}
                    className="w-full text-indigo-600 text-sm font-medium hover:text-indigo-800 transition-colors py-2"
                  >
                    {expandedPartId === part.id ? 'Скрыть детали' : 'Показать детали'}
                  </button>
                </div>

                {/* Детали запчасти - мобильная версия */}
                {expandedPartId === part.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 gap-4">
                      {/* Фото и видео */}
                      <div>
                        <PhotoThumbnail 
                          photos={part.photos || []} 
                          videos={part.videos || []}
                          onImageClick={handleOpenMediaModal}
                        />
                      </div>

                      {/* Описание и информация */}
                      <div className="space-y-4">
                        {/* Описание */}
                        <div>
                          <span className="text-sm text-gray-500 block mb-1">Описание</span>
                          <div className="text-base text-gray-900">{part.description || '—'}</div>
                        </div>

                        {/* Дополнительная информация */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm text-gray-500 block mb-1">Состояние</span>
                            <div className="text-base font-medium text-gray-900">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${part.is_new ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {part.is_new ? 'Новый' : 'Б/у'}
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500 block mb-1">Склад</span>
                            <div className="text-base font-medium text-gray-900">
                              {part.storage_location_id ? getStorageAddress(part.storage_location_id) : '—'}
                            </div>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500 block mb-1">Ответственный</span>
                            <div className="text-base font-medium text-gray-900">
                              {part.creator_name || '—'}
                            </div>
                          </div>
                        </div>

                        {/* Адрес хранения */}
                        {productStorageCells && productStorageCells.length > 0 && (
                          <div>
                            <span className="text-sm text-gray-500 block mb-2">Адрес хранения</span>
                            <div>
                              <div className="px-3 py-2 bg-gray-50 rounded text-sm text-gray-700 border border-gray-200">
                                {productStorageCells
                                  .map((cellLink) => cellLink.value)
                                  .filter(value => value)
                                  .join('; ')
                                }
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Автомобиль(и) */}
                        {part.compatible_vehicles && part.compatible_vehicles.length > 0 && (
                          <div>
                            <span className="text-sm text-gray-500 block mb-2">Автомобиль</span>
                            <div className="space-y-3">
                              {part.compatible_vehicles.map((vehicle) => (
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
            ))}
          </div>
        </>
      ))}

      {/* Pending Parts Tab Content */}
      {activeTab === 'pending' && (
        <PendingParts 
          pendingParts={pendingItems || []}
          rejectedParts={rejectedItems || []}
          loading={loading}
          error={error}
          getStorageAddress={(id) => {
            const location = storageLocations.find(loc => loc.id === id);
            return location?.address || `Склад #${id}`;
          }}
          productStorageCells={productStorageCells}
        />
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
        productStorageCells={selectedPart ? (productStorageCells[selectedPart.id] || []) : []}
      />
    </div>
  );
}

export default MyParts;