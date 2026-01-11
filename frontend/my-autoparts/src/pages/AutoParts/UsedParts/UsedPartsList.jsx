import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import PhotoThumbnail from '../../../components/PhotoGallery/PhotoThumbnail';
import ImageModal from '../../../components/ImageModal/ImageModal';
import {
  selectMyParts,
  selectMyPartsStatus,
  selectMyPartsError,
  searchUsedParts
} from '../../../redux/slices/ProductSlice';
import { fetchStorageLocations, fetchOrganization } from '../../../redux/slices/OrganizationSlice';

// Селекторы для б/у запчастей
const selectUsedPartsData = (state) => state.products.usedPartsData;
const selectUsedPartsLoading = (state) => state.products.loading;



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
  const status = useSelector(selectUsedPartsLoading) ? 'loading' : 'idle';
  const error = useSelector(selectMyPartsError);
  const { storageLocations, data: organization } = useSelector((state) => state.organization);
  const user = useSelector((state) => state.auth.user);

  // Получаем данные из usedPartsData
  const availableParts = usedPartsData?.available_parts || [];
  const analogParts = usedPartsData?.analog_parts || [];

  const [expandedPartId, setExpandedPartId] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState({ photos: [], initialIndex: 0 });

  useEffect(() => {
    // Загружаем информацию об организации только для авторизованных продавцов
    if (user?.is_seller && user.organization_id) {
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

  const getStorageAddress = (locationId) => {
    if (!locationId) return '—';
    const loc = storageLocations.find(l => l.id === locationId);
    return loc ? (loc.address || `Склад #${locationId}`) : `Склад #${locationId}`;
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена, ₽</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
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
              />
            ))}
          </div>
        </>
      )}

      {/* Аналоги */}
      {hasAnalogParts && (
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена, ₽</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
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
const UsedPartRow = ({ part, organization, storageLocations, toggleExpand, expandedPartId, handleImageClick, getStorageAddress }) => (
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
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Б/у
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getStorageAddress(part.storage_location_id)}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{part.price ? `${part.price} ₽` : '—'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <div className="flex items-center space-x-2">
          <input
            type="number"
            min="1"
            defaultValue="1"
            className="w-8 h-8 border border-gray-300 rounded-md text-center"
          />
          <button className="h-8 w-8 bg-red-500 text-white rounded-md flex items-center justify-center">
            🛒
          </button>
        </div>
      </td>
    </tr>

    {/* Раскрывающаяся карточка */}
    {expandedPartId === part.id && (
      <tr className="bg-gray-50">
        <td colSpan="8" className="px-6 py-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Фото */}
            <div>
              <PhotoThumbnail photos={part.photos || []} onImageClick={handleImageClick} />

              {/* Контактный телефон организации */}
              {organization?.phone && (
                <div className="mt-4 flex items-center gap-2 p-2 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-md">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-indigo-700 font-medium mb-0.5">Связаться с продавцом</div>
                    <div className="text-sm font-semibold text-indigo-800">
                      {formatPhoneNumber(organization.phone)}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <a
                      href={`tel:${organization.phone.replace(/\D/g, '')}`}
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
const UsedPartCard = ({ part, organization, storageLocations, toggleExpand, expandedPartId, handleImageClick, getStorageAddress }) => (
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
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            Б/у
          </span>
          {part.internal_code && (
            <span className="text-sm text-gray-500 font-mono">{part.internal_code}</span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-lg font-bold text-gray-900 mb-1">
          {part.price ? `${part.price} ₽` : '—'}
        </div>
        <div className="text-sm text-gray-600">{getStorageAddress(part.storage_location_id)}</div>
      </div>
    </div>

    <div className="flex justify-between items-center pt-3 border-t border-gray-100">
      <button
        onClick={() => toggleExpand(part.id)}
        className="text-indigo-600 text-sm font-medium hover:text-indigo-800 transition-colors px-2 py-1"
      >
        {expandedPartId === part.id ? 'Скрыть детали' : 'Показать детали'}
      </button>
      <div className="flex items-center space-x-3">
        <input
          type="number"
          min="1"
          defaultValue="1"
          className="w-10 h-10 border border-gray-300 rounded-lg text-center text-sm font-medium"
        />
        <button className="w-10 h-10 bg-red-500 text-white rounded-lg flex items-center justify-center text-lg shadow hover:bg-red-600 transition-colors">
          🛒
        </button>
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
        {organization?.phone && (
          <div className="flex items-center gap-2 p-2 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-md">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-indigo-700 font-medium mb-0.5">Связаться с продавцом</div>
              <div className="text-sm font-semibold text-indigo-800">
                {formatPhoneNumber(organization.phone)}
              </div>
            </div>
            <div className="flex-shrink-0">
              <a
                href={`tel:${organization.phone.replace(/\D/g, '')}`}
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