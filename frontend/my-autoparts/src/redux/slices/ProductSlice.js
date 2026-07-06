// src/store/slices/ProductSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiAxios, apiAxiosUnauth, apiRequestFormData, formatApiDetail, formatAxiosErrorMessage } from '../../utils/apiClient';



// НОВЫЙ thunk: загрузка фото
export const uploadPhotos = createAsyncThunk(
    'products/uploadPhotos',
    async (files, { rejectWithValue }) => {
        try {
            const uploadPromises = Array.from(files).map(async file => {
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await apiRequestFormData('/upload/photo', formData);
                    
                    // Use the predicted path from backend response
                    if (res.path) {
                        return res.path;
                    }
                    // Fallback: construct predictive URL from temp_filename
                    if (res.organization_id && res.temp_filename) {
                        const webpFilename = res.temp_filename.replace(/\.[^/.]+$/, '.webp');
                        return `/pictures/${res.organization_id}/${webpFilename}`;
                    }
                    return res.url || null;
                } catch (error) {
                    console.error('Failed to upload file:', file.name, error);
                    throw error;
                }
            });
            const urls = await Promise.all(uploadPromises);
            console.log('Uploaded photo paths:', urls);
            return urls;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || error.message || 'Ошибка загрузки фото'
            );
        }
    }
);

// НОВЫЙ thunk: загрузка медиа (фото и видео)
export const uploadMedia = createAsyncThunk(
    'products/uploadMedia',
    async (files, { rejectWithValue }) => {
        try {
            const uploadPromises = Array.from(files).map(async file => {
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await apiRequestFormData('/upload/media', formData);
                    
                    // Use the relative path from backend response
                    if (res.path) {
                        return res.path;
                    }
                    // Fallback: construct predictive URL from temp_filename
                    if (res.organization_id && res.temp_filename) {
                        const webpFilename = res.temp_filename.replace(/\.[^/.]+$/, '.webp');
                        return `/pictures/${res.organization_id}/${webpFilename}`;
                    }
                    return res.url || null;
                } catch (error) {
                    console.error('Failed to upload media:', file.name, error);
                    throw error;
                }
            });
            const urls = await Promise.all(uploadPromises);
            console.log('Uploaded media paths:', urls);
            return urls;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || error.message || 'Ошибка загрузки медиа'
            );
        }
    }
);

// Async thunk: получение отклоненных запчастей пользователя
export const fetchMyRejectedProducts = createAsyncThunk(
    'products/fetchMyRejectedProducts',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get('/moderation/products/rejected/my');
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки отклоненных запчастей'
            );
        }
    }
);

// Async thunk: получение одной отклонённой запчасти
export const fetchMyRejectedProduct = createAsyncThunk(
    'products/fetchMyRejectedProduct',
    async (productId, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get(`/moderation/products/rejected/my/${productId}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки отклонённой запчасти'
            );
        }
    }
);

// Async thunk: удаление отклонённой запчасти
export const deleteRejectedProduct = createAsyncThunk(
    'products/deleteRejectedProduct',
    async (productId, { rejectWithValue }) => {
        try {
            await apiAxios.delete(`/moderation/products/rejected/my/${productId}`);
            return productId;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка удаления отклонённой запчасти'
            );
        }
    }
);

// Async thunk: повторная отправка отклонённой запчасти на модерацию
export const resubmitRejectedProduct = createAsyncThunk(
    'products/resubmitRejectedProduct',
    async ({ id, productData }, { rejectWithValue }) => {
        try {
            const response = await apiAxios.post(
                `/moderation/products/rejected/my/${id}/resubmit`,
                productData,
            );
            return { rejectedId: id, pendingProduct: response.data };
        } catch (error) {
            let errorMessage = 'Ошибка повторной отправки на модерацию';
            if (error.response?.data?.detail) {
                if (Array.isArray(error.response.data.detail)) {
                    errorMessage = error.response.data.detail.map((err) =>
                        typeof err === 'string' ? err : err.msg || 'Ошибка валидации'
                    ).join(', ');
                } else if (typeof error.response.data.detail === 'string') {
                    errorMessage = error.response.data.detail;
                }
            }
            return rejectWithValue(errorMessage);
        }
    }
);

// Async thunk: получение одной pending-запчасти
export const fetchMyPendingProduct = createAsyncThunk(
    'products/fetchMyPendingProduct',
    async (productId, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get(`/pending-products/${productId}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки запчасти на модерации'
            );
        }
    }
);

// Async thunk: обновление pending-запчасти
export const updatePendingProduct = createAsyncThunk(
    'products/updatePendingProduct',
    async ({ id, productData }, { rejectWithValue }) => {
        try {
            const response = await apiAxios.put(`/pending-products/${id}`, productData);
            return response.data;
        } catch (error) {
            let errorMessage = 'Ошибка обновления запчасти';
            if (error.response?.data?.detail) {
                if (Array.isArray(error.response.data.detail)) {
                    errorMessage = error.response.data.detail.map((err) =>
                        typeof err === 'string' ? err : err.msg || 'Ошибка валидации'
                    ).join(', ');
                } else if (typeof error.response.data.detail === 'string') {
                    errorMessage = error.response.data.detail;
                }
            }
            return rejectWithValue(errorMessage);
        }
    }
);

// Async thunk: удаление запчасти с модерации
export const deletePendingProduct = createAsyncThunk(
    'products/deletePendingProduct',
    async (productId, { rejectWithValue }) => {
        try {
            await apiAxios.delete(`/pending-products/${productId}`);
            return productId;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка удаления запчасти с модерации'
            );
        }
    }
);

// Async thunk: получение запчастей пользователя в ожидании модерации
export const fetchMyPendingProducts = createAsyncThunk(
    'products/fetchMyPendingProducts',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get('/pending-products/my');
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки запчастей на модерации'
            );
        }
    }
);

