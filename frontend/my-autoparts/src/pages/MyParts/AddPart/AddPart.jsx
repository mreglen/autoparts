import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { createPendingProduct, uploadPhotos, clearProductError, resetProducts } from '../../../redux/slices/ProductSlice';
import { createStockIn, clearStockInError } from '../../../redux/slices/StockInSlice';
import { fetchStorageLocations } from '../../../redux/slices/OrganizationSlice';
import { fetchStorageCells } from '../../../redux/slices/StorageCellsSlice';
import VehicleModal from './VehicleModal';

const AddPart = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const productStatus = useSelector((state) => state.products.loading);
  const productError = useSelector((state) => state.products.error);
  const { storageLocations } = useSelector((state) => state.organization);
  const { storageCells, lastModified } = useSelector((state) => state.storageCells);
  const stockInError = useSelector((state) => state.stockIn.error);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  
  const [formData, setFormData] = useState({
    article: '',
    name: '',
    brand: '',
    description: '',
    condition: 'новый',
    quantity: '',
    sale_price: '',
    storage_location_id: '',
  });

  const [photos, setPhotos] = useState([]);
  const [locationCells, setLocationCells] = useState([]);
  const [cellQuantities, setCellQuantities] = useState({});

  useEffect(() => {
    if (user?.organization_id) {
      dispatch(fetchStorageLocations(user.organization_id));
    }
  }, [dispatch, user?.organization_id]);

  // Fetch storage cells when storage location changes
  useEffect(() => {
    if (formData.storage_location_id) {
      dispatch(fetchStorageCells(formData.storage_location_id))
        .then((result) => {
          if (fetchStorageCells.fulfilled.match(result)) {
            setLocationCells(Array.isArray(result.payload) ? result.payload : []);
            // Initialize cell quantities
            const initialQuantities = {};
            (Array.isArray(result.payload) ? result.payload : []).forEach(cell => {
              initialQuantities[cell.id] = '';
            });
            setCellQuantities(initialQuantities);
          }
        });
    } else {
      setLocationCells([]);
      setCellQuantities({});
    }
  }, [dispatch, formData.storage_location_id]);
  
  // Refresh storage cells when they are modified elsewhere
  useEffect(() => {
    if (lastModified && formData.storage_location_id) {
      dispatch(fetchStorageCells(formData.storage_location_id))
        .then((result) => {
          if (fetchStorageCells.fulfilled.match(result)) {
            setLocationCells(Array.isArray(result.payload) ? result.payload : []);
            // Re-initialize cell quantities preserving existing values
            const initialQuantities = {};
            (Array.isArray(result.payload) ? result.payload : []).forEach(cell => {
              initialQuantities[cell.id] = cellQuantities[cell.id] || '';
            });
            setCellQuantities(initialQuantities);
          }
        });
    }
  }, [lastModified]);

  useEffect(() => {
    if (productError || stockInError) {
      const msg = productError || stockInError;
      alert(`Ошибка: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
      dispatch(clearProductError());
      dispatch(clearStockInError());
    }
  }, [productError, stockInError, dispatch]);

  useEffect(() => {
    return () => {
      dispatch(resetProducts());
    };
  }, [dispatch]);

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files);
    setPhotos((prev) => [...prev, ...files]);
  };

  const handlePhotoRemove = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCellQuantityChange = (cellId, value) => {
    setCellQuantities(prev => ({
      ...prev,
      [cellId]: value
    }));
  };

  const getTotalCellQuantities = () => {
    return Object.values(cellQuantities)
      .filter(val => val && !isNaN(val))
      .reduce((sum, val) => sum + parseInt(val), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user?.organization_id) {
      alert('Организация не найдена');
      return;
    }

    let photoUrls = [];

    if (photos.length > 0) {
      try {
        const uploadAction = await dispatch(uploadPhotos(photos));

        if (uploadPhotos.rejected.match(uploadAction)) {
          alert(`Ошибка загрузки фото: ${uploadAction.payload}`);
          return;
        }
        photoUrls = uploadAction.payload;
        if (!photoUrls || !Array.isArray(photoUrls)) {
          alert('Ошибка: неправильный формат URL фото');
          return;
        }
      } catch (error) {
        console.error('Unexpected error during photo upload:', error);
        alert(`Неожиданная ошибка при загрузке фото: ${error.message}`);
        return;
      }
    }

    const productData = {
      article: formData.article,
      name: formData.name,
      brand: formData.brand,
      description: formData.description || null,
      price: formData.sale_price,
      quantity: formData.quantity,
      is_new: formData.condition === 'новый',
      storage_location_id: parseInt(formData.storage_location_id, 10),
      vehicle_ids: selectedVehicle ? [selectedVehicle.id] : [],
      photos: photoUrls.length > 0 ? photoUrls : null,
    };

    try {
      const productAction = await dispatch(createPendingProduct(productData));
      if (createPendingProduct.rejected.match(productAction)) {
        return;
      }

      // Успешно создано в pending_products, переходим к списку
      navigate('/my-parts');
    } catch (err) {
      console.error(err);
      alert('Неожиданная ошибка при добавлении запчасти');
    }
  };

  useEffect(() => {
    if (!user || !user.is_seller) {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user || !user.is_seller) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8 text-gray-500">Перенаправление...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Добавить запчасть</h1>
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
          <input
            type="file"
            multiple
            accept="image/*,.heic,.heif,.tiff,.tif,.bmp,.svg,.ico,.raw,.cr2,.nef,.arw,.dng,.orf,.rw2"
            onChange={handlePhotoAdd}
            className="mt-1"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((file, idx) => (
              <div key={idx} className="relative">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`preview-${idx}`}
                  className="w-16 h-16 object-cover rounded border"
                  onLoad={() => {
                  }}
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

        {/* Адресное хранение - выбор ячеек */}
        {formData.storage_location_id && locationCells.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Адресное хранение</h3>
            <p className="text-sm text-gray-600 mb-4">Укажите значение для каждой ячейки (не обязательно заполнять все поля)</p>
            
            <div className="space-y-3">
              {locationCells.map((cell) => (
                <div key={cell.id} className="bg-white rounded-md p-3 border border-gray-200">
                  <div className="font-medium text-gray-900 mb-1">{cell.name}</div>
                  {cell.description && (
                    <div className="text-sm text-gray-600 mb-2">{cell.description}</div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Значение в ячейке
                    </label>
                    <input
                      type="text"
                      value={cellQuantities[cell.id] || ''}
                      onChange={(e) => handleCellQuantityChange(cell.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Введите значение"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={productStatus}
            className={`px-4 py-2 rounded-md ${productStatus
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
              } text-white`}
          >
            {productStatus ? 'Создание...' : 'Создать запчасть'}
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

      <VehicleModal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        onSelectVehicle={setSelectedVehicle}
        selectedVehicle={selectedVehicle}
      />
    </div>
  );
};

export default AddPart;