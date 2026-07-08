import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  createPendingProduct,
  fetchMyRejectedProduct,
  fetchMyPendingProduct,
  resubmitRejectedProduct,
  updatePendingProduct,
  uploadPhotos,
  uploadMedia,
  clearProductError,
  resetProducts,
  fetchProductDraft,
  createProductDraft,
  updateProductDraft,
  submitProductDraft,
} from '../../../redux/slices/ProductSlice';
import { createStockIn, clearStockInError } from '../../../redux/slices/StockInSlice';
import { fetchStorageLocations } from '../../../redux/slices/OrganizationSlice';
import { fetchStorageCells, createStorageCell } from '../../../redux/slices/StorageCellsSlice';
import {
  createPendingProductStorageCellsBatch,
  deletePendingProductStorageCell,
} from '../../../redux/slices/PendingProductStorageCellsSlice';
import { fetchPartTypes } from '../../../redux/slices/PartTypeSlice';
import { normalizeImageUrl, apiRequest, apiRequestFormData, apiAxios } from '../../../utils/apiClient';
import { useAuthReady } from '../../../hooks/useAuthReady';
import { useAiDescriptionGenerator } from '../../../hooks/useAiDescriptionGenerator';
import AuthLoadingScreen from '../../../components/AuthLoadingScreen/AuthLoadingScreen';
import {
  hasPartFormErrors,
  partFieldClass,
  partFieldLabelClass,
  scrollToFirstPartFormError,
  validatePartForm,
} from '../../../utils/partFormValidation';
import {
  buildRosskoLookupText,
  getRosskoMinPrice,
  pickBestRosskoPart,
  roundRosskoSalePrice,
} from '../../AutoParts/NewParts/rosskoHelpers';
import {
  buildProductDraftPayload,
  buildStorageCellsFromQuantities,
  draftPayloadHasContent,
  draftToFormSnapshot,
  readDraftSessionCache,
  writeDraftSessionCache,
  clearDraftSessionCache,
} from '../../../utils/productDraftUtils';

import VehicleModal from './VehicleModal';
import MobilePageSection from '../../../components/MobilePageSection/MobilePageSection';
import MobileStickyFooter from '../../../components/MobileStickyFooter/MobileStickyFooter';

const SUGGEST_LIST =
  'mt-1 max-h-44 overflow-y-auto rounded-md border border-gray-300 bg-white text-sm text-gray-900 shadow-sm';
const SUGGEST_ITEM =
  'w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none';

const DRAFT_AUTOSAVE_MS = 1000;

function buildStorageCellAssignments(pendingProductId, cellQuantities) {
  const assignments = [];
  Object.entries(cellQuantities || {}).forEach(([cellId, value]) => {
    if (!value || !String(value).trim()) return;
    const storageCellId = parseInt(cellId, 10);
    if (!Number.isFinite(storageCellId)) return;
    assignments.push({
      pending_product_id: pendingProductId,
      storage_cell_id: storageCellId,
      value: String(value).trim(),
    });
  });
  return assignments;
}

async function savePendingProductStorageCells(dispatch, pendingProductId, cellQuantities) {
  const assignments = buildStorageCellAssignments(pendingProductId, cellQuantities);
  if (assignments.length === 0) return;
  await dispatch(createPendingProductStorageCellsBatch(assignments)).unwrap();
}

const EMPTY_FORM_DATA = {
  article: '',
  name: '',
  brand: '',
  description: '',
  condition: 'новый',
  quantity: '',
  sale_price: '',
  storage_location_id: '',
  part_type_id: '',
};