export const fetchMyProductDrafts = createAsyncThunk(
    'products/fetchMyProductDrafts',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get('/product-drafts/my');
            return response.data;
        } catch (error) {
            return rejectWithValue(
                formatApiDetail(error.response?.data?.detail) || 'Ошибка загрузки черновиков'
            );
        }
    }
);

export const fetchProductDraft = createAsyncThunk(
    'products/fetchProductDraft',
    async (draftId, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get(`/product-drafts/${draftId}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(
                formatApiDetail(error.response?.data?.detail) || 'Ошибка загрузки черновика'
            );
        }
    }
);

export const createProductDraft = createAsyncThunk(
    'products/createProductDraft',
    async (payload, { rejectWithValue }) => {
        try {
            const response = await apiAxios.post('/product-drafts/', payload);
            return response.data;
        } catch (error) {
            return rejectWithValue(
                formatApiDetail(error.response?.data?.detail) || 'Ошибка сохранения черновика'
            );
        }
    }
);

export const updateProductDraft = createAsyncThunk(
    'products/updateProductDraft',
    async ({ id, payload }, { rejectWithValue }) => {
        try {
            const response = await apiAxios.patch(`/product-drafts/${id}`, payload);
            return response.data;
        } catch (error) {
            return rejectWithValue(
                formatApiDetail(error.response?.data?.detail) || 'Ошибка сохранения черновика'
            );
        }
    }
);

export const deleteProductDraft = createAsyncThunk(
    'products/deleteProductDraft',
    async (draftId, { rejectWithValue }) => {
        try {
            await apiAxios.delete(`/product-drafts/${draftId}`);
            return draftId;
        } catch (error) {
            return rejectWithValue(
                formatApiDetail(error.response?.data?.detail) || 'Ошибка удаления черновика'
            );
        }
    }
);

export const submitProductDraft = createAsyncThunk(
    'products/submitProductDraft',
    async ({ draftId, storageCells = null }, { rejectWithValue }) => {
        try {
            const body = Array.isArray(storageCells) && storageCells.length
                ? { storage_cells: storageCells }
                : {};
            const response = await apiAxios.post(`/product-drafts/${draftId}/submit`, body);
            return response.data;
        } catch (error) {
            return rejectWithValue(
                formatApiDetail(error.response?.data?.detail) || 'Ошибка отправки черновика'
            );
        }
    }
);

// Async thunk: создание продукта в статусе ожидания
export const createPendingProduct = createAsyncThunk(
    'products/createPendingProduct',
    async (productData, { rejectWithValue }) => {
        try {
            console.log('Sending product data:', JSON.stringify(productData, null, 2));
            const response = await apiAxios.post(
                '/pending-products/',
                productData,
            );
            console.log('Response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Full error:', error);
            console.error('Error response:', error.response?.data);
            // Обработка детализированных ошибок FastAPI
            let errorMessage = 'Ошибка создания товара';
            if (error.response?.data?.detail) {
                if (Array.isArray(error.response.data.detail)) {
                    errorMessage = error.response.data.detail.map(err =>
                        typeof err === 'string' ? err : err.msg || 'Ошибка валидации'
                    ).join(', ');
                } else if (typeof error.response.data.detail === 'string') {
                    errorMessage = error.response.data.detail;
                }
            }
            return rejectWithValue(errorMessage);
        }
    }
);

// Async thunk: создание продукта
export const createProduct = createAsyncThunk(
    'products/createProduct',
    async (productData, { rejectWithValue }) => {
        try {
            const response = await apiAxios.post(
                '/products/',
                productData,
            );
            return response.data;
        } catch (error) {
            // Обработка детализированных ошибок FastAPI
            let errorMessage = 'Ошибка создания товара';
            if (error.response?.data?.detail) {
                if (Array.isArray(error.response.data.detail)) {
                    errorMessage = error.response.data.detail.map(err =>
                        typeof err === 'string' ? err : err.msg || 'Ошибка валидации'
                    ).join(', ');
                } else if (typeof error.response.data.detail === 'string') {
                    errorMessage = error.response.data.detail;
                }
            }
            return rejectWithValue(errorMessage);
        }
    }
);

export const updateProduct = createAsyncThunk(
    'products/updateProduct',
    async ({ id, productData }, { rejectWithValue }) => {
        try {
            console.log('Sending PUT request to /products/' + id);
            console.log('Request data:', JSON.stringify(productData, null, 2));
            const response = await apiAxios.put(
                `/products/${id}`,
                productData,
            );
            console.log('Response received:', response.data);
            return response.data;
        } catch (error) {
            console.error('Full error:', error);
            console.error('Error response:', error.response?.data);
            // Обработка детализированных ошибок FastAPI
            let errorMessage = 'Ошибка обновления товара';
            if (error.response?.data?.detail) {
                if (Array.isArray(error.response.data.detail)) {
                    errorMessage = error.response.data.detail.map(err =>
                        typeof err === 'string' ? err : err.msg || 'Ошибка валидации'
                    ).join(', ');
                } else if (typeof error.response.data.detail === 'string') {
                    errorMessage = error.response.data.detail;
                }
            }
            return rejectWithValue(errorMessage);
        }
    }
);

export const fetchProducts = createAsyncThunk(
    'products/fetchProducts',
    async (params = {}, { rejectWithValue }) => {
        try {
            const response = await apiAxiosUnauth.get(
                '/products/public/',
                { params }
            );
            const data = response.data;
            if (data && Array.isArray(data.items)) {
                return data.items;
            }
            return data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки товаров'
            );
        }
    }
);

// New action for fetching user's own products
let fetchMyProductsAbortController = null;

export const fetchMyProducts = createAsyncThunk(
    'products/fetchMyProducts',
    async (params = {}, { rejectWithValue }) => {
        if (fetchMyProductsAbortController) {
            fetchMyProductsAbortController.abort();
        }
        fetchMyProductsAbortController = new AbortController();
        const { signal } = fetchMyProductsAbortController;

        try {
            const { append: _append, ...apiParams } = params;
            const response = await apiAxios.get(
                '/products/',
                { params: apiParams, signal }
            );
            const data = response.data;
            if (Array.isArray(data)) {
                return {
                    items: data,
                    total: data.length,
                    page: apiParams.page ?? 1,
                    page_size: apiParams.page_size ?? data.length,
                };
            }
            return data;
        } catch (error) {
            if (signal.aborted || error.code === 'ERR_CANCELED' || error.name === 'CanceledError') {
                throw error;
            }
            const detail = error.response?.data?.detail;
            return rejectWithValue(
                formatApiDetail(detail) || error.message || 'Ошибка загрузки моих товаров'
            );
        }
    }
);

const PUBLIC_PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;

export const fetchPublicProduct = createAsyncThunk(
    'products/fetchPublicProduct',
    async (productId, { rejectWithValue, getState }) => {
        const cacheEntry = getState().products.publicProductCache?.[productId];
        if (cacheEntry && (Date.now() - cacheEntry.timestamp) < PUBLIC_PRODUCT_CACHE_TTL_MS) {
            return cacheEntry.data;
        }

        try {
            const response = await apiAxiosUnauth.get(`/products/public/${productId}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки товара'
            );
        }
    }
);

