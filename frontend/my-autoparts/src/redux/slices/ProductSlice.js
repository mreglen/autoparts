// src/store/slices/ProductSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL;


const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// НОВЫЙ thunk: загрузка фото
export const uploadPhotos = createAsyncThunk(
    'products/uploadPhotos',
    async (files, { rejectWithValue }) => {
        try {
            const uploadPromises = Array.from(files).map(file => {
                const formData = new FormData();
                formData.append('file', file);
                return axios.post(
                    `${API_BASE}/upload/photo`,
                    formData,
                    {
                        headers: {
                            ...getAuthHeaders(),
                            'Content-Type': 'multipart/form-data',
                        },
                    }
                ).then(res => res.data.url);
            });
            const urls = await Promise.all(uploadPromises);
            return urls;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки фото'
            );
        }
    }
);

// Async thunk: создание продукта
export const createProduct = createAsyncThunk(
    'products/createProduct',
    async (productData, { rejectWithValue }) => {
        try {
            const response = await axios.post(
                `${API_BASE}/products/`,
                productData,
                { headers: getAuthHeaders() }
            );
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка создания товара'
            );
        }
    }
);

export const updateProduct = createAsyncThunk(
    'products/updateProduct',
    async ({ id, productData }, { rejectWithValue }) => {
        try {
            const response = await axios.put(
                `${API_BASE}/products/${id}`,
                productData,
                { headers: getAuthHeaders() }
            );
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка обновления товара'
            );
        }
    }
);

export const fetchProducts = createAsyncThunk(
    'products/fetchProducts',
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios.get(
                `${API_BASE}/products/`,
                { headers: getAuthHeaders() }
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
            const response = await axios.get(
                `${API_BASE}/products/${productId}`,
                { headers: getAuthHeaders() }
            );
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки товара'
            );
        }
    }
);

export const fetchVehicles = createAsyncThunk(
    'vehicles/fetchVehicles',
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios.get(
                `${API_BASE}/vehicles/`,
                { headers: getAuthHeaders() }
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
            const response = await axios.post(
                `${API_BASE}/vehicles/`,
                vehicleData,
                { headers: getAuthHeaders() }
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
            const response = await axios.get(`${API_BASE}/search-products/search`, {
                params: { q: '' }, // Пустой запрос для получения всех продуктов
                headers: getAuthHeaders(),
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
    async (query, { rejectWithValue }) => {
        try {
            const [directRes, analogRes] = await Promise.all([
                axios.get(`${API_BASE}/search-products/search`, {
                    params: { q: query },
                    headers: getAuthHeaders(),
                }),
                axios.get(`${API_BASE}/search-products/search-with-analogs`, {
                    params: { q: query },
                }),
            ]);

            const direct = directRes.data || [];
            const analog = analogRes.data || [];

            // Убираем дубликаты по `id`
            const merged = [...direct, ...analog];
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

const productSlice = createSlice({
    name: 'products',
    initialState: {
        items: [],
        vehicles: [],
        currentProduct: null,
        loading: false,
        vehiclesLoading: false,
        error: null,
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
            .addCase(searchAllProducts.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.items = [];
            })
            .addCase(searchAllProducts.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
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
            });
    },
});


export const fetchPublicProducts = createAsyncThunk(
    'products/fetchPublicProducts',
    async (_, { rejectWithValue }) => {
        try {
            // Запрос без авторизации к публичному endpoint поиска
            const response = await axios.get(`${API_BASE}/search-products/search`, {
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

export const { clearProductError, resetProducts, updateProductQuantity } = productSlice.actions;
export { fetchAllProducts };
export const selectMyParts = (state) => state.products.items;
export const selectMyPartsStatus = (state) => state.products.loading ? 'loading' : 'idle';
export const selectMyPartsError = (state) => state.products.error;
export default productSlice.reducer;