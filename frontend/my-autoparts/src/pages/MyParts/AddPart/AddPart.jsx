import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { createPendingProduct, uploadPhotos, uploadMedia, clearProductError, resetProducts } from '../../../redux/slices/ProductSlice';
import { createStockIn, clearStockInError } from '../../../redux/slices/StockInSlice';
import { fetchStorageLocations } from '../../../redux/slices/OrganizationSlice';
import { fetchStorageCells, createStorageCell } from '../../../redux/slices/StorageCellsSlice';
import { createPendingProductStorageCellsBatch } from '../../../redux/slices/PendingProductStorageCellsSlice';
import { normalizeImageUrl, apiRequest, apiRequestFormData } from '../../../utils/apiClient';

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
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadedTempFiles, setUploadedTempFiles] = useState([]); // Track uploaded temp filenames
  const [uploadProgress, setUploadProgress] = useState({}); // Track upload status by file index

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

  const handleFileAdd = async (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = [];
    const videoFiles = [];
    
    // Separate files by type
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        imageFiles.push(file);
      } else if (file.type.startsWith('video/')) {
        videoFiles.push(file);
      } else {
        // Try to detect by extension
        const ext = file.name.split('.').pop().toLowerCase();
        const imageExts = ['heic', 'heif', 'tiff', 'tif', 'bmp', 'svg', 'ico', 'raw', 'cr2', 'nef', 'arw', 'dng', 'orf', 'rw2'];
        const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', '3gp', 'mpeg', 'mpg'];
        
        if (imageExts.includes(ext)) {
          imageFiles.push(file);
        } else if (videoExts.includes(ext)) {
          videoFiles.push(file);
        }
      }
    }
    
    // Handle photos
    if (imageFiles.length > 0) {
      // Check if we already have 5 photos
      if (photos.length >= 5) {
        alert('Максимум 5 фотографий');
      } else {
        const availableSlots = 5 - photos.length;
        const filesToUpload = imageFiles.slice(0, availableSlots);
        
        if (imageFiles.length > availableSlots) {
          alert(`Можно добавить только ${availableSlots} фотографий (максимум 5)`);
        }
        
        // Set uploading state for each file
        const startIndex = photos.length;
        filesToUpload.forEach((_, idx) => {
          setUploadProgress(prev => ({ ...prev, [`photo-${startIndex + idx}`]: true }));
        });
        
        for (const file of filesToUpload) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            const result = await apiRequestFormData('/upload/photo', formData);
            
            // 🚀 НОВАЯ ЛОГИКА: Фото загружено в temp папку, обработка отложена
            // Не ждем завершения обработки - она начнется при сохранении продукта
            if (result.temp_path) {
              console.log('✅ Photo uploaded to temp (processing deferred):', result.temp_path);
              
              const fileWithPath = Object.assign(file, { 
                finalPath: result.temp_path,  // Используем temp_path для совместимости
                tempPath: result.temp_path,
                filename: result.temp_filename,
                isUploading: false,
                requiresProcessing: result.requires_processing || true,
                organizationId: result.organization_id,
                addWatermark: result.add_watermark,
                logoPath: result.logo_path
              });
              
              setPhotos((prev) => [...prev, fileWithPath]);
              
              // Track temp file for cleanup
              if (result.temp_filename) {
                uploadedTempFiles.push(result.temp_filename);
              }
              
              console.log('📸 Photo saved to temp folder - will process on product save');
            }
          } catch (error) {
            console.error('Failed to upload photo:', error);
            alert(`Ошибка загрузки фото: ${file.name}`);
          }
        }
        
        // Clear uploading state after all uploads complete
        filesToUpload.forEach((_, idx) => {
          setUploadProgress(prev => ({ ...prev, [`photo-${startIndex + idx}`]: false }));
        });
      }
    }
    
    // Handle videos
    if (videoFiles.length > 0) {
      // Check if we already have 1 video
      if (videos.length >= 1) {
        alert('Максимум 1 видео');
      } else {
        const file = videoFiles[0];
        
        // Validate video size (max 50MB)
        const maxSizeMB = 50;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        if (file.size > maxSizeBytes) {
          alert(`Файл слишком большой. Размер: ${(file.size / 1024 / 1024).toFixed(1)}MB. Максимальный размер: ${maxSizeMB}MB`);
          return;
        }
        
        // Validate video duration (max 30 seconds)
        try {
          console.log('Checking video duration...');
          const duration = await new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
              window.URL.revokeObjectURL(video.src);
              resolve(video.duration);
            };
            video.onerror = () => {
              reject(new Error('Failed to load video metadata'));
            };
            video.src = URL.createObjectURL(file);
          });
          
          console.log('Video duration:', duration, 'seconds');
          
          if (duration > 30) {
            alert(`Видео слишком длинное. Длительность: ${duration.toFixed(1)} сек. Максимальная длительность: 30 сек.`);
            return;
          }
        } catch (error) {
          console.error('Error checking video duration:', error);
          // Continue with upload if can't check duration
        }
        
        const videoIndex = videos.length;
        
        // Track current upload task ID for cancellation
        let currentTaskId = null;
        let isCancelled = false;
        
        // Add video to state immediately with uploading flag and cancel function
        const uploadingVideo = Object.assign(file, { 
          isUploading: true,
          cancelUpload: () => {
            if (currentTaskId && !isCancelled) {
              console.log('🛑 Cancelling video upload:', currentTaskId);
              isCancelled = true;
              apiRequest(`/upload/cancel/${currentTaskId}`, { method: 'POST' })
                .then(result => {
                  console.log('✅ Upload cancelled:', result);
                  // Remove video from state
                  setVideos((prev) => prev.filter((_, idx) => idx !== videoIndex));
                  setUploadProgress(prev => ({ ...prev, [`video-${videoIndex}`]: false }));
                })
                .catch(error => {
                  console.error('❌ Error cancelling upload:', error);
                });
            }
          }
        });
        setVideos((prev) => [...prev, uploadingVideo]);
        
        // Set uploading state
        setUploadProgress(prev => ({ ...prev, [`video-${videoIndex}`]: true }));
        
        try {
          const formData = new FormData();
          formData.append('file', file);
          const result = await apiRequestFormData('/upload/media', formData);
          
          // 🚀 НОВАЯ ЛОГИКА: Видео загружено в temp папку, обработка отложена
          // Не ждем завершения обработки - она начнется при сохранении продукта
          if (result.temp_path) {
            console.log('✅ Video uploaded to temp (processing deferred):', result.temp_path);
            
            const fileWithPath = Object.assign(file, { 
              finalPath: result.path,  // Используем path для совместимости
              tempPath: result.temp_path,
              filename: result.filename || result.temp_filename,
              isUploading: false,
              requiresProcessing: result.requires_processing || true,
              organizationId: result.organization_id
            });
            
            setVideos((prev) => prev.map((v, idx) => 
              idx === videoIndex ? fileWithPath : v
            ));
            
            // Track temp file for cleanup
            if (result.temp_filename) {
              uploadedTempFiles.push(result.temp_filename);
            }
            
            console.log('📹 Video saved to temp folder - will process on product save');
          }
        } catch (error) {
          console.error('Failed to upload video:', error);
          alert(`Ошибка загрузки видео: ${file.name}`);
          // Remove failed video from state
          setVideos((prev) => prev.filter((_, idx) => idx !== videoIndex));
        }
        
        // Clear uploading state
        setUploadProgress(prev => ({ ...prev, [`video-${videoIndex}`]: false }));
      }
    }
  };

  const handlePhotoRemove = async (index) => {
    const fileToRemove = photos[index];
    
    // If it's a File/Blob that was uploaded, delete from storage
    if ((fileToRemove instanceof File || fileToRemove instanceof Blob) && fileToRemove.finalPath) {
      try {
        // Extract filename from path and delete
        const pathParts = fileToRemove.finalPath.split('/');
        const filename = pathParts[pathParts.length - 1];
        await apiRequest(`/upload/temp/${encodeURIComponent(filename)}`, {
          method: 'DELETE'
        }).catch(err => {
          console.warn(`Failed to delete file ${filename}:`, err);
        });
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
    
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVideoRemove = async (index) => {
    const fileToRemove = videos[index];
    
    // If it's a File/Blob that was uploaded, delete from storage
    if ((fileToRemove instanceof File || fileToRemove instanceof Blob) && fileToRemove.finalPath) {
      try {
        // Extract filename from path and delete
        const pathParts = fileToRemove.finalPath.split('/');
        const filename = pathParts[pathParts.length - 1];
        await apiRequest(`/upload/temp/${encodeURIComponent(filename)}`, {
          method: 'DELETE'
        }).catch(err => {
          console.warn(`Failed to delete file ${filename}:`, err);
        });
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
    
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

  // Function to delete files when user cancels
  const cleanupFiles = async () => {
    // Delete from both photos/videos arrays and uploadedTempFiles
    const filesToDelete = new Set();
    
    // Extract filenames from photos
    photos.forEach(f => {
      if (f.finalPath) {
        const filename = f.finalPath.split('/').pop();
        filesToDelete.add(filename);
      }
    });
    
    // Extract filenames from videos
    videos.forEach(f => {
      if (f.finalPath) {
        const filename = f.finalPath.split('/').pop();
        filesToDelete.add(filename);
      }
    });
    
    // Also include tracked temp files
    uploadedTempFiles.forEach(filename => filesToDelete.add(filename));
    
    if (filesToDelete.size === 0) {
      return;
    }

    try {
      const deletePromises = Array.from(filesToDelete).map(filename => 
        apiRequest(`/upload/temp/${encodeURIComponent(filename)}`, {
          method: 'DELETE'
        }).catch(err => {
          console.warn(`Failed to delete file ${filename}:`, err);
        })
      );
      
      await Promise.all(deletePromises);
      console.log('Files cleaned up successfully');
      setUploadedTempFiles([]); // Clear tracked files
    } catch (error) {
      console.error('Error cleaning up files:', error);
    }
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

    let photoUrls = [];
    let videoUrls = [];

    // Upload photos and videos separately - they're already uploaded
    if (photos.length > 0) {
      setIsUploadingMedia(true);
      try {
        // Photos are already uploaded with final paths, just use them
        photoUrls = photos
          .filter(file => file.finalPath)
          .map(file => {
            // Ensure path starts with / for consistency
            return file.finalPath.startsWith('/') ? file.finalPath : '/' + file.finalPath;
          });
      } catch (error) {
        console.error('Error processing photos:', error);
        alert(`Ошибка обработки фото: ${error.message}`);
        setIsUploadingMedia(false);
        return;
      }
      setIsUploadingMedia(false);
    }
    
    if (videos.length > 0) {
      setIsUploadingMedia(true);
      try {
        // 🚀 НОВАЯ ЛОГИКА: Запускаем обработку видео ПЕРЕД отправкой продукта
        // Видео уже загружено в temp папку, теперь нужно запустить обработку
        console.log('🎬 Starting video processing before product submission...');
        
        // Просто используем temp пути - бэкенд сам запустит обработку после создания продукта
        videoUrls = videos
          .filter(file => file.finalPath)
          .map(file => {
            // Ensure path starts with / for consistency
            return file.finalPath.startsWith('/') ? file.finalPath : '/' + file.finalPath;
          });
        
        console.log('✅ Video URLs prepared:', videoUrls);
      } catch (error) {
        console.error('Error processing videos:', error);
        alert(`Ошибка обработки видео: ${error.message}`);
        setIsUploadingMedia(false);
        return;
      }
      setIsUploadingMedia(false);
    }

    // Clear temp files after successful submission
    if (uploadedTempFiles.length > 0) {
      setUploadedTempFiles([]);
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
      photos: photoUrls.length > 0 ? photoUrls : null,
      videos: videoUrls.length > 0 ? videoUrls : null,
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
          <label className="block text-sm font-medium">Фотографии и видео *</label>
          <div className="mt-1 space-y-2">
            {/* Combined file upload button */}
            <div>
              <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                Добавить файл
                <input
                  type="file"
                  multiple
                  accept="image/*,.heic,.heif,.tiff,.tif,.bmp,.svg,.ico,.raw,.cr2,.nef,.arw,.dng,.orf,.rw2,video/*,.mp4,.avi,.mov,.wmv,.flv,.mkv,.webm,.m4v,.3gp,.mpeg,.mpg"
                  onChange={handleFileAdd}
                  className="hidden"
                  disabled={isUploadingMedia}
                />
              </label>
            </div>
          </div>
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
              
              const isUploading = uploadProgress[`photo-${idx}`] === true;
              
              return (
                <div key={`photo-${idx}`} className="relative">
                  {isUploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center z-10">
                      <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                  <img
                    src={photoSrc}
                    alt={`photo-preview-${idx}`}
                    className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-90 transition-opacity"
                    onLoad={() => {
                      // Cleanup for blob URLs
                     if (file instanceof File || file instanceof Blob) {
                        // URL.revokeObjectURL(photoSrc); // Optional: manage cleanup if needed
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlePhotoRemove(idx); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow"
                    disabled={isUploading}
                  >
                    <img src="/img/close_sm.svg" alt="Удалить" className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })}
            {videos.map((file, idx) => {
              const isUploading = uploadProgress[`video-${idx}`] === true || file.isUploading;
              
              return (
                <div key={`video-${idx}`} className="relative">
                  {isUploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center z-10">
                      <div className="relative">
                        {/* Circular spinner */}
                        <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {/* Video icon in center */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}
                  <video
                    src={file instanceof File || file instanceof Blob ? URL.createObjectURL(file) : (file.finalPath || '')}
                    className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-90 transition-opacity"
                    controls={false}
                  />
                  {isUploading && file.cancelUpload ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('🛑 User clicked cancel for video', idx);
                        file.cancelUpload();
                      }}
                      className="absolute -top-2 -left-2 bg-yellow-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow hover:bg-yellow-600 z-20"
                      title="Отменить загрузку"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  ) : (!isUploading && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleVideoRemove(idx); }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow"
                    >
                      <img src="/img/close_sm.svg" alt="Удалить" className="w-2.5 h-2.5" />
                    </button>
                  ))}
                </div>
              );
            })}
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
            disabled={productStatus || isUploadingMedia}
            className={`px-4 py-2 rounded-md ${(productStatus || isUploadingMedia)
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
              } text-white`}
          >
            {productStatus || isUploadingMedia ? 'Создание...' : 'Создать запчасть'}
          </button>
          <button
            type="button"
            onClick={async () => {
              // Clean up uploaded files
              await cleanupFiles();
              setPhotos([]);
              setVideos([]);
              navigate('/my-parts');
            }}
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