export const fetchProduct = createAsyncThunk(
    'products/fetchProduct',
    async (productId, { rejectWithValue, getState }) => {
        try {
            const token = localStorage.getItem('token');
            const user = getState()?.auth?.user;
            const useAuth = Boolean(token && user);

            if (!useAuth) {
                const response = await apiAxiosUnauth.get(`/products/public/${productId}`);
                return response.data;
            }

            try {
                const response = await apiAxios.get(`/products/${productId}`);
                return response.data;
            } catch (error) {
                if (error.response?.status === 401) {
                    const response = await apiAxiosUnauth.get(`/products/public/${productId}`);
                    return response.data;
                }
                throw error;
            }
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки товара'
            );
        }
    }
);

export const deleteProductPhoto = createAsyncThunk(
    'products/deleteProductPhoto',
    async ({ productId, photoId }, { rejectWithValue }) => {
        try {
            await apiAxios.delete(`/products/${productId}/photos/${photoId}`);
            return { productId, photoId };
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка удаления фото'
            );
        }
    }
);

export const deleteProductPhotos = createAsyncThunk(
    'products/deleteProductPhotos',
    async ({ productId, photoIds }, { rejectWithValue }) => {
        try {
            await apiAxios.delete(`/products/${productId}/photos`, {
                data: { photo_ids: photoIds }
            });
            return { productId, photoIds };
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка удаления фото'
            );
        }
    }
);

export const deleteProductVideos = createAsyncThunk(
    'products/deleteProductVideos',
    async ({ productId, videoIds }, { rejectWithValue }) => {
        try {
            console.log('=== DELETE VIDEOS REQUEST ===');
            console.log('Product ID:', productId);
            console.log('Video IDs to delete:', videoIds);
            console.log('Endpoint:', `/products/${productId}/videos`);
            
            await apiAxios.delete(`/products/${productId}/videos`, {
                data: { video_ids: videoIds }
            });
            
            console.log('Videos deleted successfully from backend');
            return { productId, videoIds };
        } catch (error) {
            console.error('Error deleting videos:', error);
            console.error('Error response:', error.response?.data);
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка удаления видео'
            );
        }
    }
);

export const deleteProductVideo = createAsyncThunk(
    'products/deleteProductVideo',
    async ({ productId, videoId }, { rejectWithValue }) => {
        try {
            console.log('=== DELETE SINGLE VIDEO REQUEST ===');
            console.log('Product ID:', productId);
            console.log('Video ID to delete:', videoId);
            console.log('Endpoint:', `/products/${productId}/videos/${videoId}`);
            
            await apiAxios.delete(`/products/${productId}/videos/${videoId}`);
            
            console.log('Video deleted successfully from backend');
            return { productId, videoId };
        } catch (error) {
            console.error('Error deleting single video:', error);
            console.error('Error response:', error.response?.data);
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка удаления видео'
            );
        }
    }
);

export const updateProductQuantityAPI = createAsyncThunk(
    'products/updateProductQuantityAPI',
    async ({ productId, newQuantity }, { rejectWithValue }) => {
        try {
            const response = await apiAxios.patch(
                `/products/${productId}/quantity`,
                { quantity: newQuantity }
            );
            return response.data;
        } catch (error) {
            // Обработка детализированных ошибок FastAPI
            let errorMessage = 'Ошибка обновления количества товара';
            if (error.response?.data?.detail) {
                if (Array.isArray(error.response.data.detail)) {
                    errorMessage = error.response.data.detail.map(err =>
                        typeof err === 'string' ? err : err.msg || 'Ошибка валидации'
                    ).join(', ');
                } else if (typeof error.response.data.detail === 'string') {
                    errorMessage = error.response.data.detail;
                }
            }
            return rejectWithValue(errorMessage);
        }
    }
);

export const fetchReferenceTransmissions = createAsyncThunk(
    'vehicles/referenceTransmissions',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get('/transmissions/');
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки типов КПП'
            );
        }
    }
);

export const fetchVehicles = createAsyncThunk(
    'vehicles/fetchVehicles',
    async (params = {}, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get('/vehicles/', {
                params: Object.keys(params || {}).length ? params : undefined,
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки автомобилей'
            );
        }
    }
);

export const createVehicle = createAsyncThunk(
    'vehicles/createVehicle',
    async (vehicleData, { rejectWithValue }) => {
        try {
            const response = await apiAxios.post(
                '/vehicles/',
                vehicleData,
            );
            return response.data;
        } catch (error) {
            const d = error.response?.data?.detail;
            const msg = Array.isArray(d)
                ? d.map((x) => (typeof x === 'string' ? x : x.msg || 'Ошибка')).join(', ')
                : (d || 'Ошибка создания автомобиля');
            return rejectWithValue(msg);
        }
    }
);

