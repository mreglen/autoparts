import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { createPendingProduct, uploadPhotos, uploadMedia, clearProductError, resetProducts } from '../../../redux/slices/ProductSlice';
import { createStockIn, clearStockInError } from '../../../redux/slices/StockInSlice';
import { fetchStorageLocations } from '../../../redux/slices/OrganizationSlice';
import { fetchStorageCells, createStorageCell } from '../../../redux/slices/StorageCellsSlice';
import { createPendingProductStorageCellsBatch } from '../../../redux/slices/PendingProductStorageCellsSlice';
import { normalizeImageUrl } from '../../../utils/apiClient';

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
  const [videos, setVideos] = useState([]);
  const [locationCells, setLocationCells] = useState([]);
  const [cellQuantities, setCellQuantities] = useState({});
  const [newCellName, setNewCellName] = useState('');
  const [newCellValue, setNewCellValue] = useState('');
  const [showNewCellForm, setShowNewCellForm] = useState(false);

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

  const compressVideo = (file) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Store original file in case compression fails
      const originalFile = file;
      
      video.onloadedmetadata = () => {
        // Set canvas dimensions to half the original for compression
        canvas.width = video.videoWidth / 2;
        canvas.height = video.videoHeight / 2;
        
        // Create a temporary video element to hold the compressed version
        const tempVideo = document.createElement('video');
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        
        // Draw the original video to the canvas frame by frame
        video.currentTime = 0;
        
        video.oncanplay = () => {
          // Draw the video frame to canvas
          tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
          
          // Convert the canvas to a video blob using a workaround
          // Since we can't directly convert video to compressed video in browser, 
          // we'll just return the original file with a note that browser-based 
          // video compression is complex and would require a library
          console.warn('Full video compression requires specialized libraries. Returning original file.');
          resolve(originalFile);
        };
        
        video.play().catch(() => {
          // If play fails, return original file
          resolve(originalFile);
        });
      };
      
      video.onerror = () => {
        // If there's an error loading the video, return original file
        resolve(originalFile);
      };
      
      video.src = URL.createObjectURL(file);
    });
  };
  
  const handleVideoAdd = async (e) => {
    const files = Array.from(e.target.files);
    
    // Compress video files before adding
    const processedFiles = [];
    for (const file of files) {
      if (file.type.startsWith('video/')) {
        // Show a message that compression is happening
        console.log('Processing video...');
        const processedFile = await compressVideo(file);
        processedFiles.push(processedFile);
      } else {
        processedFiles.push(file);
      }
    }
    
    setVideos((prev) => [...prev, ...processedFiles]);
  };

  const handlePhotoRemove = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVideoRemove = (index) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
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

  const handleAddNewCell = async () => {
    if (!newCellName.trim()) {
      alert('Пожалуйста, введите название ячейки');
      return;
    }

    if (!formData.storage_location_id) {
      alert('Пожалуйста, выберите склад');
      return;
    }

    try {
      // Create new storage cell
      const newCellData = {
        name: newCellName,
        storage_location_id: parseInt(formData.storage_location_id, 10),
      };
      
      const result = await dispatch(createStorageCell(newCellData));
      
      // Add the new cell to locationCells
      setLocationCells(prev => [...prev, result]);
      
      // Initialize quantity for the new cell
      setCellQuantities(prev => ({
        ...prev,
        [result.id]: newCellValue
      }));
      
      // Reset form
      setNewCellName('');
      setNewCellValue('');
      setShowNewCellForm(false);
    } catch (error) {
      console.error('Error creating storage cell:', error);
      alert('Ошибка при создании ячейки');
    }
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

    // Validate required fields
    if (!formData.article || !formData.article.trim()) {
      alert('Артикул обязателен');
      return;
    }
    if (!formData.name || !formData.name.trim()) {
      alert('Название обязательно');
      return;
    }
    if (!formData.brand || !formData.brand.trim()) {
      alert('Бренд обязателен');
      return;
    }
    if (!formData.sale_price || isNaN(parseFloat(formData.sale_price))) {
      alert('Укажите корректную цену');
      return;
    }
    if (!formData.quantity || isNaN(parseInt(formData.quantity, 10))) {
      alert('Укажите корректное количество');
      return;
    }
    if (!formData.storage_location_id) {
      alert('Выберите место хранения');
      return;
    }

    let mediaUrls = [];

    // Combine photos and videos into one array for upload
    const allMedia = [...photos, ...videos];
    
    if (allMedia.length > 0) {
      try {
        const uploadAction = await dispatch(uploadMedia(allMedia));

        if (uploadMedia.rejected.match(uploadAction)) {
          alert(`Ошибка загрузки медиа: ${uploadAction.payload}`);
          return;
        }
        mediaUrls = uploadAction.payload;
        if (!mediaUrls || !Array.isArray(mediaUrls)) {
          alert('Ошибка: неправильный формат URL медиа');
          return;
        }
      } catch (error) {
        console.error('Unexpected error during media upload:', error);
        alert(`Неожиданная ошибка при загрузке медиа: ${error.message}`);
        return;
      }
    }

    const productData = {
      article: formData.article?.toString().trim() || '',
      name: formData.name?.toString().trim() || '',
      brand: formData.brand?.toString().trim() || '',
      description: formData.description ? String(formData.description).trim() : null,
      price: parseFloat(formData.sale_price) || 0,
      quantity: parseInt(formData.quantity, 10) || 1,
      is_new: formData.condition === 'новый',
      storage_location_id: parseInt(formData.storage_location_id, 10) || 1,
      vehicle_ids: selectedVehicle ? [selectedVehicle.id] : [],
      photos: mediaUrls.length > 0 ? mediaUrls : null,
    };

    try {
      const productAction = await dispatch(createPendingProduct(productData));
      if (createPendingProduct.rejected.match(productAction)) {
        return;
      }

      // Get the created pending product ID
      const pendingProductId = productAction.payload.id;

      // Handle storage cell assignments
      const storageCellAssignments = [];
      Object.entries(cellQuantities).forEach(([cellId, value]) => {
        if (value && value.trim()) {
          storageCellAssignments.push({
            pending_product_id: pendingProductId,
            storage_cell_id: parseInt(cellId, 10),
            value: value.trim()
          });
        }
      });

      // Create storage cell links if any assignments exist
      if (storageCellAssignments.length > 0) {
        try {
          await dispatch(createPendingProductStorageCellsBatch(storageCellAssignments));
        } catch (storageError) {
          console.error('Error creating storage cell assignments:', storageError);
          // Don't fail the whole operation if storage cell creation fails
        }
      }

      // Успешно создано в pending_products, переходим к списку
      navigate('/my-parts');
    } catch (err) {
      console.error(err);
      alert('Неожиданная ошибка при добавлении запчасти');
    }
  };

  useEffect(() => {
    if (!user || (!user.is_seller && !user.is_employee)) {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user || (!user.is_seller && !user.is_employee)) {
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
        
        {/* Медиафайлы (фото и видео) */}
        <div>
          <label className="block text-sm font-medium">Фотографии и видео</label>
          <input
            type="file"
            multiple
            accept="image/*,video/*,.heic,.heif,.tiff,.tif,.bmp,.svg,.ico,.raw,.cr2,.nef,.arw,.dng,.orf,.rw2,.mp4,.avi,.mov,.wmv,.flv,.mkv,.webm,.m4v,.3gp,.mpeg,.mpg"
            onChange={(e) => {
              const files = Array.from(e.target.files);
              const photosToAdd = [];
              const videosToAdd = [];
              
              files.forEach(file => {
                if (file.type.startsWith('image/')) {
                  photosToAdd.push(file);
                } else if (file.type.startsWith('video/')) {
                  videosToAdd.push(file);
                }
              });
              
              setPhotos(prev => [...prev, ...photosToAdd]);
              setVideos(prev => [...prev, ...videosToAdd]);
            }}
            className="mt-1"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((file, idx) => {
              // Handle both File objects (before upload) and URL strings (after upload)
              let photoSrc;
              if (file instanceof File || file instanceof Blob) {
                photoSrc = URL.createObjectURL(file);
              } else if (typeof file === 'string') {
                photoSrc = normalizeImageUrl(file);
              } else {
                photoSrc = '';
              }
              
              return (
                <div key={`photo-${idx}`} className="relative">
                  <img
                    src={photoSrc}
                    alt={`photo-preview-${idx}`}
                    className="w-16 h-16 object-cover rounded border"
                    onLoad={() => {
                      // Cleanup for blob URLs
                      if (file instanceof File || file instanceof Blob) {
                        // URL.revokeObjectURL(photoSrc); // Optional: manage cleanup if needed
                      }
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
              );
            })}
            {videos.map((file, idx) => (
              <div key={`video-${idx}`} className="relative">
                <video
                  src={URL.createObjectURL(file)}
                  className="w-16 h-16 object-cover rounded border"
                  controls={false}
                />
                <button
                  type="button"
                  onClick={() => handleVideoRemove(idx)}
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
        {formData.storage_location_id && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-gray-900">Адресное хранение</h3>
              <button
                type="button"
                onClick={() => setShowNewCellForm(!showNewCellForm)}
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              >
                {showNewCellForm ? 'Отмена' : '+'}
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Укажите значение для каждой ячейки (не обязательно заполнять все поля)</p>
            
            {showNewCellForm && (
              <div className="mb-4 p-3 bg-white rounded-md border border-gray-300">
                <div className="mb-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Название ячейки</label>
                  <input
                    type="text"
                    value={newCellName}
                    onChange={(e) => setNewCellName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Введите название ячейки"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Значение в ячейке</label>
                  <input
                    type="text"
                    value={newCellValue}
                    onChange={(e) => setNewCellValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Введите значение"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddNewCell}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                >
                  Добавить ячейку
                </button>
              </div>
            )}
            
            {locationCells.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300 border-collapse rounded-lg">
                  <thead className="bg-gray-100">
                    <tr>
                      {locationCells.map((cell) => (
                        <th key={cell.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase border-r border-gray-300 last:border-r-0">
                          {cell.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {locationCells.map((cell) => (
                        <td key={cell.id} className="px-4 py-3 border-r border-gray-300 last:border-r-0">
                          <input
                            type="text"
                            value={cellQuantities[cell.id] || ''}
                            onChange={(e) => handleCellQuantityChange(cell.id, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Введите значение"
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
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