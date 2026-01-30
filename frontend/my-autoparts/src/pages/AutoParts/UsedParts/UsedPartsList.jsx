import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import PhotoThumbnail from '../../../components/PhotoGallery/PhotoThumbnail';
import ImageModal from '../../../components/ImageModal/ImageModal';
import {
  addUsedPartsToCart,
  removeUsedFromCart,
  updateUsedCartItemQuantity,
  selectCart,
  selectCartLoading
} from '../../../redux/slices/CartSlice';
import {
  selectMyParts,
  selectMyPartsStatus,
  selectMyPartsError,
  searchUsedParts,
  selectMyParts as selectMyPartsItems
} from '../../../redux/slices/ProductSlice';
import { selectSearchQuery } from '../../../redux/slices/RosskoSlice';
import { fetchStorageLocations, fetchOrganization } from '../../../redux/slices/OrganizationSlice';

// Селекторы для б/у запчастей
const selectUsedPartsData = (state) => state.products.usedPartsData;
const selectUsedPartsLoading = (state) => state.products.loading;
const selectAnalogsLoading = (state) => state.products.analogsLoading;



// Функция форматирования телефона
const formatPhoneNumber = (phone) => {
  if (!phone) return '';

  // Удаляем все нецифровые символы
  let digits = phone.replace(/\D/g, '');

  // Если начинается с 7 или 8, заменяем на 7
  if (digits.startsWith('7') || digits.startsWith('8')) {
    digits = '7' + digits.slice(1);
  }

  // Форматируем как +7 (XXX) XXX-XX-XX
  let formatted = '+7 ';
  if (digits.length > 1) {
    formatted += '(' + digits.slice(1, 4);
  }
  if (digits.length > 4) {
    formatted += ') ' + digits.slice(4, 7);
  }
  if (digits.length > 7) {
    formatted += '-' + digits.slice(7, 9);
  }
  if (digits.length > 9) {
    formatted += '-' + digits.slice(9, 11);
  }

  return formatted;
};