export const updateVehicle = createAsyncThunk(
    'vehicles/updateVehicle',
    async ({ id, ...patch }, { rejectWithValue }) => {
        try {
            const response = await apiAxios.patch(`/vehicles/${id}`, patch);
            return response.data;
        } catch (error) {
            const d = error.response?.data?.detail;
            const msg = Array.isArray(d)
                ? d.map((x) => (typeof x === 'string' ? x : x.msg || 'Ошибка')).join(', ')
                : (d || 'Ошибка сохранения автомобиля');
            return rejectWithValue(msg);
        }
    }
);

export const fetchVehicleCatalogManufacturers = createAsyncThunk(
    'vehicles/catalogManufacturers',
    async ({ q = '', limit = 80 } = {}, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get('/vehicle-catalog/manufacturers', {
                params: { q, limit },
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки марок'
            );
        }
    }
);

export const fetchVehicleCatalogModels = createAsyncThunk(
    'vehicles/catalogModels',
    async (manufacturerId, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get(
                `/vehicle-catalog/manufacturers/${manufacturerId}/models`
            );
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки моделей'
            );
        }
    }
);

export const fetchVehicleCatalogPassengercars = createAsyncThunk(
    'vehicles/catalogPassengercars',
    async (modelId, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get(
                `/vehicle-catalog/models/${modelId}/passengercars`
            );
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки поколений'
            );
        }
    }
);

export const fetchVehicleCatalogEngines = createAsyncThunk(
    'vehicles/catalogEngines',
    async (passengercarId, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get(
                `/vehicle-catalog/passengercars/${passengercarId}/engines`
            );
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки двигателей'
            );
        }
    }
);

export const fetchVehicleCatalogTransmissions = createAsyncThunk(
    'vehicles/catalogTransmissions',
    async (passengercarId, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get(
                `/vehicle-catalog/passengercars/${passengercarId}/transmissions`
            );
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки КПП'
            );
        }
    }
);

export const fetchCatalogProducts = createAsyncThunk(
    'products/fetchCatalogProducts',
    async (params = {}, { rejectWithValue, signal }) => {
        try {
            const { append: _append, ...apiParams } = params;
            const queryParams = new URLSearchParams();
            Object.entries(apiParams).forEach(([key, value]) => {
                if (value === null || value === undefined || value === '') return;
                if (Array.isArray(value)) {
                    value.forEach((item) => {
                        if (item !== null && item !== undefined && item !== '') {
                            queryParams.append(key, String(item));
                        }
                    });
                    return;
                }
                queryParams.set(key, String(value));
            });
            const response = await apiAxiosUnauth.get('/catalog/products', {
                params: queryParams,
                signal,
            });
            return response.data;
        } catch (error) {
            if (signal?.aborted || error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
                return rejectWithValue({ aborted: true });
            }
            return rejectWithValue(
                formatAxiosErrorMessage(error, 'Ошибка загрузки каталога')
            );
        }
    }
);

export const fetchCatalogFacets = createAsyncThunk(
    'products/fetchCatalogFacets',
    async (params = {}, { rejectWithValue, getState }) => {
        if (getState().products.catalogFacets) {
            return getState().products.catalogFacets;
        }
        try {
            const response = await apiAxiosUnauth.get('/catalog/facets', { params });
            return response.data;
        } catch (error) {
            return rejectWithValue(
                formatAxiosErrorMessage(error, 'Ошибка загрузки фильтров')
            );
        }
    }
);

export const fetchPublicPartTypes = createAsyncThunk(
    'products/fetchPublicPartTypes',
    async (_, { rejectWithValue, getState }) => {
        const existing = getState().products.publicPartTypes;
        if (existing?.length) {
            return existing;
        }
        try {
            const response = await apiAxiosUnauth.get('/part-types/public');
            return response.data;
        } catch (error) {
            return rejectWithValue(
                formatAxiosErrorMessage(error, 'Ошибка загрузки категорий')
            );
        }
    }
);

// Получить все продукты (без поиска)
const fetchAllProducts = createAsyncThunk(
    'products/fetchAllProducts',
    async (_, { rejectWithValue }) => {
        try {
            console.log('fetchAllProducts: Making API call');
            const response = await apiAxiosUnauth.get(`/search-products/search`, {
                params: { q: '' }, // Пустой запрос для получения всех продуктов
            });

            console.log('fetchAllProducts: Response received', response.data);
            return response.data || [];
        } catch (error) {
            console.error('fetchAllProducts: Error', error);
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки продуктов'
            );
        }
    }
);

export const searchAllProducts = createAsyncThunk(
    'products/searchAllProducts',
    async (query, { rejectWithValue, getState }) => {
        const trimmedQuery = query.trim();

        // Проверяем кэш
        const state = getState();
        const cacheEntry = state.products.searchCache[trimmedQuery];

        // Если данные в кэше свежие (менее 5 минут), используем их
        if (cacheEntry && (Date.now() - cacheEntry.timestamp) < 5 * 60 * 1000) {
            return cacheEntry.data;
        }

        try {
            // Используем новый комбинированный endpoint
            const response = await apiAxiosUnauth.get(`/search-products/search-combined`, {
                params: { q: trimmedQuery },
            });

            const { direct = [], analogs = [] } = response.data;

            // Убираем дубликаты по `id`
            const merged = [...direct, ...analogs];
            const unique = merged.reduce((acc, item) => {
                if (!acc.find(p => p.id === item.id)) acc.push(item);
                return acc;
            }, []);

            return unique;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка поиска запчастей'
            );
        }
    }
);

