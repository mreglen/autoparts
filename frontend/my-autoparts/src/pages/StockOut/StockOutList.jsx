import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchStockOuts, createReturn } from '../../redux/slices/StockOutSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import { fetchProducts } from '../../redux/slices/ProductSlice';
import { fetchStockIns } from '../../redux/slices/StockInSlice';
import { Navigate } from 'react-router-dom';
import { StockOutRow } from './StockOutRow';
import ImageModal from '../../components/ImageModal/ImageModal';
import PhotoThumbnail from '../../components/PhotoGallery/PhotoThumbnail';
import ReturnModal from './ReturnModal';

export const StockOutList = () => {
  const dispatch = useDispatch();
  const { items: stockOuts, loading, error } = useSelector((state) => state.stockOut);
  const { storageLocations } = useSelector((state) => state.organization);
  const user = useSelector((state) => state.auth.user);
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState({ photos: [], initialIndex: 0 });
  const [selectedItems, setSelectedItems] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [itemsToReturn, setItemsToReturn] = useState([]);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(null);

  const handleImageClick = (photos, initialIndex) => {
    setSelectedImages({ photos, initialIndex });
    setImageModalOpen(true);
  };

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

  useEffect(() => {
    if ((user?.is_seller || user?.is_employee) && user.organization_id) {
      dispatch(fetchStockOuts());
      dispatch(fetchStorageLocations(user.organization_id));
    }
  }, [dispatch, user]);

  if (!user) return <Navigate to="/auth" replace />;
  if (!user.is_seller && !user.is_employee) return <Navigate to="/" replace />;

  const toggleExpand = (id) => {
    setExpandedDocId(expandedDocId === id ? null : id);
  };

  // Вспомогательная функция — как в MyParts
  const getStorageAddress = (locationId) => {
    if (!locationId) return '—';
    const loc = storageLocations.find(l => l.id === locationId);
    return loc ? (loc.address || `Склад #${locationId}`) : `Склад #${locationId}`;
  };

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <h1 className="text-2xl sm:text-2xl font-bold text-gray-800 mb-6">Расходы (списание/продажа)</h1>

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
                  className="text-gray-600 hover:text-gray-800 text-xs sm:text-sm font-medium border border-gray-400 rounded px-2 py-1 bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-1"
                >
                  Действия
                  <img
                    src="/img/arrow_sm.svg"
                    alt=""
                    className={`w-3 h-3 transition-transform duration-200 filter brightness-0 saturate-100 invert-61 sepia-0 saturate-0 hue-rotate-0deg brightness-90 contrast-89 ${showBulkActions ? 'rotate-90' : ''}`}
                  />
                </button>

                {showBulkActions && (
                  <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10 actions-dropdown">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          handleReturnSelected();
                          setShowBulkActions(false);
                        }}
                        className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900"
                      >
                        Вернуть выбранные
                      </button>
                    </div>
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
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === stockOuts.length && stockOuts.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Бренд</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Номер</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Внутр. код</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тип</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кол-во</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена, ₽</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stockOuts.map((item) => (
                  <StockOutRow
                    key={item.id}
                    item={item}
                    getStorageAddress={getStorageAddress}
                    onToggleExpand={() => toggleExpand(item.id)}
                    isExpanded={expandedDocId === item.id}
                    onImageClick={handleImageClick}
                    isSelected={selectedItems.includes(item.id)}
                    onSelect={() => handleSelectItem(item.id)}
                    onReturn={() => handleReturnItem(item)}
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
            {stockOuts.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                {/* Заголовок и чекбокс */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base font-semibold text-gray-900">{item.product?.brand || '—'}</span>
                      <span className="text-sm text-gray-400">•</span>
                      <span className="text-sm text-gray-500 font-mono">{item.product?.article || '—'}</span>
                    </div>
                    <h3 className="text-base font-medium text-gray-800 mb-2 leading-tight">{item.product?.name || '—'}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      {item.product?.internal_code && (
                        <span className="text-xs text-gray-500 font-mono">{item.product.internal_code}</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      Дата операции: {item.movement_date}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900 mb-1">
                        {item.sale_price != null ? `${item.sale_price.toFixed(2)} ₽` : '—'}
                      </div>
                      <div className="text-sm text-gray-600">{item.quantity} шт.</div>
                    </div>
                  </div>
                </div>

                {/* Кнопка действий */}
                <div className="mb-2">
                  <div className="relative mobile-actions-dropdown">
                    <button
                      onClick={() => toggleMobileActions(item.id)}
                      className="w-full text-gray-600 hover:text-gray-800 text-sm font-medium border-2 border-gray-400 rounded-lg px-4 py-3 bg-transparent hover:bg-gray-50 transition-colors min-h-[44px] flex items-center justify-center gap-2"
                    >
                      Действия
                      <img
                        src="/img/arrow_sm.svg"
                        alt=""
                        className={`w-3 h-3 transition-transform duration-200 filter brightness-0 ${mobileActionsOpen === item.id ? 'rotate-90' : ''}`}
                        style={{ filter: 'brightness(0) saturate(100%) invert(61%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(89%)' }}
                      />
                    </button>

                    {mobileActionsOpen === item.id && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 mobile-actions-dropdown w-32 mx-auto">
                        <div className="py-1">
                          <button
                            onClick={() => {
                              handleReturnItem(item);
                              setMobileActionsOpen(null);
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50"
                          >
                            Вернуть
                          </button>
                        </div>
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
                    {expandedDocId === item.id ? 'Скрыть детали' : 'Показать детали'}
                  </button>
                </div>

                {/* Детали документа - мобильная версия */}
                {expandedDocId === item.id && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="grid grid-cols-1 gap-4">
                      {/* Фото */}
                      <div>
                        <PhotoThumbnail photos={item.product?.photos || []} onImageClick={handleImageClick} />
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
            ))}
          </div>
        </>
      )}

      <ImageModal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        photos={selectedImages.photos}
        initialIndex={selectedImages.initialIndex}
        alt="Фото товара"
      />

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
    </div>
  );
};
