import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import PhotoThumbnail from '../../components/PhotoGallery/PhotoThumbnail';
import ImageModal from '../../components/ImageModal/ImageModal';
import { fetchProducts, updateProductQuantityAPI } from '../../redux/slices/ProductSlice';
import { createStockOut } from '../../redux/slices/StockOutSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import { fetchProductStorageCells, fetchStorageCells } from '../../redux/slices/StorageCellsSlice';
import StockOutModal from './StockOutModal/StockOutModal';

const CardPart = ({ part, getStorageAddress, getCellName, onSale, onWriteoff, onToggleExpand, isExpanded, onImageClick, isSelected, onSelect, productStorageCells = [] }) => {
  const [showActions, setShowActions] = useState(false);

  // Закрываем dropdown при клике вне
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
        className="px-2 sm:px-6 py-4 whitespace-nowrap border-r border-gray-200"
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
        {part.brand || '—'}
      </td>
      <td 
        className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono cursor-pointer"
        onClick={onToggleExpand}
      >
        {part.article || '—'}
      </td>
      <td 
        className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono cursor-pointer"
        onClick={onToggleExpand}
      >
        {part.internal_code || '—'}
      </td>
      <td 
        className="px-2 sm:px-6 py-4 text-sm text-gray-500 max-w-0 truncate sm:max-w-none sm:whitespace-normal cursor-pointer"
        onClick={onToggleExpand}
      >
        {part.name || '—'}
      </td>
      <td 
        className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm cursor-pointer"
        onClick={onToggleExpand}
      >
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${part.is_new ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {part.is_new ? 'Новый' : 'Б/у'}
        </span>
      </td>
      <td 
        className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
        onClick={onToggleExpand}
      >
        {part.quantity || 0}
      </td>
      <td 
        className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
        onClick={onToggleExpand}
      >
        {part.price != null ? `${part.price.toFixed(2)} ₽` : '—'}
      </td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
        <td colSpan="9" className="px-6 py-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Фото */}
            <div>
              <PhotoThumbnail photos={part.photos || []} onImageClick={onImageClick} />
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
                  <div className="mt-2 space-y-1">
                    {productStorageCells.map((cellLink) => (
                      <div
                        key={cellLink.id}
                        className="p-2 bg-white rounded border text-sm"
                      >
                        <span className="font-medium text-gray-900">
                          {getCellName(cellLink.storage_cell_id)}
                        </span>
                        {cellLink.value && (
                          <span className="text-gray-700 ml-2">
                            : {cellLink.value}
                          </span>
                        )}
                      </div>
                    ))}
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
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { items: products, loading, error } = useSelector((state) => state.products);

  const { storageLocations } = useSelector((state) => state.organization);
  const { productStorageCells, storageCells } = useSelector((state) => state.storageCells);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [operationType, setOperationType] = useState(null);
  const [expandedPartId, setExpandedPartId] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState({ photos: [], initialIndex: 0 });
  const [selectedParts, setSelectedParts] = useState(new Set());
  const [mobileActionsOpen, setMobileActionsOpen] = useState(null); // ID запчасти с открытым меню действий
  const [searchQuery, setSearchQuery] = useState(''); // Поисковый запрос
  const [selectedStorageLocation, setSelectedStorageLocation] = useState(''); // Выбранный склад
  const [formData, setFormData] = useState({
    quantity: '',
    price: '',
    reason: '',
  });

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

  // Расчет общей суммы и количества
  const totalValue = displayParts.reduce((sum, part) => sum + (part.price * part.quantity), 0);
  const totalQuantity = displayParts.reduce((sum, part) => sum + part.quantity, 0);

  const handleImageClick = (photos, initialIndex) => {
    setSelectedImages({ photos, initialIndex });
    setImageModalOpen(true);
  };

  const handleOpenModal = (part, type) => {
    setSelectedPart(part);
    setOperationType(type);
    setModalOpen(true);
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

  const handleBulkAction = () => {
    // Заглушка для будущих действий
    console.log(`Выбрано ${selectedParts.size} запчастей для массовых действий`);
  };

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


  useEffect(() => {
    // Формируем параметры для запроса
    const params = {};
    if (selectedStorageLocation) {
      params.storage_location_id = selectedStorageLocation;
    }
    
    dispatch(fetchProducts(params));
    if (user?.organization_id) {
      dispatch(fetchStorageLocations(user.organization_id));
      // Загружаем все ячейки организации
      dispatch(fetchStorageCells());
    }
  }, [dispatch, user?.organization_id, selectedStorageLocation]);

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

  if (!user) return <Navigate to="/auth" replace />;
  if (!user.is_seller) return <Navigate to="/" replace />;

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

      {/* Фильтр по складу и поисковое поле */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
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
                {location.address || `Склад #${location.id}`}
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
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-start mb-6 gap-4">
        <button
          onClick={() => navigate('/my-parts/add')}
          className="px-6 py-3 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-base font-medium min-h-[48px] sm:min-h-0"
        >
          Добавить запчасть
        </button>
      </div>

      <div className="font-medium text-lg sm:text-base mb-4 px-0">
        <h2 className="border-b-4 border-blue-500 pb-2 inline-block">В наличии</h2>
      </div>

      {loading ? (
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
            onClick={() => dispatch(fetchProducts())}
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
            {selectedParts.size > 0 && (
              <div className="mb-3 flex items-center justify-between py-2 border-b border-gray-200">
                <span className="text-sm text-gray-500">
                  Выбрано: {selectedParts.size}
                  {searchQuery && (
                    <span className="ml-2 text-indigo-600">
                      (из {displayParts.length} найденных)
                    </span>
                  )}
                </span>
                <button
                  onClick={handleBulkAction}
                  className="text-gray-600 hover:text-gray-800 text-xs sm:text-sm font-medium border-2 border-gray-400 rounded px-2 py-1 bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-1"
                >
                  Действия
                  <img
                    src="/img/arrow_sm.svg"
                    alt=""
                    className={`w-3 h-3 transition-transform duration-200 filter brightness-0 saturate-100 invert-61 sepia-0 saturate-0 hue-rotate-0deg brightness-90 contrast-89`}
                  />
                </button>
              </div>
            )}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Бренд</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Номер</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Внутр. код</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Состояние</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Остаток</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена, ₽</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayParts.map((part) => (
                  <CardPart
                    key={part.id}
                    part={part}
                    getStorageAddress={getStorageAddress}
                    getCellName={getCellName}
                    onSale={(p) => handleOpenModal(p, 'sale')}
                    onWriteoff={(p) => handleOpenModal(p, 'writeoff')}
                    onToggleExpand={() => toggleExpand(part.id)}
                    isExpanded={expandedPartId === part.id}
                    onImageClick={handleImageClick}
                    isSelected={selectedParts.has(part.id)}
                    onSelect={() => handlePartSelect(part.id)}
                    productStorageCells={productStorageCells[part.id] || []}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Мобильная версия - карточки */}
          <div className="md:hidden space-y-4">
            {/* Панель массовых действий для мобильных */}
            {selectedParts.size > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-medium text-gray-900">
                    Выбрано: {selectedParts.size}
                    {searchQuery && (
                      <span className="block text-sm text-indigo-600 mt-1">
                        из {displayParts.length} найденных
                      </span>
                    )}
                  </span>
                  <button
                    onClick={handleBulkAction}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors min-h-[44px]"
                  >
                    Действия
                  </button>
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

            {displayParts.map((part) => (
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
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${part.is_new ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {part.is_new ? 'Новый' : 'Б/у'}
                      </span>
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
                        {part.price != null ? `${part.price.toFixed(2)} ₽` : '—'}
                      </div>
                      <div className="text-sm text-gray-600">{part.quantity || 0} шт.</div>
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
                      {/* Фото */}
                      <div>
                        <PhotoThumbnail photos={part.photos || []} onImageClick={handleImageClick} />
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
                            <div className="space-y-1">
                              {productStorageCells.map((cellLink) => (
                                <div
                                  key={cellLink.id}
                                  className="p-2 bg-gray-50 rounded border text-sm"
                                >
                                  <span className="font-medium text-gray-900">
                                    {getCellName(cellLink.storage_cell_id)}
                                  </span>
                                  {cellLink.value && (
                                    <span className="text-gray-700 ml-2">
                                      : {cellLink.value}
                                    </span>
                                  )}
                                </div>
                              ))}
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

      <ImageModal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        photos={selectedImages.photos}
        initialIndex={selectedImages.initialIndex}
        alt="Фото товара"
      />
    </div>
  );
}

export default MyParts;