export const searchUsedParts = createAsyncThunk(
    'products/searchUsedParts',
    async (query, { rejectWithValue, getState, dispatch }) => {
        const trimmedQuery = query.trim();

        // Проверяем кэш
        const state = getState();
        const cacheEntry = state.products.usedPartsCache?.[trimmedQuery];
        const cacheTime = 10 * 60 * 1000; // 10 мин

        if (cacheEntry && (Date.now() - cacheEntry.timestamp) < cacheTime) {
            return cacheEntry.data;
        }

        try {
            // ШАГ 1: Быстрый поиск запчастей в наличии
            const inStockResponse = await apiAxiosUnauth.get(`/search-products/search-used-parts`, {
                params: { q: trimmedQuery, only_in_stock: true },
            });
            
            const inStockData = inStockResponse.data;
            
            // Если мы получили данные в наличии, можем сразу обновить состояние через промежуточный экшен
            // или просто вернуть их как часть итогового результата.
            // Но чтобы "грузились ниже", нам нужно обновить состояние ДВАЖДЫ.
            // Redux Toolkit не очень любит двойные fulfill в одном thunk, 
            // поэтому мы можем использовать dispatch другого экшена или просто дождаться второго вызова.
            
            // Запускаем второй поиск (аналоги) асинхронно
            // Мы возвращаем сначала данные из наличия, а аналоги подгрузим вторым запросом
            
            // Чтобы реализовать именно "подгрузку ниже", изменим логику:
            // 1. Возвращаем inStockData
            // 2. В extraReducers сохраняем его
            // 3. Запускаем второй thunk для аналогов
            
            dispatch(searchUsedAnalogs(trimmedQuery));
            
            return inStockData;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка поиска б/у запчастей'
            );
        }
    }
);

