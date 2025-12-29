// src/pages/StockOut/StockOut.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PhotoGallery from '../../components/PhotoGallery/PhotoGallery';
import ImageModal from '../../components/ImageModal/ImageModal';
import { fetchStockOuts } from '../../redux/slices/StockOutSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import { Navigate } from 'react-router-dom';

const StockOutRow = ({ item, getStorageAddress, onToggleExpand, isExpanded }) => (
  <React.Fragment>
    <tr
      className="cursor-pointer hover:bg-gray-50"
      onClick={onToggleExpand}
    >
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.product?.brand || '—'}</td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{item.product?.article || '—'}</td>
      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{item.product?.internal_code || '—'}</td>
      <td className="px-2 sm:px-6 py-4 text-sm text-gray-500 max-w-0 truncate sm:max-w-none sm:whitespace-normal">{item.product?.name || '—'}</td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {item.sale_price != null ? `${item.sale_price.toFixed(2)} ₽` : '—'}
      </td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.sale_price > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {item.sale_price > 0 ? 'Продажа' : 'Списание'}
        </span>
      </td>
      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.movement_date}</td>
    </tr>

    {/* Раскрывающаяся карточка */}
    {isExpanded && (
      <tr className="bg-gray-50">
        <td colSpan="8" className="px-6 py-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Фото */}
            <div>
              <PhotoGallery photos={item.product?.photos || []}/>
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

const StockOutList = () => {
  const dispatch = useDispatch();
  const { items: stockOuts, loading, error } = useSelector((state) => state.stockOut);
  const { storageLocations } = useSelector((state) => state.organization);
  const user = useSelector((state) => state.auth.user);
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState({ url: '', alt: '' });

  const handleImageClick = (imageUrl, alt) => {
    setSelectedImage({ url: imageUrl, alt });
    setImageModalOpen(true);
  };

  useEffect(() => {
    if (user?.is_seller && user.organization_id) {
      dispatch(fetchStockOuts());
      dispatch(fetchStorageLocations(user.organization_id));
    }
  }, [dispatch, user]);

  if (!user) return <Navigate to="/auth" replace />;
  if (!user.is_seller) return <Navigate to="/" replace />;

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
    <div className="mt-5">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Расходы (списание/продажа)</h1>

      {loading ? (
        <p className="text-center py-6 text-gray-600">Загрузка расходов...</p>
      ) : error ? (
        <p className="text-center py-6 text-red-600">Ошибка: {error}</p>
      ) : stockOuts.length === 0 ? (
        <p className="text-center py-6 text-gray-500">Нет записей о расходах.</p>
      ) : (
        <div className="w-full">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Бренд</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Номер</th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Внутр. код</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кол-во</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена, ₽</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тип</th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
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
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ImageModal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        imageUrl={selectedImage.url}
        alt={selectedImage.alt}
      />
    </div>
  );
};

export default StockOutList;