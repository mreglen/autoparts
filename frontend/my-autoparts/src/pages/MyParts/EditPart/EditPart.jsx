import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { updateProduct, uploadPhotos, uploadMedia, clearProductError, resetProducts, fetchProduct, deleteProductPhotos } from '../../../redux/slices/ProductSlice';
import { fetchStorageLocations } from '../../../redux/slices/OrganizationSlice';
import { fetchStorageCells, fetchProductStorageCells, linkProductToCell, deleteProductCellLink } from '../../../redux/slices/StorageCellsSlice';
import VehicleModal from '../AddPart/VehicleModal';
import PhotoGallery from '../../../components/PhotoGallery/PhotoGallery';
import ImageModal from '../../../components/ImageModal/ImageModal';
import { normalizeImageUrl } from '../../../utils/apiClient';

const EditPart = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const productStatus = useSelector((state) => state.products.loading);
  const productError = useSelector((state) => state.products.error);
  const currentProduct = useSelector((state) => state.products.currentProduct);
  const { storageLocations } = useSelector((state) => state.organization);
  const { storageCells, productStorageCells, lastModified } = useSelector((state) => state.storageCells);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState({ photos: [], initialIndex: 0 });
  
  // Storage cells state
  const [locationCells, setLocationCells] = useState([]);
  const [cellValues, setCellValues] = useState({}); // {cellId: value}
  const [existingLinks, setExistingLinks] = useState([]); // Existing product-cell links
  const [showNewCellForm, setShowNewCellForm] = useState(false);
  const [newCellName, setNewCellName] = useState('');
  const [newCellValue, setNewCellValue] = useState('');

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
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [existingVideos, setExistingVideos] = useState([]);
  const [productLoaded, setProductLoaded] = useState(false);
  const [selectedPhotosForRemoval, setSelectedPhotosForRemoval] = useState([]);
  const [selectedVideosForRemoval, setSelectedVideosForRemoval] = useState([]);

  // Загрузка данных продукта при получении
  useEffect(() => {
    if (currentProduct && !productLoaded) {
      setFormData({
        article: currentProduct.article || '',
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
      
      // Загружаем существующие видео
      const videos = (currentProduct.videos || []).filter(video =>
        video && (video.video_url || typeof video === 'string')
      );
      setExistingVideos(videos);
      
      setProductLoaded(true);

      // Установка выбранного автомобиля
      if (currentProduct.compatible_vehicles && currentProduct.compatible_vehicles.length > 0) {
        setSelectedVehicle(currentProduct.compatible_vehicles[0]);
      }

      // Загрузка существующих связей продукта с ячейками
      if (currentProduct.id) {
        dispatch(fetchProductStorageCells(currentProduct.id))
          .then((result) => {
            if (fetchProductStorageCells.fulfilled.match(result)) {
              const links = result.payload.links || [];
              setExistingLinks(links);
              
              // Инициализация значений ячеек из существующих связей
              const initialValues = {};
              links.forEach(link => {
                initialValues[link.storage_cell_id] = link.value || '';
              });
              setCellValues(initialValues);
            }
          });
      }
    }
  }, [currentProduct, productLoaded, dispatch]);
  
  // Refresh storage cell data when storage cells are modified
  // This ensures we get updated data after additions/deletions
  useEffect(() => {
    if (currentProduct?.id && productLoaded && lastModified) {
      dispatch(fetchProductStorageCells(currentProduct.id))
        .then((result) => {
          if (fetchProductStorageCells.fulfilled.match(result)) {
            const links = result.payload.links || [];
            setExistingLinks(links);
            
            // Update cell values with latest data
            const initialValues = {};
            links.forEach(link => {
              initialValues[link.storage_cell_id] = link.value || '';
            });
            setCellValues(initialValues);
          }
        });
      
      // Also refresh available storage cells for the current location
      if (formData.storage_location_id) {
        dispatch(fetchStorageCells(formData.storage_location_id))
          .then((result) => {
            if (fetchStorageCells.fulfilled.match(result)) {
              setLocationCells(Array.isArray(result.payload) ? result.payload : []);
            }
          });
      }
    }
  }, [lastModified]); // Trigger when storage cells are modified

  // Сброс состояния при изменении ID продукта
  useEffect(() => {
    setProductLoaded(false);
    setExistingPhotos([]);
    setPhotos([]);
    setSelectedPhotosForRemoval([]);
    setLocationCells([]);
    setCellValues({});
    setExistingLinks([]);
  }, [id]);

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files);
    setPhotos((prev) => [...prev, ...files]);
  };

  const handleVideoAdd = (e) => {
    const files = Array.from(e.target.files);
    setVideos((prev) => [...prev, ...files]);
  };

  const handlePhotoRemove = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVideoRemove = (index) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCaptureVideo = () => {
    // Create hidden input element with capture attribute
   const videoInput = document.createElement('input');
    videoInput.type = 'file';
    videoInput.accept = 'video/*';
    videoInput.capture = 'environment'; // Use back camera on mobile
    videoInput.multiple = false;
    
    videoInput.onchange = (e) => {
     const files = Array.from(e.target.files);
     if (files.length > 0) {
        setVideos((prev) => [...prev, ...files]);
      }
    };
    
    videoInput.click();
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

  // Fetch storage cells when storage location changes
  useEffect(() => {
    if (formData.storage_location_id) {
      dispatch(fetchStorageCells(formData.storage_location_id))
        .then((result) => {
          if (fetchStorageCells.fulfilled.match(result)) {
            setLocationCells(Array.isArray(result.payload) ? result.payload : []);
          }
        });
    } else {
      setLocationCells([]);
    }
  }, [dispatch, formData.storage_location_id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCellValueChange = (cellId, value) => {
    setCellValues(prev => ({
      ...prev,
      [cellId]: value
    }));
  };

  const handleAddNewCell = () => {
   if (!newCellName.trim()) {
      alert('Введите название ячейки');
     return;
    }
    
    // Create a new cell object
   const newCell = {
      id: `temp_${Date.now()}`,
      name: newCellName.trim(),
      description: '',
      storage_location_id: parseInt(formData.storage_location_id, 10)
    };
    
    // Add to location cells
    setLocationCells(prev => [...prev, newCell]);
    
    // Initialize value for the new cell
   if (newCellValue.trim()) {
      setCellValues(prev => ({
        ...prev,
        [newCell.id]: newCellValue.trim()
      }));
    }
    
    // Reset form
    setNewCellName('');
    setNewCellValue('');
    setShowNewCellForm(false);
  };

  const handleImageClick = (allMedia, initialIndex) => {
    // Separate photos and videos from the combined media array
  const photos = allMedia.filter(item => {
      // Check if it's a photo by looking at the structure or file type
    if (typeof item === 'string') {
        return !item.toLowerCase().match(/\.(mp4|avi|mov|wmv|flv|mkv|webm|m4v|3gp|mpeg|mpg)$/);
      }
    if (item instanceof File) {
        return item.type && item.type.startsWith('image/');
      }
    if (item?.photo_url || item?.full_url) {
       const url = item.photo_url || item.full_url;
        return !url.toLowerCase().match(/\.(mp4|avi|mov|wmv|flv|mkv|webm|m4v|3gp|mpeg|mpg)$/);
      }
      return true; // Default to photo
    });
    
  const videos = allMedia.filter(item => {
      // Check if it's a video
    if (typeof item === 'string') {
        return item.toLowerCase().match(/\.(mp4|avi|mov|wmv|flv|mkv|webm|m4v|3gp|mpeg|mpg)$/);
      }
    if (item instanceof File) {
        return item.type && item.type.startsWith('video/');
      }
    if (item?.video_url || item?.full_url) {
       const url = item.video_url || item.full_url;
        return url.toLowerCase().match(/\.(mp4|avi|mov|wmv|flv|mkv|webm|m4v|3gp|mpeg|mpg)$/);
      }
    if (item?.photo_url) {
        return item.photo_url.toLowerCase().match(/\.(mp4|avi|mov|wmv|flv|mkv|webm|m4v|3gp|mpeg|mpg)$/);
      }
      return false; 
    });
    
    setSelectedImages({ photos, videos, initialIndex });
    setImageModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user?.organization_id) {
      alert('Организация не найдена');
      return;
    }

    let photoUrls = [];
    let videoUrls = [];
    
    // Upload new photos
    if (photos.length > 0) {
      const uploadResult = await dispatch(uploadPhotos(photos));
      if (uploadPhotos.rejected.match(uploadResult)) {
        return;
      }
      photoUrls = uploadResult.payload;
    }
    
    // Upload new videos
    if (videos.length > 0) {
      const uploadResult = await dispatch(uploadMedia(videos));
      if (uploadMedia.rejected.match(uploadResult)) {
        return;
      }
      videoUrls = uploadResult.payload;
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
    
    // Комбинируем существующие и новые видео
    const allVideoUrls = [
      ...existingVideos
        .filter(video => video) // Фильтруем null/undefined
        .map(video => {
          // Если video - строка, возвращаем как есть
          if (typeof video === 'string') return video;
          // Если video - объект с video_url, возвращаем video_url
          if (video.video_url) return video.video_url;
          // Иначе пропускаем
          return null;
        })
        .filter(url => url !== null),
      ...videoUrls
    ];

    const productData = {
      article: formData.article,
      name: formData.name,
      brand: formData.brand,
      description: formData.description || null,
      price: parseFloat(formData.sale_price),
      quantity: parseInt(formData.quantity, 10),
      is_new: formData.condition === 'новый',
      storage_location_id: parseInt(formData.storage_location_id, 10),
      internal_code: currentProduct?.internal_code || null,
      vehicle_ids: selectedVehicle ? [selectedVehicle.id] : [],
      photos: allPhotoUrls.length > 0 ? allPhotoUrls : null,
      videos: allVideoUrls.length > 0 ? allVideoUrls : null,
    };

    console.log('=== UPDATE PRODUCT REQUEST ===');
    console.log('Product Data:', JSON.stringify(productData, null, 2));
    console.log('All Photo URLs:', allPhotoUrls);
    console.log('================================');

    try {
      const result = await dispatch(updateProduct({ id: parseInt(id, 10), productData }));
      if (updateProduct.rejected.match(result)) {
        return;
      }

      // Handle storage cell links update
      const productId = parseInt(id, 10);
      
      // Get current cell entries (including empty ones to identify removals)
      const currentCellEntries = Object.entries(cellValues);
      
      // Get existing link IDs for cleanup
      const existingLinkIds = existingLinks.map(link => link.id);
      const existingCellIds = existingLinks.map(link => link.storage_cell_id);
      
      // Delete all existing links first
      for (const linkId of existingLinkIds) {
        try {
          await dispatch(deleteProductCellLink(linkId));
        } catch (error) {
          console.warn('Failed to delete existing link:', error);
        }
      }
      
      // Create new links only for cells with non-empty values
      for (const [cellId, value] of currentCellEntries) {
        // Only create link if value is not empty
        if (value && value.trim() !== '') {
          try {
            await dispatch(linkProductToCell({
              product_id: productId,
              storage_cell_id: parseInt(cellId, 10),
              value: value.trim()
            }));
          } catch (error) {
            console.warn('Failed to create link:', error);
          }
        }
        // If value is empty, we simply don't create a new link, effectively removing it
      }

      // Очищаем выбранные фото после успешного сохранения
      setSelectedPhotosForRemoval([]);

      navigate('/my-parts');
    } catch (err) {
      console.error(err);
      alert('Неожиданная ошибка при обновлении запчасти');
    }
  };

  if (!user || (!user.is_seller && !user.is_employee)) {
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

        {/* Внутренний код (только для чтения) */}
        {currentProduct?.internal_code && (
          <div>
            <label className="block text-sm font-medium">Внутренний код</label>
            <input
              value={currentProduct.internal_code}
              readOnly
              className="mt-1 block w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-600"
            />
          </div>
        )}


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

        {/* Медиа */}
        <div>
          <label className="block text-sm font-medium">Медиа *</label>

          {/* Существующие медиа (фото и видео) */}
          {(existingPhotos.length > 0 || existingVideos.length > 0) && (
            <div className="mt-2 mb-4">
              <PhotoGallery
                photos={[
                  ...existingPhotos.map(photo => {
                  const url = typeof photo === 'string' ? photo : photo.photo_url;
                    return {
                      id: typeof photo === 'object' ? photo.id : `photo-${photo}`,
                      photo_url: url,
                      full_url: url
                    };
                  }),
                  ...existingVideos.map((video, idx) => {
                  const url = typeof video === 'string' ? video : video.video_url;
                    return {
                      id: typeof video === 'object' ? video.id : `video-${idx}`,
                      photo_url: url,
                      full_url: url
                    };
                  })
                ]}
                onImageClick={(allPhotos, initialIndex) => {
                  handleImageClick(allPhotos, initialIndex);
                }}
                selectedPhotos={selectedPhotosForRemoval}
                onPhotoSelect={handlePhotoSelectionToggle}
                onDeletePhoto={existingPhotos.length + existingVideos.length === 1 ? handleDeleteSinglePhoto : null}
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

          {/* Добавление новых фото и видео */}
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

        {/* Новые фото */}
        {photos.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-600 mb-2">Новые фотографии:</p>
              <div className="flex flex-wrap gap-2">
                {photos.map((file, idx) => {
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
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Новые видео */}
          {videos.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-600 mb-2">Новые видео:</p>
              <div className="flex flex-wrap gap-2">
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

        {/* Адресное хранение - выбор ячеек */}
        {formData.storage_location_id && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-gray-900">Адресное хранение</h3>
              <button
                type="button"
                onClick={() => setShowNewCellForm(!showNewCellForm)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
              >
                {showNewCellForm ? 'Отмена' : 'Добавить адрес'}
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
                            value={cellValues[cell.id] || ''}
                            onChange={(e) => handleCellValueChange(cell.id, e.target.value)}
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
      videos={selectedImages.videos || []}
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