export const searchUsedAnalogs = createAsyncThunk(
    'products/searchUsedAnalogs',
    async (query, { rejectWithValue }) => {
        try {
            const response = await apiAxiosUnauth.get(`/search-products/search-used-parts`, {
                params: { q: query, only_analogs: true },
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.detail);
        }
    }
);

const productSlice = createSlice({
    name: 'products',
    initialState: {
        items: [],
        pendingItems: [], // Запчасти на модерации
        rejectedItems: [], // Отклоненные запчасти
        vehicles: [],
        currentProduct: null,
        loading: false,
        analogsLoading: false,
        vehiclesLoading: false,
        error: null,
        searchCache: {}, // Кэш результатов поиска: {query: {data, timestamp}}
        publicProductCache: {}, // Кэш карточек: {productId: {data, timestamp}}
        catalogFilterKey: null,
        usedPartsData: null, // Данные поиска б/у запчастей: {available_parts, analog_parts, rossko_data}
        usedPartsCache: {}, // Кэш результатов поиска б/у запчастей: {query: {data, timestamp}}
        catalogItems: [],
        catalogTotal: 0,
        catalogPage: 1,
        catalogPageSize: 20,
        catalogHasMore: false,
        catalogLoading: false,
        catalogLoadingMore: false,
        catalogFacets: null,
        publicPartTypes: [],
        myProductsTotal: 0,
        myProductsTotalQuantity: 0,
        myProductsTotalValue: 0,
        myProductsPage: 1,
        myProductsPageSize: 30,
        myProductsHasMore: false,
        myProductsLoadingMore: false,
        myProductsFilterKey: null,
        draftItems: [],
        draftLoading: false,
        draftSaving: false,
        draftError: null,
        currentDraft: null,
    },
    reducers: {
        clearProductError: (state) => {
            state.error = null;
        },
        resetProducts: (state) => {
            state.items = [];
            state.loading = false;
            state.error = null;
            state.myProductsTotal = 0;
            state.myProductsTotalQuantity = 0;
            state.myProductsTotalValue = 0;
            state.myProductsPage = 1;
            state.myProductsHasMore = false;
            state.myProductsLoadingMore = false;
            state.myProductsFilterKey = null;
        },
        clearSearchCache: (state) => {
            state.searchCache = {};
        },
        resetCatalogCatalog: (state) => {
            state.catalogItems = [];
            state.catalogTotal = 0;
            state.catalogPage = 1;
            state.catalogHasMore = false;
            state.catalogLoading = false;
            state.catalogLoadingMore = false;
        },
        clearUsedPartsSearch: (state) => {
            state.usedPartsData = null;
            state.loading = false;
            state.analogsLoading = false;
        },
        updateProductQuantity: (state, action) => {
            const { productId, newQuantity } = action.payload;
            const product = state.items.find(p => p.id === productId);
            if (product) {
                product.quantity = newQuantity;
                if (newQuantity <= 0) {

                    state.items = state.items.filter(p => p.id !== productId);
                }
            }
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchMyRejectedProducts.pending, (state) => {
                state.error = null;
            })
            .addCase(fetchMyRejectedProducts.fulfilled, (state, action) => {
                state.rejectedItems = action.payload;
            })
            .addCase(fetchMyRejectedProducts.rejected, (state, action) => {
                state.error = action.payload;
                state.rejectedItems = [];
            })
            .addCase(fetchMyPendingProducts.pending, (state) => {
                state.error = null;
            })
            .addCase(fetchMyPendingProducts.fulfilled, (state, action) => {
                state.pendingItems = action.payload;
            })
            .addCase(fetchMyPendingProducts.rejected, (state, action) => {
                state.error = action.payload;
                state.pendingItems = [];
            })
            .addCase(deletePendingProduct.fulfilled, (state, action) => {
                state.pendingItems = state.pendingItems.filter((p) => p.id !== action.payload);
            })
            .addCase(deletePendingProduct.rejected, (state, action) => {
                state.error = action.payload;
            })
            .addCase(updatePendingProduct.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updatePendingProduct.fulfilled, (state, action) => {
                state.loading = false;
                const updated = action.payload;
                state.pendingItems = state.pendingItems.map((item) =>
                    item.id === updated.id ? { ...item, ...updated } : item
                );
            })
            .addCase(updatePendingProduct.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(deleteRejectedProduct.fulfilled, (state, action) => {
                state.rejectedItems = state.rejectedItems.filter((p) => p.id !== action.payload);
            })
            .addCase(deleteRejectedProduct.rejected, (state, action) => {
                state.error = action.payload;
            })
            .addCase(resubmitRejectedProduct.fulfilled, (state, action) => {
                state.loading = false;
                const { rejectedId, pendingProduct } = action.payload;
                state.rejectedItems = state.rejectedItems.filter((p) => p.id !== rejectedId);
                if (pendingProduct) {
                    state.pendingItems = [pendingProduct, ...state.pendingItems.filter((p) => p.id !== pendingProduct.id)];
                }
            })
            .addCase(resubmitRejectedProduct.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(resubmitRejectedProduct.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(searchAllProducts.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.items = [];
            })
            .addCase(searchAllProducts.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;

                // Сохраняем в кэш (получаем query из аргументов thunk)
                const query = action.meta.arg; // thunk получает query как первый аргумент
                if (query && query.trim()) {
                    state.searchCache[query.trim()] = {
                        data: action.payload,
                        timestamp: Date.now()
                    };
                }
            })
            .addCase(searchUsedParts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(searchUsedParts.fulfilled, (state, action) => {
                state.loading = false;
                state.usedPartsData = action.payload;

                // Сохраняем в кэш
                const query = action.meta.arg;
                if (query && query.trim()) {
                    state.usedPartsCache[query.trim()] = {
                        data: action.payload,
                        timestamp: Date.now()
                    };
                }
            })
            .addCase(searchUsedAnalogs.pending, (state) => {
                state.analogsLoading = true;
            })
            .addCase(searchUsedAnalogs.fulfilled, (state, action) => {
                state.analogsLoading = false;
                if (!state.usedPartsData) {
                    state.usedPartsData = {
                        available_parts: [],
                        analog_parts: [],
                        rossko_data: null,
                    };
                }
                const excludeIds = new Set([
                    ...(state.usedPartsData.available_parts || []).map((p) => p.id),
                    ...state.catalogItems.map((p) => p.id),
                ]);
                state.usedPartsData.analog_parts = (action.payload.analog_parts || []).filter(
                    (p) => !excludeIds.has(p.id)
                );
                state.usedPartsData.rossko_data = action.payload.rossko_data;

                const query = action.meta.arg;
                if (query && query.trim()) {
                    state.usedPartsCache[query.trim()] = {
                        data: state.usedPartsData,
                        timestamp: Date.now(),
                    };
                }
            })
            .addCase(searchUsedAnalogs.rejected, (state) => {
                state.analogsLoading = false;
            })
            .addCase(searchUsedParts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                state.usedPartsData = null;
            })
            .addCase(searchAllProducts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                state.items = [];
            })
            .addCase(fetchCatalogProducts.pending, (state, action) => {
                const append = Boolean(action.meta?.arg?.append);
                if (append) {
                    state.catalogLoadingMore = true;
                } else {
                    state.catalogLoading = true;
                }
                state.error = null;
            })
            .addCase(fetchCatalogProducts.fulfilled, (state, action) => {
                const append = Boolean(action.meta?.arg?.append);
                state.catalogLoading = false;
                state.catalogLoadingMore = false;
                const newItems = action.payload.items || [];
                const pageSize = action.payload.page_size ?? state.catalogPageSize ?? 20;
                const beforeLen = state.catalogItems.length;
                if (append) {
                    const existingIds = new Set(state.catalogItems.map((p) => p.id));
                    newItems.forEach((item) => {
                        if (!existingIds.has(item.id)) {
                            state.catalogItems.push(item);
                        }
                    });
                } else {
                    state.catalogItems = newItems;
                }
                state.catalogTotal = action.payload.total ?? 0;
                state.catalogPage = action.payload.page ?? 1;
                state.catalogPageSize = pageSize;
                const addedCount = state.catalogItems.length - (append ? beforeLen : 0);
                const receivedFullPage = newItems.length >= pageSize;
                const hasRoomByTotal = state.catalogItems.length < state.catalogTotal;
                state.catalogHasMore =
                    hasRoomByTotal && receivedFullPage && (append ? addedCount > 0 : newItems.length > 0);
                if (!append) {
                    const { append: _append, page: _page, ...filterArg } = action.meta?.arg || {};
                    state.catalogFilterKey = JSON.stringify(filterArg);
                }
            })
            .addCase(fetchCatalogProducts.rejected, (state, action) => {
                if (action.meta?.aborted || action.payload?.aborted) {
                    return;
                }
                const append = Boolean(action.meta?.arg?.append);
                state.catalogLoading = false;
                state.catalogLoadingMore = false;
                if (!append) {
                    state.error = action.payload;
                    state.catalogItems = [];
                    state.catalogTotal = 0;
                    state.catalogHasMore = false;
                }
            })
            .addCase(fetchCatalogFacets.fulfilled, (state, action) => {
                state.catalogFacets = action.payload;
            })
            .addCase(fetchPublicPartTypes.fulfilled, (state, action) => {
                state.publicPartTypes = action.payload || [];
            })
            .addCase(fetchAllProducts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAllProducts.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchAllProducts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                state.items = [];
            })
            .addCase(uploadPhotos.pending, (state) => {
                state.loading = true;
            })
            .addCase(uploadPhotos.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(uploadPhotos.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(createVehicle.pending, (state) => {
                state.vehiclesLoading = true;
            })
            .addCase(createVehicle.fulfilled, (state, action) => {
                state.vehiclesLoading = false;
                state.vehicles.push(action.payload);
            })
            .addCase(createVehicle.rejected, (state, action) => {
                state.vehiclesLoading = false;
                state.error = action.payload;
            })
            .addCase(updateVehicle.fulfilled, (state, action) => {
                const v = action.payload;
                const idx = state.vehicles.findIndex((x) => x.id === v.id);
                if (idx >= 0) state.vehicles[idx] = v;
            })
            .addCase(updateVehicle.rejected, (state, action) => {
                state.error = action.payload;
            })
            .addCase(fetchVehicles.pending, (state) => {
                state.vehiclesLoading = true;
            })
            .addCase(fetchVehicles.fulfilled, (state, action) => {
                state.vehiclesLoading = false;
                state.vehicles = action.payload;
            })
            .addCase(fetchVehicles.rejected, (state, action) => {
                state.vehiclesLoading = false;
                state.error = action.payload;
            })
            .addCase(createPendingProduct.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createPendingProduct.fulfilled, (state, action) => {
                state.loading = false;
                // Не добавляем в items, так как это pending product
            })
            .addCase(createPendingProduct.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(createProduct.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createProduct.fulfilled, (state, action) => {
                state.loading = false;
                state.items.push(action.payload);
            })
            .addCase(createProduct.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(updateProduct.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateProduct.fulfilled, (state, action) => {
                state.loading = false;
                // Обновляем продукт в списке items
                const index = state.items.findIndex(item => item.id === action.payload.id);
                if (index !== -1) {
                    state.items[index] = action.payload;
                }
                // Также обновляем currentProduct
                state.currentProduct = action.payload;
            })
            .addCase(updateProduct.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(fetchProducts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchProducts.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchProducts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(fetchMyProducts.pending, (state, action) => {
                const append = Boolean(action.meta?.arg?.append);
                if (append) {
                    state.myProductsLoadingMore = true;
                } else {
                    state.loading = true;
                }
                state.error = null;
            })
            .addCase(fetchMyProducts.fulfilled, (state, action) => {
                const append = Boolean(action.meta?.arg?.append);
                state.loading = false;
                state.myProductsLoadingMore = false;
                const newItems = action.payload?.items || [];
                const pageSize = action.payload?.page_size ?? state.myProductsPageSize ?? 30;
                const beforeLen = state.items.length;
                if (append) {
                    const existingIds = new Set(state.items.map((p) => p.id));
                    newItems.forEach((item) => {
                        if (!existingIds.has(item.id)) {
                            state.items.push(item);
                        }
                    });
                } else {
                    state.items = newItems;
                }
                state.myProductsTotal = action.payload?.total ?? state.items.length;
                state.myProductsTotalQuantity = action.payload?.total_quantity ?? 0;
                state.myProductsTotalValue = action.payload?.total_value ?? 0;
                state.myProductsPage = action.payload?.page ?? 1;
                state.myProductsPageSize = pageSize;
                const addedCount = state.items.length - (append ? beforeLen : 0);
                const receivedFullPage = newItems.length >= pageSize;
                const hasRoomByTotal = state.items.length < state.myProductsTotal;
                state.myProductsHasMore =
                    hasRoomByTotal && receivedFullPage && (append ? addedCount > 0 : newItems.length > 0);
                if (!append) {
                    const arg = action.meta?.arg || {};
                    state.myProductsFilterKey = JSON.stringify({
                        storage: String(arg.storage_location_id || ''),
                        cell: String(arg.storage_cell_id || ''),
                        cellValue: String(arg.storage_cell_value || ''),
                        q: (arg.q || '').trim(),
                        sort: arg.sort || 'date_desc',
                        stock: arg.stock || '',
                        no_photo: Boolean(arg.no_photo),
                    });
                }
            })
            .addCase(fetchMyProducts.rejected, (state, action) => {
                const append = Boolean(action.meta?.arg?.append);
                if (action.meta?.aborted) {
                    if (append) {
                        state.myProductsLoadingMore = false;
                    } else {
                        state.loading = false;
                    }
                    return;
                }
                state.loading = false;
                state.myProductsLoadingMore = false;
                state.error = action.payload;
            })
            .addCase(fetchProduct.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchProduct.fulfilled, (state, action) => {
                state.loading = false;
                state.currentProduct = action.payload;
            })
            .addCase(fetchProduct.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(fetchPublicProduct.pending, (state, action) => {
                state.error = null;
                const nextId = action.meta.arg;
                const cacheEntry = state.publicProductCache[nextId];
                if (cacheEntry && (Date.now() - cacheEntry.timestamp) < PUBLIC_PRODUCT_CACHE_TTL_MS) {
                    state.currentProduct = cacheEntry.data;
                    state.loading = false;
                    return;
                }
                if (state.currentProduct?.id === nextId) {
                    state.loading = true;
                    return;
                }
                state.loading = true;
                state.currentProduct = null;
            })
            .addCase(fetchPublicProduct.fulfilled, (state, action) => {
                state.loading = false;
                state.currentProduct = action.payload;
                if (action.payload?.id) {
                    state.publicProductCache[action.payload.id] = {
                        data: action.payload,
                        timestamp: Date.now(),
                    };
                }
            })
            .addCase(fetchPublicProduct.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(deleteProductPhoto.pending, (state) => {
                state.loading = true;
            })
            .addCase(deleteProductPhoto.fulfilled, (state, action) => {
                state.loading = false;
                // Удаляем фото из currentProduct, если оно загружено
                if (state.currentProduct && state.currentProduct.id === action.payload.productId) {
                    state.currentProduct.photos = state.currentProduct.photos.filter(
                        photo => photo.id !== action.payload.photoId
                    );
                }
            })
            .addCase(deleteProductPhoto.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(deleteProductPhotos.pending, (state) => {
                state.loading = true;
            })
            .addCase(deleteProductPhotos.fulfilled, (state, action) => {
                state.loading = false;
                // Удаляем фото из currentProduct, если оно загружено
                if (state.currentProduct && state.currentProduct.id === action.payload.productId) {
                    state.currentProduct.photos = state.currentProduct.photos.filter(
                        photo => !action.payload.photoIds.includes(photo.id)
                    );
                }
            })
            .addCase(deleteProductPhotos.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(deleteProductVideos.pending, (state) => {
                state.loading = true;
            })
            .addCase(deleteProductVideos.fulfilled, (state, action) => {
                state.loading = false;
                // Удаляем видео из currentProduct, если оно загружено
                if (state.currentProduct && state.currentProduct.id === action.payload.productId) {
                    state.currentProduct.videos = state.currentProduct.videos.filter(
                        video => !action.payload.videoIds.includes(video.id)
                    );
                }
            })
            .addCase(deleteProductVideos.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(deleteProductVideo.pending, (state) => {
                state.loading = true;
            })
            .addCase(deleteProductVideo.fulfilled, (state, action) => {
                state.loading = false;
                // Удаляем видео из currentProduct, если оно загружено
                if (state.currentProduct && state.currentProduct.id === action.payload.productId) {
                    state.currentProduct.videos = state.currentProduct.videos.filter(
                        video => video.id !== action.payload.videoId
                    );
                }
            })
            .addCase(deleteProductVideo.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(fetchPublicProducts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPublicProducts.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchPublicProducts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(updateProductQuantityAPI.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateProductQuantityAPI.fulfilled, (state, action) => {
                state.loading = false;
                // Обновляем продукт в списке items
                const index = state.items.findIndex(item => item.id === action.payload.id);
                if (index !== -1) {
                    state.items[index] = action.payload;
                }
                // Также обновляем currentProduct
                state.currentProduct = action.payload;
            })
            .addCase(updateProductQuantityAPI.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(fetchMyProductDrafts.pending, (state) => {
                state.draftError = null;
                if (state.draftItems.length === 0) {
                    state.draftLoading = true;
                }
            })
            .addCase(fetchMyProductDrafts.fulfilled, (state, action) => {
                state.draftLoading = false;
                state.draftItems = action.payload || [];
            })
            .addCase(fetchMyProductDrafts.rejected, (state, action) => {
                state.draftLoading = false;
                state.draftError = action.payload;
            })
            .addCase(fetchProductDraft.pending, (state) => {
                state.draftLoading = true;
                state.draftError = null;
            })
            .addCase(fetchProductDraft.fulfilled, (state, action) => {
                state.draftLoading = false;
                state.currentDraft = action.payload;
            })
            .addCase(fetchProductDraft.rejected, (state, action) => {
                state.draftLoading = false;
                state.draftError = action.payload;
            })
            .addCase(createProductDraft.pending, (state) => {
                state.draftSaving = true;
                state.draftError = null;
            })
            .addCase(createProductDraft.fulfilled, (state, action) => {
                state.draftSaving = false;
                state.currentDraft = action.payload;
                const exists = state.draftItems.some((item) => item.id === action.payload.id);
                if (!exists) {
                    state.draftItems = [action.payload, ...state.draftItems];
                }
            })
            .addCase(createProductDraft.rejected, (state, action) => {
                state.draftSaving = false;
                state.draftError = action.payload;
            })
            .addCase(updateProductDraft.pending, (state) => {
                state.draftSaving = true;
                state.draftError = null;
            })
            .addCase(updateProductDraft.fulfilled, (state, action) => {
                state.draftSaving = false;
                state.currentDraft = action.payload;
                const index = state.draftItems.findIndex((item) => item.id === action.payload.id);
                if (index >= 0) {
                    state.draftItems[index] = action.payload;
                }
            })
            .addCase(updateProductDraft.rejected, (state, action) => {
                state.draftSaving = false;
                state.draftError = action.payload;
            })
            .addCase(deleteProductDraft.fulfilled, (state, action) => {
                state.draftItems = state.draftItems.filter((item) => item.id !== action.payload);
                if (state.currentDraft?.id === action.payload) {
                    state.currentDraft = null;
                }
            })
            .addCase(submitProductDraft.fulfilled, (state, action) => {
                const draftArg = action.meta?.arg;
                const draftId = typeof draftArg === 'object' && draftArg != null
                    ? draftArg.draftId
                    : draftArg;
                if (draftId) {
                    state.draftItems = state.draftItems.filter((item) => item.id !== draftId);
                }
                if (state.currentDraft?.id === draftId) {
                    state.currentDraft = null;
                }
            });
    },
});


export const fetchPublicProducts = createAsyncThunk(
    'products/fetchPublicProducts',
    async (_, { rejectWithValue }) => {
        try {
            // Запрос без авторизации к публичному endpoint поиска
            const response = await apiAxiosUnauth.get(`/search-products/search`, {
                params: { q: '' }, // Пустой запрос для получения всех продуктов
            });

            return response.data || [];
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки продуктов'
            );
        }
    }
);

export const { clearProductError, resetProducts, updateProductQuantity, clearSearchCache, resetCatalogCatalog, clearUsedPartsSearch } = productSlice.actions;
export { fetchAllProducts };
export const selectMyParts = (state) => state.products.items;
export const selectMyPartsStatus = (state) => state.products.loading ? 'loading' : 'idle';
export const selectMyPartsError = (state) => state.products.error;
export const selectMyProductsTotal = (state) => state.products.myProductsTotal;
export const selectMyProductsTotalQuantity = (state) => state.products.myProductsTotalQuantity;
export const selectMyProductsTotalValue = (state) => state.products.myProductsTotalValue;
export const selectMyProductsPage = (state) => state.products.myProductsPage;
export const selectMyProductsHasMore = (state) => state.products.myProductsHasMore;
export const selectMyProductsLoadingMore = (state) => state.products.myProductsLoadingMore;
export const selectMyProductsFilterKey = (state) => state.products.myProductsFilterKey;
export const selectDraftItems = (state) => state.products.draftItems;
export const selectDraftLoading = (state) => state.products.draftLoading;
export const selectDraftSaving = (state) => state.products.draftSaving;
export const selectDraftError = (state) => state.products.draftError;
export const selectCurrentDraft = (state) => state.products.currentDraft;
export const selectCatalogItems = (state) => state.products.catalogItems;
export const selectCatalogTotal = (state) => state.products.catalogTotal;
export const selectCatalogPage = (state) => state.products.catalogPage;
export const selectCatalogPageSize = (state) => state.products.catalogPageSize;
export const selectCatalogLoading = (state) => state.products.catalogLoading;
export const selectCatalogLoadingMore = (state) => state.products.catalogLoadingMore;
export const selectCatalogHasMore = (state) => state.products.catalogHasMore;
export const selectCatalogFacets = (state) => state.products.catalogFacets;
export const selectCatalogFilterKey = (state) => state.products.catalogFilterKey;
export const selectPublicPartTypes = (state) => state.products.publicPartTypes;
export const selectAnalogsLoading = (state) => state.products.analogsLoading;
export default productSlice.reducer;