const AddPart = ({ resubmitMode = false, editPendingMode = false, draftMode = false }) => {
  const navigate = useNavigate();
  const { id: routeId, draftId: routeDraftId } = useParams();
  const resubmitId = resubmitMode ? routeId : null;
  const editPendingId = editPendingMode ? routeId : null;
  const isDraftFlow = !resubmitMode && !editPendingMode;
  const initialDraftCache =
    draftMode && routeDraftId ? readDraftSessionCache(Number(routeDraftId)) : null;
  const dispatch = useDispatch();
  const { isReady, token } = useAuthReady();
  const user = useSelector((state) => state.auth.user);
  const canAccess = Boolean(user?.is_seller || user?.is_employee || user?.is_admin);
  const productStatus = useSelector((state) => state.products.loading);
  const productError = useSelector((state) => state.products.error);
  const { storageLocations } = useSelector((state) => state.organization);
  const { storageCells, lastModified } = useSelector((state) => state.storageCells);
  const { items: partTypes } = useSelector((state) => state.partTypes);

  const stockInError = useSelector((state) => state.stockIn.error);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(() => initialDraftCache?.vehicle || null);
  
  const [formData, setFormData] = useState(() => initialDraftCache?.formData || EMPTY_FORM_DATA);

  const {
    access: aiDescriptionAccess,
    loadingAccess: aiDescriptionLoading,
    generating: aiDescriptionGenerating,
    error: aiDescriptionError,
    canGenerate: canGenerateAiDescription,
    generate: generateAiDescription,
  } = useAiDescriptionGenerator({
    brand: formData.brand,
    article: formData.article,
    name: formData.name,
    description: formData.description,
    isNew: formData.condition === 'новый',
    partTypeId: formData.part_type_id,
    productId: null,
    authReady: isReady && canAccess,
  });

  const handleGenerateDescription = async () => {
    const description = await generateAiDescription();
    if (description) {
      setFormData((prev) => ({ ...prev, description }));
    }
  };

  const [articleOptions, setArticleOptions] = useState([]);
  const [brandOptions, setBrandOptions] = useState([]);
  const [articleLoading, setArticleLoading] = useState(false);
  const [brandLoading, setBrandLoading] = useState(false);
  const [articleFocused, setArticleFocused] = useState(false);
  const [brandFocused, setBrandFocused] = useState(false);
  const [rosskoLookupLoading, setRosskoLookupLoading] = useState(false);
  const [rosskoLookupError, setRosskoLookupError] = useState(null);
  const [rosskoLookupNotice, setRosskoLookupNotice] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loadingFormData, setLoadingFormData] = useState(
    () => (resubmitMode || editPendingMode || (draftMode && !initialDraftCache)),
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const showFieldError = (name) => Boolean(submitAttempted && fieldErrors[name]);
  const [existingPendingStorageCells, setExistingPendingStorageCells] = useState([]);

  const [photos, setPhotos] = useState(() => initialDraftCache?.photos || []);
  const [videos, setVideos] = useState(() => initialDraftCache?.videos || []);
  const [locationCells, setLocationCells] = useState([]);
  const [cellQuantities, setCellQuantities] = useState(() => initialDraftCache?.cellQuantities || {});
  const [newCellName, setNewCellName] = useState('');
  const [newCellValue, setNewCellValue] = useState('');
  const [showNewCellForm, setShowNewCellForm] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadedTempFiles, setUploadedTempFiles] = useState([]); // Track uploaded temp filenames
  const [uploadProgress, setUploadProgress] = useState({}); // Track upload status by file index
  const draftIdRef = useRef(draftMode && routeDraftId ? Number(routeDraftId) : null);
  const hadDraftCacheRef = useRef(Boolean(initialDraftCache));
  const skipAutosaveRef = useRef(false);
  const [draftSaveStatus, setDraftSaveStatus] = useState('idle');
  const draftSaving = useSelector((state) => state.products.draftSaving);

  const draftPayload = useMemo(
    () => buildProductDraftPayload({
      formData,
      photos,
      videos,
      selectedVehicle,
      cellQuantities,
    }),
    [formData, photos, videos, selectedVehicle, cellQuantities],
  );

  useEffect(() => {
    if (user?.organization_id) {
      dispatch(fetchStorageLocations(user.organization_id));
    }
    dispatch(fetchPartTypes());
  }, [dispatch, user?.organization_id]);

  // Fetch storage cells when storage location changes
  useEffect(() => {
    if (formData.storage_location_id) {
      dispatch(fetchStorageCells(formData.storage_location_id))
        .then((result) => {
          if (fetchStorageCells.fulfilled.match(result)) {
            const cells = Array.isArray(result.payload) ? result.payload : [];
            setLocationCells(cells);

            if (editPendingMode || resubmitMode || isDraftFlow) {
              // Не затираем значения, загруженные из pending/rejected/черновика — только добавляем ключи для новых ячеек
              setCellQuantities((prev) => {
                const next = { ...prev };
                cells.forEach((cell) => {
                  if (next[cell.id] === undefined) {
                    next[cell.id] = '';
                  }
                });
                return next;
              });
              return;
            }

            setCellQuantities((prev) => {
              const next = {};
              cells.forEach((cell) => {
                next[cell.id] = prev[cell.id] ?? '';
              });
              return next;
            });
          }
        });
    } else {
      setLocationCells([]);
      if (!editPendingMode && !resubmitMode && !isDraftFlow) {
        setCellQuantities({});
      }
    }
  }, [dispatch, formData.storage_location_id, editPendingMode, resubmitMode, isDraftFlow]);
  
  // Refresh storage cells when they are modified elsewhere (e.g. new cell created)
  useEffect(() => {
    if (!lastModified || !formData.storage_location_id) return undefined;

    let cancelled = false;
    dispatch(fetchStorageCells(formData.storage_location_id))
      .then((result) => {
        if (cancelled || !fetchStorageCells.fulfilled.match(result)) return;
        const cells = Array.isArray(result.payload) ? result.payload : [];
        setLocationCells(cells);
        setCellQuantities((prev) => {
          const next = { ...prev };
          const cellIds = new Set(cells.map((cell) => String(cell.id)));
          cells.forEach((cell) => {
            if (next[cell.id] === undefined) {
              next[cell.id] = '';
            }
          });
          Object.keys(next).forEach((key) => {
            if (!cellIds.has(String(key))) {
              delete next[key];
            }
          });
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [lastModified, dispatch, formData.storage_location_id]);

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

  useEffect(() => {
    if (!resubmitMode || !resubmitId) return undefined;

    let cancelled = false;
    setLoadingFormData(true);

    dispatch(fetchMyRejectedProduct(Number(resubmitId, 10)))
      .unwrap()
      .then((product) => {
        if (cancelled || !product) return;

        setRejectionReason(product.rejection_reason || '');
        setFormData({
          article: product.article || '',
          name: product.name || '',
          brand: product.brand || '',
          description: product.description || '',
          condition: product.is_new ? 'новый' : 'б/у',
          quantity: product.quantity != null ? String(product.quantity) : '',
          sale_price: product.price != null ? String(product.price) : '',
          storage_location_id: product.storage_location_id ? String(product.storage_location_id) : '',
          part_type_id: product.part_type_id ? String(product.part_type_id) : '',
        });

        setPhotos(
          (product.photos || []).map((url) => ({
            finalPath: typeof url === 'string' ? url : (url.full_url || url.photo_url || url.url || ''),
            name: 'photo',
            isExisting: true,
          })).filter((item) => item.finalPath)
        );

        setVideos(
          (product.videos || []).map((url) => ({
            finalPath: typeof url === 'string' ? url : (url.full_url || url.video_url || url.url || ''),
            name: 'video',
            isExisting: true,
          })).filter((item) => item.finalPath)
        );

        if (product.vehicle_ids?.length) {
          apiRequest(`/vehicles/${product.vehicle_ids[0]}`)
            .then((vehicle) => {
              if (!cancelled && vehicle) setSelectedVehicle(vehicle);
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (!cancelled) {
          alert(typeof err === 'string' ? err : 'Не удалось загрузить отклонённую запчасть');
          navigate('/my-parts?tab=pending', { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFormData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, resubmitMode, resubmitId, navigate]);

  useEffect(() => {
    if (!editPendingMode || !editPendingId) return undefined;
    if (!isReady || !token || !canAccess) return undefined;

    let cancelled = false;
    setLoadingFormData(true);

    const applyPendingProduct = (product) => {
      setFormData({
        article: product.article || '',
        name: product.name || '',
        brand: product.brand || '',
        description: product.description || '',
        condition: product.is_new ? 'новый' : 'б/у',
        quantity: product.quantity != null ? String(product.quantity) : '',
        sale_price: product.price != null ? String(product.price) : '',
        storage_location_id: product.storage_location_id ? String(product.storage_location_id) : '',
        part_type_id: product.part_type_id ? String(product.part_type_id) : '',
      });

      setPhotos(
        (product.photos || []).map((url) => ({
          finalPath: typeof url === 'string' ? url : (url.full_url || url.photo_url || url.url || ''),
          name: 'photo',
          isExisting: true,
        })).filter((item) => item.finalPath)
      );

      setVideos(
        (product.videos || []).map((url) => ({
          finalPath: typeof url === 'string' ? url : (url.full_url || url.video_url || url.url || ''),
          name: 'video',
          isExisting: true,
        })).filter((item) => item.finalPath)
      );

      if (product.vehicle_ids?.length) {
        apiRequest(`/vehicles/${product.vehicle_ids[0]}`)
          .then((vehicle) => {
            if (!cancelled && vehicle) setSelectedVehicle(vehicle);
          })
          .catch(() => {});
      }
    };

    dispatch(fetchMyPendingProduct(Number(editPendingId, 10)))
      .unwrap()
      .then(async (product) => {
        if (cancelled || !product) return;

        applyPendingProduct(product);

        try {
          const storageCellsResponse = await apiRequest(
            `/pending-product-storage-cells/?pending_product_id=${editPendingId}`,
          );
          const cells = Array.isArray(storageCellsResponse) ? storageCellsResponse : [];
          if (cancelled) return;
          setExistingPendingStorageCells(cells);
          const initialQuantities = {};
          cells.forEach((link) => {
            if (link.storage_cell_id) {
              initialQuantities[link.storage_cell_id] = link.value || '';
            }
          });
          setCellQuantities(initialQuantities);
        } catch {
          // Ячейки хранения не обязательны для открытия формы
        }
      })
      .catch((err) => {
        if (cancelled) return;
        alert(typeof err === 'string' ? err : 'Не удалось загрузить запчасть на модерации');
        navigate('/my-parts?tab=pending', { replace: true });
      })
      .finally(() => {
        if (!cancelled) setLoadingFormData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, editPendingMode, editPendingId, navigate, isReady, token, canAccess]);

  const applyDraftSnapshot = useCallback((snapshot, { skipAutosave = true, draftId } = {}) => {
    if (!snapshot) return;
    if (skipAutosave) skipAutosaveRef.current = true;
    if (draftId != null) draftIdRef.current = draftId;
    if (snapshot.formData) setFormData(snapshot.formData);
    if (snapshot.photos) setPhotos(snapshot.photos);
    if (snapshot.videos) setVideos(snapshot.videos);
    if (snapshot.cellQuantities) setCellQuantities(snapshot.cellQuantities);
    if (snapshot.vehicle) {
      setSelectedVehicle(snapshot.vehicle);
    } else if (snapshot.vehicleId) {
      apiRequest(`/vehicles/${snapshot.vehicleId}`)
        .then((vehicle) => {
          if (vehicle) setSelectedVehicle(vehicle);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!draftMode || !routeDraftId) return undefined;
    if (!readDraftSessionCache(Number(routeDraftId))) return undefined;
    skipAutosaveRef.current = true;
    draftIdRef.current = Number(routeDraftId);
    return undefined;
  }, [draftMode, routeDraftId]);

  useEffect(() => {
    if (!draftMode || !routeDraftId) return undefined;
    if (!token && !localStorage.getItem('token')) return undefined;

    let cancelled = false;
    const draftIdNum = Number(routeDraftId);
    const hadCache = hadDraftCacheRef.current;
    if (!hadCache) setLoadingFormData(true);

    dispatch(fetchProductDraft(draftIdNum))
      .unwrap()
      .then((draft) => {
        if (cancelled || !draft) return;

        const snapshot = draftToFormSnapshot(draft);
        applyDraftSnapshot(snapshot, { skipAutosave: true, draftId: draft.id });

        if (draft.vehicle_ids?.length && !snapshot.vehicle) {
          apiRequest(`/vehicles/${draft.vehicle_ids[0]}`)
            .then((vehicle) => {
              if (cancelled || !vehicle) return;
              setSelectedVehicle(vehicle);
              writeDraftSessionCache(draft.id, { ...snapshot, vehicle });
            })
            .catch(() => {
              writeDraftSessionCache(draft.id, snapshot);
            });
        } else {
          writeDraftSessionCache(draft.id, snapshot);
        }
      })
      .catch((err) => {
        if (!cancelled && !hadCache) {
          alert(typeof err === 'string' ? err : 'Не удалось загрузить черновик');
          navigate('/my-parts?tab=drafts', { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFormData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, draftMode, routeDraftId, token, applyDraftSnapshot, navigate]);

  useEffect(() => {
    if (!isDraftFlow || !isReady || !canAccess || loadingFormData) return undefined;
    if (!draftPayloadHasContent(draftPayload)) return undefined;

    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setDraftSaveStatus('saving');
      try {
        if (draftIdRef.current) {
          await dispatch(updateProductDraft({
            id: draftIdRef.current,
            payload: draftPayload,
          })).unwrap();
          writeDraftSessionCache(draftIdRef.current, {
            formData,
            photos,
            videos,
            cellQuantities,
            vehicle: selectedVehicle,
            vehicleId: selectedVehicle?.id ?? null,
          });
        } else {
          const created = await dispatch(createProductDraft(draftPayload)).unwrap();
          draftIdRef.current = created.id;
          writeDraftSessionCache(created.id, {
            formData,
            photos,
            videos,
            cellQuantities,
            vehicle: selectedVehicle,
            vehicleId: selectedVehicle?.id ?? null,
          });
          if (!draftMode) {
            navigate(`/my-parts/drafts/${created.id}/edit`, { replace: true });
          }
        }
        setDraftSaveStatus('saved');
      } catch (_err) {
        setDraftSaveStatus('error');
      }
    }, DRAFT_AUTOSAVE_MS);

    return () => window.clearTimeout(timer);
  }, [
    isDraftFlow,
    isReady,
    canAccess,
    loadingFormData,
    draftPayload,
    draftMode,
    dispatch,
    formData,
    photos,
    videos,
    cellQuantities,
    selectedVehicle,
    navigate,
  ]);

  useEffect(() => {
    if (draftSaving) {
      setDraftSaveStatus('saving');
    }
  }, [draftSaving]);

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
          // Use dedicated deferred video endpoint (stores in /temp/{org}/...)
          const result = await apiRequestFormData('/upload/video', formData);
          
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
    if ((fileToRemove instanceof File || fileToRemove instanceof Blob) && fileToRemove.finalPath && !fileToRemove.isExisting) {
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
    if ((fileToRemove instanceof File || fileToRemove instanceof Blob) && fileToRemove.finalPath && !fileToRemove.isExisting) {
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
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    if (name === 'article' || name === 'brand') {
      setRosskoLookupError(null);
      setRosskoLookupNotice(null);
    }
  };

  const handleFillFromRossko = async () => {
    const article = (formData.article || '').trim();
    const brand = (formData.brand || '').trim();

    if (!article) {
      setRosskoLookupError('Введите артикул для поиска в Rossko');
      setRosskoLookupNotice(null);
      return;
    }

    setRosskoLookupLoading(true);
    setRosskoLookupError(null);
    setRosskoLookupNotice(null);

    try {
      const response = await apiAxios.post('/rossko/GetSearch', {
        text: buildRosskoLookupText(article, brand),
        delivery_id: '000000001',
        address_id: 176458,
      });

      const best = pickBestRosskoPart(response.data, article, brand);
      if (!best) {
        setRosskoLookupError('В Rossko ничего не найдено по введённым данным');
        return;
      }

      const minPrice = roundRosskoSalePrice(getRosskoMinPrice(best));
      const filledArticle = best.partnumber || article;
      const filledBrand = best.brand || brand;
      const filledName = best.name || formData.name;

      setFormData((prev) => ({
        ...prev,
        article: filledArticle,
        brand: filledBrand,
        name: filledName || prev.name,
        condition: 'новый',
        sale_price: minPrice > 0 ? String(minPrice) : prev.sale_price,
      }));

      setRosskoLookupNotice(
        `Данные заполнены из Rossko: ${filledBrand || '—'} ${filledArticle}`.trim()
      );
    } catch (err) {
      setRosskoLookupError(
        err.response?.data?.detail || err.message || 'Ошибка при поиске в Rossko'
      );
    } finally {
      setRosskoLookupLoading(false);
    }
  };

  useEffect(() => {
    const q = (formData.article || '').trim();
    if (!q) {
      setArticleOptions([]);
      setArticleLoading(false);
      return undefined;
    }
    let cancelled = false;
    setArticleLoading(true);
    const t = setTimeout(() => {
      apiRequest(`/tecdoc-parts/articles/suggest?q=${encodeURIComponent(q)}&limit=30`)
        .then((rows) => {
          if (cancelled) return;
          setArticleOptions(Array.isArray(rows) ? rows : []);
        })
        .catch(() => {
          if (cancelled) return;
          setArticleOptions([]);
        })
        .finally(() => {
          if (cancelled) return;
          setArticleLoading(false);
        });
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [formData.article]);

  useEffect(() => {
    const q = (formData.brand || '').trim();
    const article = (formData.article || '').trim();
    if (!q && !article) {
      setBrandOptions([]);
      setBrandLoading(false);
      return undefined;
    }
    let cancelled = false;
    setBrandLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({
        q,
        article,
        limit: '30',
      });
      apiRequest(`/tecdoc-parts/brands/suggest?${params.toString()}`)
        .then((rows) => {
          if (cancelled) return;
          setBrandOptions(Array.isArray(rows) ? rows : []);
        })
        .catch(() => {
          if (cancelled) return;
          setBrandOptions([]);
        })
        .finally(() => {
          if (cancelled) return;
          setBrandLoading(false);
        });
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [formData.brand, formData.article]);

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
      const newCellData = {
        name: newCellName,
        storage_location_id: parseInt(formData.storage_location_id, 10),
      };

      const action = await dispatch(createStorageCell(newCellData));
      if (!createStorageCell.fulfilled.match(action)) {
        const message = action.payload || 'Ошибка при создании ячейки';
        alert(typeof message === 'string' ? message : 'Ошибка при создании ячейки');
        return;
      }

      const newCell = action.payload;
      setLocationCells((prev) => {
        if (prev.some((cell) => cell.id === newCell.id)) return prev;
        return [...prev, newCell];
      });
      setCellQuantities((prev) => ({
        ...prev,
        [newCell.id]: newCellValue,
      }));

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
    const errors = validatePartForm(formData);
    if (hasPartFormErrors(errors)) {
      setSubmitAttempted(true);
      setFieldErrors(errors);
      scrollToFirstPartFormError(errors);
      return;
    }
    setSubmitAttempted(false);
    setFieldErrors({});

    if (isDraftFlow && draftIdRef.current) {
      try {
        skipAutosaveRef.current = true;
        await dispatch(updateProductDraft({
          id: draftIdRef.current,
          payload: draftPayload,
        })).unwrap();

        const storageCellsForSubmit = buildStorageCellsFromQuantities(cellQuantities);
        const action = await dispatch(submitProductDraft({
          draftId: draftIdRef.current,
          storageCells: storageCellsForSubmit,
        }));
        if (submitProductDraft.rejected.match(action)) {
          return;
        }

        const pendingProductId = action.payload?.pending_product?.id;
        if (pendingProductId) {
          try {
            await savePendingProductStorageCells(dispatch, pendingProductId, cellQuantities);
          } catch (storageError) {
            console.error('Error creating storage cell assignments:', storageError);
            alert(typeof storageError === 'string' ? storageError : 'Запчасть создана, но не удалось сохранить адресное хранение');
          }
        }

        const submittedDraftId = draftIdRef.current;
        draftIdRef.current = null;
        clearDraftSessionCache(submittedDraftId);
        navigate('/my-parts?tab=pending');
        return;
      } catch (err) {
        console.error(err);
        alert(typeof err === 'string' ? err : 'Не удалось отправить черновик на модерацию');
        return;
      }
    }

    let photoUrls = [];
    let videoUrls = [];

    // Upload photos and videos separately - they're already uploaded
    if (photos.length > 0) {
      setIsUploadingMedia(true);
      try {
        // Photos are already uploaded with final paths, just use them
        photoUrls = photos
          .map((file) => {
            if (file?.finalPath) {
              return file.finalPath.startsWith('/') ? file.finalPath : `/${file.finalPath}`;
            }
            if (typeof file === 'string') {
              return file.startsWith('/') ? file : `/${file}`;
            }
            return null;
          })
          .filter(Boolean);
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
          .map((file) => {
            if (file?.finalPath) {
              return file.finalPath.startsWith('/') ? file.finalPath : `/${file.finalPath}`;
            }
            if (typeof file === 'string') {
              return file.startsWith('/') ? file : `/${file}`;
            }
            return null;
          })
          .filter(Boolean);
        
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
      part_type_id: formData.part_type_id ? parseInt(formData.part_type_id, 10) : null, // Required field
      vehicle_ids: selectedVehicle ? [selectedVehicle.id] : [],
      photos: photoUrls.length > 0 ? photoUrls : null,
      videos: videoUrls.length > 0 ? videoUrls : null,
    };

    try {
      if (editPendingMode) {
        const updateAction = await dispatch(updatePendingProduct({
          id: Number(editPendingId, 10),
          productData,
        }));
        if (updatePendingProduct.rejected.match(updateAction)) {
          return;
        }

        await Promise.all(
          existingPendingStorageCells.map((link) =>
            dispatch(deletePendingProductStorageCell(link.id)).unwrap().catch(() => null)
          )
        );

        try {
          await savePendingProductStorageCells(dispatch, Number(editPendingId, 10), cellQuantities);
        } catch (storageError) {
          console.error('Error creating storage cell assignments:', storageError);
          alert(typeof storageError === 'string' ? storageError : 'Запчасть создана, но не удалось сохранить адресное хранение');
        }

        navigate('/my-parts?tab=pending');
        return;
      }

      if (resubmitMode) {
        const resubmitAction = await dispatch(resubmitRejectedProduct({
          id: Number(resubmitId, 10),
          productData,
        }));
        if (resubmitRejectedProduct.rejected.match(resubmitAction)) {
          return;
        }

        const pendingProductId = resubmitAction.payload.pendingProduct.id;
        try {
          await savePendingProductStorageCells(dispatch, pendingProductId, cellQuantities);
        } catch (storageError) {
          console.error('Error creating storage cell assignments:', storageError);
          alert(typeof storageError === 'string' ? storageError : 'Запчасть отправлена, но не удалось сохранить адресное хранение');
        }

        navigate('/my-parts?tab=pending');
        return;
      }

      const productAction = await dispatch(createPendingProduct(productData));
      if (createPendingProduct.rejected.match(productAction)) {
        return;
      }

      // Get the created pending product ID
      const pendingProductId = productAction.payload.id;

      try {
        await savePendingProductStorageCells(dispatch, pendingProductId, cellQuantities);
      } catch (storageError) {
        console.error('Error creating storage cell assignments:', storageError);
        alert(typeof storageError === 'string' ? storageError : 'Запчасть создана, но не удалось сохранить адресное хранение');
      }

      // Успешно создано в pending_products, переходим к списку
      navigate('/my-parts');
    } catch (err) {
      console.error(err);
      alert('Неожиданная ошибка при добавлении запчасти');
    }
  };

  useEffect(() => {
    if (!isReady) return;
    if (!token || !user) {
      if (editPendingMode && editPendingId) {
        navigate('/auth', { replace: true, state: { from: `/my-parts/edit-pending/${editPendingId}` } });
      }
      return;
    }
    if (!canAccess) {
      navigate('/', { replace: true });
    }
  }, [isReady, token, user, canAccess, editPendingMode, editPendingId, navigate]);

  if (!isReady) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <AuthLoadingScreen />
      </div>
    );
  }

  if (loadingFormData && !draftMode) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <AuthLoadingScreen />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8 text-gray-500">Перенаправление...</div>
      </div>
    );
  }

  const submitLabel = productStatus || isUploadingMedia
    ? (resubmitMode ? 'Отправка...' : editPendingMode ? 'Сохранение...' : 'Создание...')
    : (resubmitMode ? 'Отправить повторно' : editPendingMode ? 'Сохранить' : 'Создать запчасть');

  const pageTitle = resubmitMode
    ? 'Повторная отправка на модерацию'
    : editPendingMode
      ? 'Редактирование запчасти на модерации'
      : draftMode
        ? 'Черновик запчасти'
        : 'Добавить запчасть';

  const cancelPath = (resubmitMode || editPendingMode)
    ? '/my-parts?tab=pending'
    : draftMode
      ? '/my-parts?tab=drafts'
      : '/my-parts';

  const draftStatusLabel = draftSaveStatus === 'saving'
    ? 'Сохранение черновика…'
    : draftSaveStatus === 'saved'
      ? 'Черновик сохранён'
      : draftSaveStatus === 'error'
        ? 'Не удалось сохранить черновик'
        : isDraftFlow
          ? 'Изменения сохраняются автоматически'
          : '';

  return (
    <div className="relative max-w-4xl mx-auto p-6 max-md:pb-32">
      {draftMode && loadingFormData && (
        <div
          className="absolute inset-0 z-20 flex items-start justify-center bg-white/75 pt-24"
          aria-busy="true"
          aria-live="polite"
        >
          <p className="rounded-full bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
            Обновление черновика…
          </p>
        </div>
      )}
      <h1 className="mb-6 text-2xl font-bold max-md:hidden">{pageTitle}</h1>
      {isDraftFlow && draftStatusLabel && (
        <p className={`mb-4 text-sm ${draftSaveStatus === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
          {draftStatusLabel}
        </p>
      )}
      {resubmitMode && rejectionReason && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-sm font-medium text-red-800">Причина отклонения</p>
          <p className="mt-1 text-sm text-red-700">{rejectionReason}</p>
        </div>
      )}
      <form id="add-part-form" onSubmit={handleSubmit} noValidate className="space-y-6 md:space-y-6">
        <MobilePageSection title="Основное">
        {/* Артикул */}
        <div data-part-field="article">
          <label className={partFieldLabelClass(showFieldError('article'))}>Артикул *</label>
          <input
            name="article"
            value={formData.article}
            onChange={handleInputChange}
            onFocus={() => setArticleFocused(true)}
            onBlur={() => setTimeout(() => setArticleFocused(false), 120)}
            className={partFieldClass(showFieldError('article'))}
            autoComplete="off"
          />
          {articleFocused && (articleLoading || articleOptions.length > 0) && (
            <ul className={SUGGEST_LIST}>
              {articleLoading && (
                <li className="px-3 py-2 text-gray-500">Поиск…</li>
              )}
              {articleOptions.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    className={SUGGEST_ITEM}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, article: opt }));
                      setArticleOptions([]);
                    }}
                  >
                    {opt}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Заполнение из Rossko</p>
              <p className="text-xs text-gray-600 mt-1">
                Введите артикул и при необходимости бренд, затем подгрузите название и цену.
              </p>
            </div>
            <button
              type="button"
              onClick={handleFillFromRossko}
              disabled={rosskoLookupLoading || !(formData.article || '').trim()}
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {rosskoLookupLoading ? 'Ищем в Rossko...' : 'Заполнить из Rossko'}
            </button>
          </div>
          {rosskoLookupError && (
            <p className="mt-3 text-sm text-red-700">{rosskoLookupError}</p>
          )}
          {rosskoLookupNotice && (
            <p className="mt-3 text-sm text-green-700">{rosskoLookupNotice}</p>
          )}
        </div>

        {/* Наименование */}
        <div data-part-field="name">
          <label className={partFieldLabelClass(showFieldError('name'))}>Наименование *</label>
          <input
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className={partFieldClass(showFieldError('name'))}
          />
        </div>

        {/* Бренд */}
        <div data-part-field="brand">
          <label className={partFieldLabelClass(showFieldError('brand'))}>Бренд *</label>
          <input
            name="brand"
            value={formData.brand}
            onChange={handleInputChange}
            onFocus={() => setBrandFocused(true)}
            onBlur={() => setTimeout(() => setBrandFocused(false), 120)}
            className={partFieldClass(showFieldError('brand'))}
            autoComplete="off"
          />
          {brandFocused && (brandLoading || brandOptions.length > 0) && (
            <ul className={SUGGEST_LIST}>
              {brandLoading && (
                <li className="px-3 py-2 text-gray-500">Поиск…</li>
              )}
              {brandOptions.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    className={SUGGEST_ITEM}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, brand: opt }));
                      setBrandOptions([]);
                    }}
                  >
                    {opt}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* Вид запчасти */}
        <div data-part-field="part_type_id">
          <label className={`${partFieldLabelClass(showFieldError('part_type_id'))} mb-1`}>
            Вид запчасти *
          </label>
          <select
            name="part_type_id"
            value={formData.part_type_id}
            onChange={handleInputChange}
            className={partFieldClass(showFieldError('part_type_id'))}
          >
            <option value="">Выберите вид запчасти</option>
            {partTypes.map(partType => (
              <option key={partType.id} value={partType.id}>
                {partType.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Описание */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <label className="block text-sm font-medium">Описание</label>
            {!aiDescriptionLoading && aiDescriptionAccess?.show_ui && (
              <span className="text-xs text-gray-500">
                Осталось сегодня: {aiDescriptionAccess.remaining_today ?? 0}
              </span>
            )}
          </div>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows="4"
            className="mt-1 block w-full px-3 py-2 border rounded-md"
            placeholder="Введите описание запчасти..."
          />
          {!aiDescriptionLoading && aiDescriptionAccess?.show_ui && (
            <div className="mt-2 space-y-1">
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={!canGenerateAiDescription}
                className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aiDescriptionGenerating ? 'Генерация…' : 'Сгенерировать описание'}
              </button>
              {aiDescriptionError && (
                <p className="text-xs text-red-600">{aiDescriptionError}</p>
              )}
            </div>
          )}
        </div>
        </MobilePageSection>

        <MobilePageSection title="Фото и видео">
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
        </MobilePageSection>

        <MobilePageSection title="Состояние">
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
        </MobilePageSection>

        <MobilePageSection title="Автомобиль">
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
          className="min-h-11 text-left text-base font-medium text-indigo-600 underline"
        >
          {selectedVehicle ? 'Изменить автомобиль' : 'Выбрать или добавить автомобиль'}
        </button>
        </MobilePageSection>

        <MobilePageSection title="Остаток и склад">
        {/* Количество */}
        <div data-part-field="quantity">
          <label className={partFieldLabelClass(showFieldError('quantity'))}>Количество *</label>
          <input
            name="quantity"
            type="number"
            min="0"
            value={formData.quantity}
            onChange={handleInputChange}
            className={partFieldClass(showFieldError('quantity'))}
          />
        </div>

        {/* Цена продажи */}
        <div data-part-field="sale_price">
          <label className={partFieldLabelClass(showFieldError('sale_price'))}>Цена продажи (₽) *</label>
          <input
            name="sale_price"
            type="number"
            step="0.01"
            min="0"
            value={formData.sale_price}
            onChange={handleInputChange}
            className={partFieldClass(showFieldError('sale_price'))}
          />
        </div>

        {/* Склад */}
        <div data-part-field="storage_location_id">
          <label className={partFieldLabelClass(showFieldError('storage_location_id'))}>Склад *</label>
          <select
            name="storage_location_id"
            value={formData.storage_location_id}
            onChange={handleInputChange}
            className={partFieldClass(showFieldError('storage_location_id'))}
          >
            <option value="">Выберите склад</option>
            {storageLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.address || `Склад #${loc.id}`}
              </option>
            ))}
          </select>
        </div>
        </MobilePageSection>

        {/* Адресное хранение - выбор ячеек */}
        {formData.storage_location_id && (
          <MobilePageSection title="Адресное хранение">
          <div className="rounded-lg bg-gray-50 p-4 max-md:bg-white max-md:p-0 md:bg-gray-50 md:p-4">
            <div className="mb-3 flex flex-col gap-2 max-md:gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="hidden text-lg font-medium text-gray-900 md:block">Адресное хранение</h3>
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
              <>
                <div className="hidden overflow-x-auto md:block">
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
                <ul className="space-y-3 md:hidden">
                  {locationCells.map((cell) => (
                    <li key={cell.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                      <label className="mb-1 block text-sm font-semibold text-gray-800">{cell.name}</label>
                      <input
                        type="text"
                        value={cellQuantities[cell.id] || ''}
                        onChange={(e) => handleCellQuantityChange(cell.id, e.target.value)}
                        className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        placeholder="Введите значение"
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          </MobilePageSection>
        )}

        <div className="hidden gap-3 md:flex">
          <button
            type="submit"
            disabled={productStatus || isUploadingMedia}
            className={`px-4 py-2 rounded-md ${(productStatus || isUploadingMedia)
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
              } text-white`}
          >
            {productStatus || isUploadingMedia ? (resubmitMode ? 'Отправка...' : 'Создание...') : submitLabel}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!isDraftFlow) {
                await cleanupFiles();
                setPhotos([]);
                setVideos([]);
              }
              navigate(cancelPath);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md"
          >
            Отмена
          </button>
        </div>
      </form>

      <MobileStickyFooter
        formId="add-part-form"
        primaryLabel={submitLabel}
        primaryDisabled={productStatus || isUploadingMedia}
        secondaryLabel="Отмена"
        onSecondary={async () => {
          if (!isDraftFlow) {
            await cleanupFiles();
            setPhotos([]);
            setVideos([]);
          }
          navigate(cancelPath);
        }}
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

export default AddPart;