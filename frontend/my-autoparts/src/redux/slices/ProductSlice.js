// src/store/slices/ProductSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiAxios, apiAxiosUnauth, apiRequestFormData } from '../../utils/apiClient';



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
                    return res.url;
                } catch (error) {
                    console.error('Failed to upload file:', file.name, error);
                    throw error;
                }
            });
            const urls = await Promise.all(uploadPromises);
            return urls;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || error.message || 'Ошибка загрузки фото'
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

// Async thunk: создание продукта в статусе ожидания
export const createPendingProduct = createAsyncThunk(
    'products/createPendingProduct',
    async (productData, { rejectWithValue }) => {
        try {
            const response = await apiAxios.post(
                '/pending-products/',
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
            const response = await apiAxios.put(
                `/products/${id}`,
                productData,
            );
            return response.data;
        } catch (error) {
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
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки товаров'
            );
        }
    }
);

export const fetchProduct = createAsyncThunk(
    'products/fetchProduct',
    async (productId, { rejectWithValue }) => {
        try {
            const response = await apiAxiosUnauth.get(
                `/products/public/${productId}`,
            );
            return response.data;
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

export const fetchVehicles = createAsyncThunk(
    'vehicles/fetchVehicles',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get(
                '/vehicles/',
            );
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
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка создания автомобиля'
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
        usedPartsData: null, // Данные поиска б/у запчастей: {available_parts, analog_parts, rossko_data}
        usedPartsCache: {}, // Кэш результатов поиска б/у запчастей: {query: {data, timestamp}}
    },
    reducers: {
        clearProductError: (state) => {
            state.error = null;
        },
        resetProducts: (state) => {
            state.items = [];
            state.loading = false;
            state.error = null;
        },
        clearSearchCache: (state) => {
            state.searchCache = {};
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
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchMyRejectedProducts.fulfilled, (state, action) => {
                state.loading = false;
                state.rejectedItems = action.payload;
            })
            .addCase(fetchMyRejectedProducts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                state.rejectedItems = [];
            })
            .addCase(fetchMyPendingProducts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchMyPendingProducts.fulfilled, (state, action) => {
                state.loading = false;
                state.pendingItems = action.payload;
            })
            .addCase(fetchMyPendingProducts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                state.pendingItems = [];
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
                if (state.usedPartsData) {
                    // Исключаем из аналогов те запчасти, которые уже есть "в наличии"
                    const availableIds = new Set((state.usedPartsData.available_parts || []).map(p => p.id));
                    state.usedPartsData.analog_parts = (action.payload.analog_parts || []).filter(
                        p => !availableIds.has(p.id)
                    );
                    state.usedPartsData.rossko_data = action.payload.rossko_data;
                    
                    // Обновляем кэш полными данными
                    const query = action.meta.arg;
                    if (query && query.trim()) {
                        state.usedPartsCache[query.trim()] = {
                            data: state.usedPartsData,
                            timestamp: Date.now()
                        };
                    }
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

export const { clearProductError, resetProducts, updateProductQuantity, clearSearchCache } = productSlice.actions;
export { fetchAllProducts };
export const selectMyParts = (state) => state.products.items;
export const selectMyPartsStatus = (state) => state.products.loading ? 'loading' : 'idle';
export const selectMyPartsError = (state) => state.products.error;
export default productSlice.reducer;