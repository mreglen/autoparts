import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PhotoGallery from '../../components/PhotoGallery/PhotoGallery';
import ImageModal from '../../components/ImageModal/ImageModal';
import { fetchStockIns } from '../../redux/slices/StockInSlice';
import { Link } from 'react-router-dom';
import VehicleModal from '../MyParts/AddPart/VehicleModal';

const StockInRow = ({ doc, onToggleExpand, isExpanded }) => (
  <React.Fragment>
    <tr
      className="cursor-pointer hover:bg-gray-50"
      onClick={onToggleExpand}
    >
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doc.product?.brand || '—'}</td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{doc.product?.article || '—'}</td>
      <td className="px-2 sm:px-6 py-4 text-sm text-gray-500 max-w-0 truncate sm:max-w-none sm:whitespace-normal">{doc.product?.name || '—'}</td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.quantity}</td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.sale_price ? `${doc.sale_price.toFixed(2)} ₽` : '—'}</td>
      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(doc.created_at).toLocaleDateString('ru-RU')}
      </td>
    </tr>

    {/* Раскрывающаяся карточка */}
    {isExpanded && (
      <tr className="bg-gray-50">
        <td colSpan="6" className="px-6 py-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Фото */}
            <div>
              <PhotoGallery photos={doc.product?.photos || []} />
            </div>

            {/* Информация */}
            <div className="space-y-4">

              {/* Описание */}
              <div>
                <span className="text-xs text-gray-500">Описание</span>
                <div className="font-medium mt-1">
                  {doc.product?.description || '—'}
                </div>
              </div>

              {/* Дополнительная информация */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">Дата поступления</span>
                  <div className="font-medium mt-1">
                    {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Склад</span>
                  <div className="font-medium mt-1">
                    {doc.storage_location?.address || `Склад #${doc.storage_location_id}`}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Ответственный</span>
                  <div className="font-medium mt-1">
                    {doc.creator_name || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Состояние</span>
                  <div className="font-medium mt-1">
                    {doc.product?.is_new ? (
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
              {doc.product?.compatible_vehicles && doc.product.compatible_vehicles.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500">Автомобиль</span>
                  <div className="mt-2 space-y-3">
                    {doc.product.compatible_vehicles.map((vehicle) => (
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

const StockInList = () => {
  const dispatch = useDispatch();
  const { items: stockIns, loading, error } = useSelector((state) => state.stockIn);

  // Состояние для модального окна автомобилей
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState({ url: '', alt: '' });

  const handleImageClick = (imageUrl, alt) => {
    setSelectedImage({ url: imageUrl, alt });
    setImageModalOpen(true);
  };

  const toggleExpand = (id) => {
    setExpandedDocId(expandedDocId === id ? null : id);
  };

  useEffect(() => {
    dispatch(fetchStockIns());
  }, [dispatch]);

  if (loading) return <div className="p-6">Загрузка документов...</div>;
  if (error) return <div className="p-6 text-red-600">Ошибка: {error}</div>;

  // Обработчик выбора автомобиля (можно оставить пустым, если не нужен)
  const handleSelectVehicle = (vehicle) => {
    console.log('Выбран автомобиль:', vehicle);
    // Здесь можно, например, привязать к документу — если потребуется позже
  };

  return (
    <div className="mt-5">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Документы поступления</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setIsVehicleModalOpen(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
          >
            Автомобили
          </button>
          <Link
            to="/my-parts"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
          >
            ← Назад к запчастям
          </Link>
        </div>
      </div>

      <div className="font-medium text-base mb-4">
        <h2 className="border-b-4 border-blue-500 pb-2 inline-block">Список поступлений</h2>
      </div>

      {stockIns.length === 0 ? (
        <div className="mt-12 text-center text-gray-500">
          Нет документов поступления.
        </div>
      ) : (
        <div className="w-full">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Бренд</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Артикул</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кол-во</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена, ₽</th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата поступления</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stockIns.map((doc) => (
                <StockInRow
                  key={doc.id}
                  doc={doc}
                  onToggleExpand={() => toggleExpand(doc.id)}
                  isExpanded={expandedDocId === doc.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно автомобилей */}
      <ImageModal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        imageUrl={selectedImage.url}
        alt={selectedImage.alt}
      />

      <VehicleModal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        onSelectVehicle={handleSelectVehicle}
      />
    </div>
  );
};

export default StockInList;