const UsedPartsList = () => {
  const dispatch = useDispatch();

  const usedPartsData = useSelector(selectUsedPartsData);
  const myPartsItems = useSelector(selectMyPartsItems);
  const searchQuery = useSelector(selectSearchQuery);
  const status = useSelector(selectUsedPartsLoading) ? 'loading' : 'idle';
  const analogsLoading = useSelector(selectAnalogsLoading);
  const error = useSelector(selectMyPartsError);
  const { storageLocations, data: organization } = useSelector((state) => state.organization);
  const user = useSelector((state) => state.auth.user);
  const cart = useSelector(selectCart);
  const cartLoading = useSelector(selectCartLoading);
  const [addingToCartId, setAddingToCartId] = useState(null);
  const availableParts = searchQuery
    ? (usedPartsData?.available_parts || [])
    : (myPartsItems || []);
  const analogParts = usedPartsData?.analog_parts || [];

  const [expandedPartId, setExpandedPartId] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState({ photos: [], initialIndex: 0 });

  useEffect(() => {
    // Загружаем информацию об организации только для авторизованных продавцов и сотрудников
    if ((user?.is_seller || user?.is_employee) && user.organization_id) {
      dispatch(fetchStorageLocations(user.organization_id));
      dispatch(fetchOrganization(user.organization_id));
    }
  }, [dispatch, user]);

  const toggleExpand = (id) => {
    setExpandedPartId(expandedPartId === id ? null : id);
  };

  const handleImageClick = (photos, initialIndex) => {
    setSelectedImages({ photos, initialIndex });
    setImageModalOpen(true);
  };

  const getStorageAddress = (locationId, partStorageLocation) => {
    if (partStorageLocation?.address) return partStorageLocation.address;
    if (!locationId) return '—';
    const loc = storageLocations.find(l => l.id === locationId);
    return loc ? (loc.address || `Склад #${locationId}`) : `Склад #${locationId}`;
  };

  // Получаем количество товара в корзине
  const getCartQuantity = (partId) => {
    if (!cart?.used_parts_items) return 0;
    const cartItem = cart.used_parts_items.find(item => item.product_id === partId);
    return cartItem ? cartItem.quantity : 0;
  };

  // Получаем информацию о наличии товара
  const getStockAvailability = (part) => {
    const availableOnCurrent = part.quantity || 0;
    const currentCartQuantity = getCartQuantity(part.id);

    return {
      availableOnCurrent,
      currentCartQuantity,
      isLimited: currentCartQuantity >= availableOnCurrent,
      noStock: availableOnCurrent <= currentCartQuantity
    };
  };

  // Функция добавления в корзину
  const handleAddToCart = async (part) => {
    if (!user) {
      // Можно добавить редирект на логин или уведомление
      return;
    }
    setAddingToCartId(part.id);
    try {
      const currentCartQuantity = getCartQuantity(part.id);
      const availableStock = part.quantity || 0;

      if (availableStock <= currentCartQuantity) {
        setAddingToCartId(null);
        return;
      }

      await dispatch(addUsedPartsToCart({ product_id: part.id, quantity: 1 })).unwrap();
    } catch (error) {
      console.error('Ошибка добавления в корзину:', error);
    } finally {
      setAddingToCartId(null);
    }
  };

  // Функция уменьшения количества в корзине
  const handleRemoveFromCart = async (part) => {
    setAddingToCartId(part.id);
    try {
      const cartItem = cart?.used_parts_items?.find(item => item.product_id === part.id);

      if (cartItem) {
        if (cartItem.quantity > 1) {
          await dispatch(updateUsedCartItemQuantity({ itemId: cartItem.id, quantity: cartItem.quantity - 1 })).unwrap();
        } else {
          await dispatch(removeUsedFromCart(cartItem.id)).unwrap();
        }
      }
    } catch (error) {
      console.error('Ошибка изменения количества в корзине:', error);
    } finally {
      setAddingToCartId(null);
    }
  };


  if (status === 'loading') {
    return (
      <div className="mt-5 text-center py-10">
        <p className="text-lg text-gray-600">Загрузка запчастей...</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="mt-5 text-center py-10">
        <p className="text-lg text-red-600">Ошибка загрузки запчастей</p>
        <p className="text-sm text-gray-500 mt-2">{error}</p>
      </div>
    );
  }

  const hasAvailableParts = availableParts.length > 0;
  const hasAnalogParts = analogParts.length > 0;

  if (!hasAvailableParts && !hasAnalogParts) {
    return (
      <div className="mt-16 flex flex-col items-center text-center max-w-2xl mx-auto px-4">
        <div className="bg-gray-100 p-6 rounded-full mb-8">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 sm:h-12 sm:w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Нет б/у запчастей</h2>
        <p className="text-gray-600 text-base leading-relaxed">Б/у запчасти по данному поисковому запросу не найдены.</p>
        <p className="text-sm text-gray-500 mt-4">Попробуйте изменить поисковый запрос или проверьте правильность написания.</p>
      </div>
    );
  }


  return (
    <div className="mt-4 sm:mt-5 px-0">
      {/* В наличии */}
      {hasAvailableParts && (
        <>
          <div className="font-medium text-lg sm:text-lg my-6 sm:my-10 px-4 sm:px-0">
            <h2 className="border-b-4 border-blue-500 pb-2 inline-block">В наличии</h2>
          </div>

          {/* Десктопная версия - таблица */}
          <div className="hidden md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Бренд</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Артикул</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Внутренний код</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Состояние</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Склад</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Остаток</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена, ₽</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">К заказу</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {availableParts.map((part) => (
                  <UsedPartRow
                    key={part.id}
                    part={part}
                    organization={organization}
                    storageLocations={storageLocations}
                    toggleExpand={toggleExpand}
                    expandedPartId={expandedPartId}
                    handleImageClick={handleImageClick}
                    getStorageAddress={getStorageAddress}
                    getCartQuantity={getCartQuantity}
                    getStockAvailability={getStockAvailability}
                    handleAddToCart={handleAddToCart}
                    handleRemoveFromCart={handleRemoveFromCart}
                    addingToCartId={addingToCartId}
                    cartLoading={cartLoading}
                    user={user}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Мобильная версия - карточки */}
          <div className="md:hidden space-y-4">
            {availableParts.map((part) => (
              <UsedPartCard
                key={part.id}
                part={part}
                organization={organization}
                storageLocations={storageLocations}
                toggleExpand={toggleExpand}
                expandedPartId={expandedPartId}
                handleImageClick={handleImageClick}
                getStorageAddress={getStorageAddress}
                getCartQuantity={getCartQuantity}
                getStockAvailability={getStockAvailability}
                handleAddToCart={handleAddToCart}
                handleRemoveFromCart={handleRemoveFromCart}
                addingToCartId={addingToCartId}
                cartLoading={cartLoading}
                user={user}
              />
            ))}
          </div>
        </>
      )}

      {/* Аналоги */}
      {analogsLoading ? (
        <div className="mt-10 text-center py-5 bg-gray-50 rounded-lg">
          <p className="text-gray-600 animate-pulse">Поиск аналогов...</p>
        </div>
      ) : hasAnalogParts && (
        <>
          <div className="font-medium text-lg sm:text-lg my-6 sm:my-10 px-4 sm:px-0">
            <h2 className="border-b-4 border-blue-500 pb-2 inline-block">Аналоги</h2>
          </div>

          {/* Десктопная версия - таблица */}
          <div className="hidden md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Бренд</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Артикул</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Внутренний код</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Состояние</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Склад</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Остаток</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена, ₽</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">К заказу</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analogParts.map((part) => (
                  <UsedPartRow
                    key={part.id}
                    part={part}
                    organization={organization}
                    storageLocations={storageLocations}
                    toggleExpand={toggleExpand}
                    expandedPartId={expandedPartId}
                    handleImageClick={handleImageClick}
                    getStorageAddress={getStorageAddress}
                    getCartQuantity={getCartQuantity}
                    getStockAvailability={getStockAvailability}
                    handleAddToCart={handleAddToCart}
                    handleRemoveFromCart={handleRemoveFromCart}
                    addingToCartId={addingToCartId}
                    cartLoading={cartLoading}
                    user={user}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Мобильная версия - карточки */}
          <div className="md:hidden space-y-4">
            {analogParts.map((part) => (
              <UsedPartCard
                key={part.id}
                part={part}
                organization={organization}
                storageLocations={storageLocations}
                toggleExpand={toggleExpand}
                expandedPartId={expandedPartId}
                handleImageClick={handleImageClick}
                getStorageAddress={getStorageAddress}
                getCartQuantity={getCartQuantity}
                getStockAvailability={getStockAvailability}
                handleAddToCart={handleAddToCart}
                handleRemoveFromCart={handleRemoveFromCart}
                addingToCartId={addingToCartId}
                cartLoading={cartLoading}
                user={user}
              />
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
    </div>
  );
};

// Вспомогательный компонент для строки таблицы
const UsedPartRow = ({ 
  part, organization, storageLocations, toggleExpand, expandedPartId, handleImageClick, getStorageAddress,
  getCartQuantity, getStockAvailability, handleAddToCart, handleRemoveFromCart, addingToCartId, cartLoading, user
}) => (
  <React.Fragment>
    {/* Основная строка */}
    <tr
      className="cursor-pointer hover:bg-gray-50"
      onClick={() => toggleExpand(part.id)}
    >
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{part.brand || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{part.article || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 px-2 py-1 rounded">
        {part.internal_code || '—'}
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">{part.name || '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        {part.is_new ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Новая
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Б/у
          </span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getStorageAddress(part.storage_location_id, part.storage_location)}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{part.quantity || 0} шт.</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{part.price ? `${part.price} ₽` : '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <div className="flex items-center space-x-2">
          {(() => {
            const cartQuantity = getCartQuantity(part.id);
            const stockInfo = getStockAvailability(part);
            const isAdding = addingToCartId === part.id;

            return cartQuantity > 0 ? (
              <div className="flex items-center space-x-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFromCart(part);
                  }}
                  disabled={isAdding || cartLoading}
                  className="w-6 h-6 flex items-center justify-center text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                >
                  −
                </button>
                <span className="text-xs font-medium w-6 text-center">
                  {cartQuantity}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToCart(part);
                  }}
                  disabled={isAdding || cartLoading || stockInfo.noStock}
                  className="w-6 h-6 flex items-center justify-center text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                >
                  +
                </button>
                {stockInfo.noStock && (
                  <div className="relative group">
                    <svg className="w-4 h-4 text-orange-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                      Товара больше нет в наличии
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToCart(part);
                }}
                disabled={isAdding || cartLoading}
                className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding && (
                  <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isAdding ? 'Добавление...' : 'В корзину'}
              </button>
            );
          })()}
        </div>
      </td>
    </tr>

    {/* Раскрывающаяся карточка */}
    {expandedPartId === part.id && (
      <tr className="bg-gray-50">
        <td colSpan="9" className="px-6 py-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Фото */}
            <div>
              <PhotoThumbnail photos={part.photos || []} onImageClick={handleImageClick} />

              {/* Контактный телефон организации */}
              {(organization?.phone || part.organization?.phone) && (
                <div className="mt-4 flex items-center gap-2 p-2 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-md">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-indigo-700 font-medium mb-0.5">Связаться с продавцом</div>
                    <div className="text-sm font-semibold text-indigo-800">
                      {formatPhoneNumber(organization?.phone || part.organization?.phone)}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <a
                      href={`tel:${(organization?.phone || part.organization?.phone).replace(/\D/g, '')}`}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded transition-colors"
                    >
                      Позвонить
                    </a>
                  </div>
                </div>
              )}
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

// Вспомогательный компонент для мобильной карточки
const UsedPartCard = ({ 
  part, organization, storageLocations, toggleExpand, expandedPartId, handleImageClick, getStorageAddress,
  getCartQuantity, getStockAvailability, handleAddToCart, handleRemoveFromCart, addingToCartId, cartLoading, user
}) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className="flex-1 pr-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base font-semibold text-gray-900">{part.brand || '—'}</span>
          <span className="text-sm text-gray-400">•</span>
          <span className="text-sm text-gray-500 font-mono">{part.article || '—'}</span>
        </div>
        <h3 className="text-base font-medium text-gray-800 mb-3 leading-tight">{part.name || '—'}</h3>
        <div className="flex items-center gap-2 mb-3">
          {part.is_new ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              Новая
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
              Б/у
            </span>
          )}
          {part.internal_code && (
            <span className="text-sm text-gray-500 font-mono">{part.internal_code}</span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-lg font-bold text-gray-900 mb-1">
          {part.price ? `${part.price} ₽` : '—'}
        </div>
        <div className="text-sm text-gray-600">Остаток: {part.quantity || 0} шт.</div>
      </div>
    </div>

    <div className="flex justify-between items-center pt-3 border-t border-gray-100">
      <div className="flex flex-col">
        <div className="text-sm text-gray-600">{getStorageAddress(part.storage_location_id, part.storage_location)}</div>
        <button
          onClick={() => toggleExpand(part.id)}
          className="text-indigo-600 text-sm font-medium hover:text-indigo-800 transition-colors text-left mt-1"
        >
          {expandedPartId === part.id ? 'Скрыть детали' : 'Показать детали'}
        </button>
      </div>
      <div>
        {(() => {
          const cartQuantity = getCartQuantity(part.id);
          const stockInfo = getStockAvailability(part);
          const isAdding = addingToCartId === part.id;

          return cartQuantity > 0 ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFromCart(part);
                }}
                disabled={isAdding || cartLoading}
                className="w-10 h-10 flex items-center justify-center text-xl font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                −
              </button>
              <span className="text-base font-semibold w-8 text-center">
                {cartQuantity}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToCart(part);
                }}
                disabled={isAdding || cartLoading || stockInfo.noStock}
                className="w-10 h-10 flex items-center justify-center text-xl font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddToCart(part);
              }}
              disabled={isAdding || cartLoading}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px] flex items-center justify-center min-w-[120px]"
            >
              {isAdding ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'В корзину'}
            </button>
          );
        })()}
      </div>
    </div>

    {/* Раскрывающаяся карточка для мобильной версии */}
    {expandedPartId === part.id && (
      <div className="mt-4 pt-4 border-t border-gray-200">
        {/* Фото */}
        <div className="mb-4">
          <PhotoThumbnail photos={part.photos || []} onImageClick={handleImageClick} />
        </div>

        {/* Контактный телефон организации */}
        {(organization?.phone || part.organization?.phone) && (
          <div className="flex items-center gap-2 p-2 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-md">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-indigo-700 font-medium mb-0.5">Связаться с продавцом</div>
              <div className="text-sm font-semibold text-indigo-800">
                {formatPhoneNumber(organization?.phone || part.organization?.phone)}
              </div>
            </div>
            <div className="flex-shrink-0">
              <a
                href={`tel:${(organization?.phone || part.organization?.phone).replace(/\D/g, '')}`}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded transition-colors"
              >
                Позвонить
              </a>
            </div>
          </div>
        )}

        {/* Описание */}
        {part.description && (
          <div className="mt-4">
            <span className="text-xs text-gray-500 block mb-1">Описание</span>
            <div className="text-sm text-gray-900">{part.description}</div>
          </div>
        )}

        {/* Автомобиль(и) */}
        {part.compatible_vehicles && part.compatible_vehicles.length > 0 && (
          <div className="mt-4">
            <span className="text-xs text-gray-500 block mb-2">Автомобиль</span>
            <div className="space-y-2">
              {part.compatible_vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded border text-xs"
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
                    <div>
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
    )}
  </div>
);

export default UsedPartsList;