import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { updateProduct, uploadPhotos, clearProductError, resetProducts, fetchProduct, deleteProductPhotos } from '../../../redux/slices/ProductSlice';
import { fetchStorageLocations } from '../../../redux/slices/OrganizationSlice';
import VehicleModal from '../AddPart/VehicleModal';
import PhotoGallery from '../../../components/PhotoGallery/PhotoGallery';
import ImageModal from '../../../components/ImageModal/ImageModal';

const EditPart = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const productStatus = useSelector((state) => state.products.loading);
  const productError = useSelector((state) => state.products.error);
  const currentProduct = useSelector((state) => state.products.currentProduct);
  const { storageLocations } = useSelector((state) => state.organization);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState({ photos: [], initialIndex: 0 });

  useEffect(() => {
    if (user?.organization_id) {
      dispatch(fetchStorageLocations(user.organization_id));
    }
  }, [dispatch, user?.organization_id]);

  useEffect(() => {
    if (id) {
      dispatch(fetchProduct(parseInt(id, 10)));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (productError) {
      alert(`Ошибка: ${typeof productError === 'string' ? productError : JSON.stringify(productError)}`);
      dispatch(clearProductError());
    }
  }, [productError, dispatch]);

  useEffect(() => {
    return () => {
      dispatch(resetProducts());
    };
  }, [dispatch]);

  const [formData, setFormData] = useState({
    article: '',
    internal_code: '',
    name: '',
    brand: '',
    description: '',
    condition: 'новый',
    quantity: '',
    sale_price: '',
    storage_location_id: '',
  });

  const [photos, setPhotos] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [productLoaded, setProductLoaded] = useState(false);
  const [selectedPhotosForRemoval, setSelectedPhotosForRemoval] = useState([]);

  // Загрузка данных продукта при получении
  useEffect(() => {
    if (currentProduct && !productLoaded) {
      setFormData({
        article: currentProduct.article || '',
        internal_code: currentProduct.internal_code || '',
        name: currentProduct.name || '',
        brand: currentProduct.brand || '',
        description: currentProduct.description || '',
        condition: currentProduct.is_new ? 'новый' : 'б/у',
        quantity: currentProduct.quantity?.toString() || '',
        sale_price: currentProduct.price?.toString() || '',
        storage_location_id: currentProduct.storage_location_id?.toString() || '',
      });

      // Сохраняем полные объекты ProductPhoto для доступа к ID
      const photos = (currentProduct.photos || []).filter(photo =>
        photo && (photo.photo_url || typeof photo === 'string')
      );

      setExistingPhotos(photos);
      setProductLoaded(true);

      // Установка выбранного автомобиля
      if (currentProduct.compatible_vehicles && currentProduct.compatible_vehicles.length > 0) {
        setSelectedVehicle(currentProduct.compatible_vehicles[0]);
      }
    }
  }, [currentProduct, productLoaded]);

  // Сброс состояния при изменении ID продукта
  useEffect(() => {
    setProductLoaded(false);
    setExistingPhotos([]);
    setPhotos([]);
    setSelectedPhotosForRemoval([]);
  }, [id]);

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files);
    setPhotos((prev) => [...prev, ...files]);
  };

  const handlePhotoRemove = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveSelectedPhotos = async () => {
    if (selectedPhotosForRemoval.length === 0) {
      return;
    }

    try {
      await dispatch(deleteProductPhotos({
        productId: parseInt(id, 10),
        photoIds: selectedPhotosForRemoval
      }));

      // Локально обновляем состояние
      setExistingPhotos((prev) => prev.filter((photo) => {
        if (typeof photo === 'object' && photo.id) {
          return !selectedPhotosForRemoval.includes(photo.id);
        }
        return true; // Для строковых URL оставляем как есть
      }));

      setSelectedPhotosForRemoval([]);
    } catch (error) {
      console.error('Ошибка при удалении фото:', error);
    }
  };

  const handlePhotoSelectionToggle = (photoId) => {
    setSelectedPhotosForRemoval((prev) =>
      prev.includes(photoId)
        ? prev.filter((id) => id !== photoId)
        : [...prev, photoId]
    );
  };

  const handleDeleteSinglePhoto = async (photoId) => {
    try {
      await dispatch(deleteProductPhotos({
        productId: parseInt(id, 10),
        photoIds: [photoId]
      }));

      // Локально обновляем состояние
      setExistingPhotos((prev) => prev.filter((photo) => {
        if (typeof photo === 'object' && photo.id) {
          return photo.id !== photoId;
        }
        return true;
      }));
    } catch (error) {
      console.error('Ошибка при удалении фото:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageClick = (photos, initialIndex) => {
    setSelectedImages({ photos, initialIndex });
    setImageModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user?.organization_id) {
      alert('Организация не найдена');
      return;
    }

    let photoUrls = [];
    if (photos.length > 0) {
      const uploadResult = await dispatch(uploadPhotos(photos));
      if (uploadPhotos.rejected.match(uploadResult)) {
        return;
      }
      photoUrls = uploadResult.payload;
    }

    // Комбинируем существующие и новые фото
    const allPhotoUrls = [
      ...existingPhotos
        .filter(photo => photo) // Фильтруем null/undefined
        .map(photo => {
          // Если photo - строка, возвращаем как есть
          if (typeof photo === 'string') return photo;
          // Если photo - объект с photo_url, возвращаем photo_url
          if (photo.photo_url) return photo.photo_url;
          // Иначе пропускаем
          return null;
        })
        .filter(url => url !== null),
      ...photoUrls
    ];

    const productData = {
      article: formData.article,
      internal_code: formData.internal_code,
      name: formData.name,
      brand: formData.brand,
      description: formData.description || null,
      price: parseFloat(formData.sale_price),
      quantity: parseInt(formData.quantity, 10),
      is_new: formData.condition === 'новый',
      storage_location_id: parseInt(formData.storage_location_id, 10),
      vehicle_ids: selectedVehicle ? [selectedVehicle.id] : [],
      photos: allPhotoUrls.length > 0 ? allPhotoUrls : null,
    };

    try {
      const result = await dispatch(updateProduct({ id: parseInt(id, 10), productData }));
      if (updateProduct.rejected.match(result)) {
        return;
      }

      // Очищаем выбранные фото после успешного сохранения
      setSelectedPhotosForRemoval([]);

      navigate('/my-parts');
    } catch (err) {
      console.error(err);
      alert('Неожиданная ошибка при обновлении запчасти');
    }
  };

  if (!user || !user.is_seller) {
    navigate('/');
    return null;
  }

  if (!currentProduct) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8 text-gray-500">Загрузка данных запчасти...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Редактировать запчасть</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Артикул */}
        <div>
          <label className="block text-sm font-medium">Артикул *</label>
          <input
            name="article"
            value={formData.article}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border rounded-md"
          />
        </div>

        {/* Внутренний код */}
        <div>
          <label className="block text-sm font-medium">Внутренний код *</label>
          <input
            name="internal_code"
            value={formData.internal_code}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border rounded-md"
          />
        </div>

        {/* Наименование */}
        <div>
          <label className="block text-sm font-medium">Наименование *</label>
          <input
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border rounded-md"
          />
        </div>

        {/* Бренд */}
        <div>
          <label className="block text-sm font-medium">Бренд *</label>
          <input
            name="brand"
            value={formData.brand}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border rounded-md"
          />
        </div>

        {/* Описание */}
        <div>
          <label className="block text-sm font-medium">Описание</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows="4"
            className="mt-1 block w-full px-3 py-2 border rounded-md"
            placeholder="Введите описание запчасти..."
          />
        </div>

        {/* Фото */}
        <div>
          <label className="block text-sm font-medium">Фотографии</label>

          {/* Существующие фото */}
          {existingPhotos.length > 0 && (
            <div className="mt-2 mb-4">
              <p className="text-sm text-gray-600 mb-2">Существующие фотографии:</p>
              <PhotoGallery
                photos={existingPhotos || []}
                onImageClick={handleImageClick}
                selectedPhotos={selectedPhotosForRemoval}
                onPhotoSelect={handlePhotoSelectionToggle}
                onDeletePhoto={existingPhotos.length === 1 ? handleDeleteSinglePhoto : null}
              />
              {selectedPhotosForRemoval.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleRemoveSelectedPhotos}
                    className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                  >
                    Удалить выбранные ({selectedPhotosForRemoval.length})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Добавление новых фото */}
          <input
            type="file"
            multiple
            accept="image/*,image/jfif,image/jfif-tbn"
            onChange={handlePhotoAdd}
            className="mt-1"
          />
          {photos.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-600 mb-2">Новые фотографии:</p>
              <div className="flex flex-wrap gap-2">
                {photos.map((file, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`new-${idx}`}
                      className="w-16 h-16 object-contain rounded border"
                    />
                    <button
                      type="button"
                      onClick={() => handlePhotoRemove(idx)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow"
                    >
                      <img src="/img/close_sm.svg" alt="Удалить" className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Состояние */}
        <div>
          <label className="block text-sm font-medium">Состояние</label>
          <select
            name="condition"
            value={formData.condition}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border rounded-md"
          >
            <option value="новый">Новый</option>
            <option value="б/у">Б/у</option>
          </select>
        </div>

        {/* Автомобиль */}
        {selectedVehicle && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <span className="text-xs text-gray-500">Марка</span>
              <div className="font-medium">{selectedVehicle.brand}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Модель</span>
              <div className="font-medium">{selectedVehicle.model}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Поколение</span>
              <div className="font-medium">{selectedVehicle.generation || '—'}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Двигатель</span>
              <div className="font-medium">{selectedVehicle.engine || '—'}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500">КПП</span>
              <div className="font-medium">{selectedVehicle.transmission || '—'}</div>
            </div>
            {selectedVehicle.vin && (
              <div>
                <span className="text-xs text-gray-500">VIN</span>
                <div className="font-medium">{selectedVehicle.vin}</div>
              </div>
            )}
            {selectedVehicle.mileage && (
              <div>
                <span className="text-xs text-gray-500">Пробег</span>
                <div className="font-medium">{selectedVehicle.mileage.toLocaleString()} км</div>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsVehicleModalOpen(true)}
          className="text-indigo-600 underline"
        >
          {selectedVehicle ? 'Изменить автомобиль' : 'Выбрать или добавить автомобиль'}
        </button>

        {/* Количество */}
        <div>
          <label className="block text-sm font-medium">Количество *</label>
          <input
            name="quantity"
            type="number"
            min="0"
            value={formData.quantity}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border rounded-md"
          />
        </div>

        {/* Цена продажи */}
        <div>
          <label className="block text-sm font-medium">Цена продажи (₽) *</label>
          <input
            name="sale_price"
            type="number"
            step="0.01"
            min="0"
            value={formData.sale_price}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border rounded-md"
          />
        </div>

        {/* Склад */}
        <div>
          <label className="block text-sm font-medium">Склад *</label>
          <select
            name="storage_location_id"
            value={formData.storage_location_id}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border rounded-md"
          >
            <option value="">Выберите склад</option>
            {storageLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.address || `Склад #${loc.id}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={productStatus}
            className={`px-4 py-2 rounded-md ${productStatus
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
              } text-white`}
          >
            {productStatus ? 'Обновление...' : 'Обновить запчасть'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/my-parts')}
            className="px-4 py-2 border border-gray-300 rounded-md"
          >
            Отмена
          </button>
        </div>
      </form>

      <ImageModal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        photos={selectedImages.photos}
        initialIndex={selectedImages.initialIndex}
        alt="Фото товара"
      />

      <VehicleModal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        onSelectVehicle={setSelectedVehicle}
        selectedVehicle={selectedVehicle}
      />
    </div>
  );
};

export default EditPart;
