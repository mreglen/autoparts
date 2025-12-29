// src/store/slices/CartSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL;

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// Async thunk: добавление новых запчастей в корзину
export const addNewPartsToCart = createAsyncThunk(
    'cart/addNewPartsToCart',
    async (cartItem, { rejectWithValue, dispatch }) => {
        try {
            const response = await axios.post(
                `${API_BASE}/cart/new-parts`,
                cartItem,
                { headers: getAuthHeaders() }
            );
            // Перезагружаем корзину после успешного добавления
            dispatch(fetchCart());
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка добавления товара в корзину'
            );
        }
    }
);

// Async thunk: получение корзины
export const fetchCart = createAsyncThunk(
    'cart/fetchCart',
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios.get(
                `${API_BASE}/cart/`,
                { headers: getAuthHeaders() }
            );
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки корзины'
            );
        }
    }
);

// Async thunk: удаление товара из корзины
export const removeFromCart = createAsyncThunk(
    'cart/removeFromCart',
    async (itemId, { rejectWithValue, dispatch }) => {
        try {
            await axios.delete(
                `${API_BASE}/cart/new-parts/${itemId}`,
                { headers: getAuthHeaders() }
            );
            // Перезагружаем корзину после успешного удаления
            dispatch(fetchCart());
            return itemId;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка удаления товара из корзины'
            );
        }
    }
);

// Async thunk: обновление количества товара
export const updateCartItemQuantity = createAsyncThunk(
    'cart/updateCartItemQuantity',
    async ({ itemId, quantity }, { rejectWithValue, dispatch }) => {
        try {
            const response = await axios.put(
                `${API_BASE}/cart/new-parts/${itemId}/quantity`,
                { quantity },
                {
                    headers: getAuthHeaders()
                }
            );
            // Перезагружаем корзину после успешного обновления
            dispatch(fetchCart());
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка обновления количества товара'
            );
        }
    }
);

const cartSlice = createSlice({
    name: 'cart',
    initialState: {
        cart: null,
        loading: false,
        error: null,
    },
    reducers: {
        clearCartError: (state) => {
            state.error = null;
        },
        clearCart: (state) => {
            state.cart = null;
            state.loading = false;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Добавление в корзину
            .addCase(addNewPartsToCart.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(addNewPartsToCart.fulfilled, (state, action) => {
                state.loading = false;
                // Корзина будет перезагружена в thunk
            })
            .addCase(addNewPartsToCart.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            // Получение корзины
            .addCase(fetchCart.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchCart.fulfilled, (state, action) => {
                state.loading = false;
                state.cart = action.payload;
            })
            .addCase(fetchCart.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            // Удаление из корзины
            .addCase(removeFromCart.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(removeFromCart.fulfilled, (state, action) => {
                state.loading = false;
                // Корзина будет перезагружена в thunk
            })
            .addCase(removeFromCart.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                // При ошибке нужно перезагрузить корзину
            })

            // Обновление количества
            .addCase(updateCartItemQuantity.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateCartItemQuantity.fulfilled, (state, action) => {
                state.loading = false;
                // Корзина будет перезагружена в thunk
            })
            .addCase(updateCartItemQuantity.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                // При ошибке нужно перезагрузить корзину
            });
    },
});

export const {
    clearCartError,
    clearCart
} = cartSlice.actions;

export const selectCart = (state) => state.cart.cart;
export const selectCartLoading = (state) => state.cart.loading;
export const selectCartError = (state) => state.cart.error;

export default cartSlice.reducer;
