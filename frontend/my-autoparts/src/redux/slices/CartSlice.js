// src/store/slices/CartSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiAxios } from '../../utils/apiClient';

// Async thunk: добавление новых запчастей в корзину
export const addNewPartsToCart = createAsyncThunk(
    'cart/addNewPartsToCart',
    async (cartItem, { rejectWithValue, dispatch }) => {
        try {
            const response = await apiAxios.post(
                `/cart/new-parts`,
                cartItem,
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
            const response = await apiAxios.get(
                `/cart/`,
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
            await apiAxios.delete(
                `/cart/new-parts/${itemId}`,
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
            const response = await apiAxios.put(
                `/cart/new-parts/${itemId}/quantity`,
                { quantity }
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

// Async thunk: добавление б/у запчастей в корзину
export const addUsedPartsToCart = createAsyncThunk(
    'cart/addUsedPartsToCart',
    async (cartItem, { rejectWithValue, dispatch }) => {
        try {
            const response = await apiAxios.post(
                `/cart/used-parts`,
                cartItem,
            );
            dispatch(fetchCart());
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка добавления товара в корзину'
            );
        }
    }
);

// Async thunk: удаление б/у запчастей из корзины
export const removeUsedFromCart = createAsyncThunk(
    'cart/removeUsedFromCart',
    async (itemId, { rejectWithValue, dispatch }) => {
        try {
            await apiAxios.delete(
                `/cart/used-parts/${itemId}`,
            );
            dispatch(fetchCart());
            return itemId;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка удаления товара из корзины'
            );
        }
    }
);

// Async thunk: обновление количества б/у запчастей
export const updateUsedCartItemQuantity = createAsyncThunk(
    'cart/updateUsedCartItemQuantity',
    async ({ itemId, quantity }, { rejectWithValue, dispatch }) => {
        try {
            const response = await apiAxios.put(
                `/cart/used-parts/${itemId}/quantity`,
                { quantity }
            );
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

            // Обновление количества (новые)
            .addCase(updateCartItemQuantity.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateCartItemQuantity.fulfilled, (state, action) => {
                state.loading = false;
            })
            .addCase(updateCartItemQuantity.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            // Добавление в корзину (б/у)
            .addCase(addUsedPartsToCart.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(addUsedPartsToCart.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(addUsedPartsToCart.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            // Удаление из корзины (б/у)
            .addCase(removeUsedFromCart.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(removeUsedFromCart.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(removeUsedFromCart.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            // Обновление количества (б/у)
            .addCase(updateUsedCartItemQuantity.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateUsedCartItemQuantity.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(updateUsedCartItemQuantity.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
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
