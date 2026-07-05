// src/store/slices/CartSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiAxios } from '../../utils/apiClient';
import {
    getOutageMessage,
    getRetryDelayMs,
    isApiOutage,
    isRetryableStatus,
    registerApiFailure,
    registerApiSuccess,
} from '../../utils/apiOutageGuard';
import {
    computeCartSummary,
    loadCartSummaryCache,
    saveCartSummaryCache,
    clearCartSummaryCache,
} from '../../utils/cartSummary';

function patchCartItemInState(state, payload, listKey) {
    if (!state.cart?.[listKey]) return;
    const index = state.cart[listKey].findIndex((item) => item.id === payload.id);
    if (index === -1) return;
    state.cart[listKey][index] = {
        ...state.cart[listKey][index],
        quantity: payload.quantity,
        ...(payload.max_quantity != null ? { max_quantity: payload.max_quantity } : {}),
    };
}

function setCartItemQuantityById(state, itemId, quantity, listKey) {
    if (!state.cart?.[listKey]) return;
    const index = state.cart[listKey].findIndex((item) => item.id === itemId);
    if (index === -1) return;
    state.cart[listKey][index].quantity = quantity;
}

function removeQuantityUpdatingId(state, itemId) {
    state.quantityUpdatingIds = state.quantityUpdatingIds.filter((id) => id !== itemId);
}

function syncSummaryFromCart(state) {
    const summary = computeCartSummary(state.cart);
    state.summary = summary;
    saveCartSummaryCache(summary);
}

export const addNewPartsToCart = createAsyncThunk(
    'cart/addNewPartsToCart',
    async (cartItem, { rejectWithValue, dispatch }) => {
        try {
            const response = await apiAxios.post('/cart/new-parts', cartItem);
            dispatch(fetchCart());
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка добавления товара в корзину'
            );
        }
    }
);

export const fetchNewPartsCheckoutConfig = createAsyncThunk(
    'cart/fetchNewPartsCheckoutConfig',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get('/orders/new-parts/config');
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки настроек оформления'
            );
        }
    }
);

export const createNewPartsOrder = createAsyncThunk(
    'cart/createNewPartsOrder',
    async (payload = {}, { rejectWithValue, dispatch }) => {
        try {
            const response = await apiAxios.post('/orders/new-parts', payload);
            dispatch(fetchCart());
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка оформления заказа'
            );
        }
    }
);

export const createNewPartsPaymentSession = createAsyncThunk(
    'cart/createNewPartsPaymentSession',
    async (payload = {}, { rejectWithValue }) => {
        try {
            const response = await apiAxios.post('/payments/new-parts/sessions', payload);
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка создания сессии оплаты'
            );
        }
    }
);

export const fetchPaymentSession = createAsyncThunk(
    'cart/fetchPaymentSession',
    async (sessionId, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get(`/payments/new-parts/sessions/${sessionId}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка загрузки статуса оплаты'
            );
        }
    }
);

export const createCardPayment = createAsyncThunk(
    'cart/createCardPayment',
    async (sessionId, { rejectWithValue }) => {
        try {
            const response = await apiAxios.post(
                `/payments/new-parts/sessions/${sessionId}/card`
            );
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка оплаты картой'
            );
        }
    }
);

export const fetchCart = createAsyncThunk(
    'cart/fetchCart',
    async (_, { rejectWithValue }) => {
        if (isApiOutage()) {
            return rejectWithValue(getOutageMessage());
        }

        let lastError = null;

        for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
                const response = await apiAxios.get('/cart/');
                registerApiSuccess();
                return response.data;
            } catch (error) {
                lastError = error;
                const status = error.response?.status;
                if (!isRetryableStatus(status) || attempt === 2) {
                    break;
                }
                registerApiFailure(status);
                await new Promise((resolve) => {
                    setTimeout(resolve, getRetryDelayMs(attempt - 1));
                });
            }
        }

        return rejectWithValue(
            lastError?.response?.data?.detail || getOutageMessage(),
        );
    }
);

export const removeFromCart = createAsyncThunk(
    'cart/removeFromCart',
    async (itemId, { rejectWithValue, dispatch }) => {
        try {
            await apiAxios.delete(`/cart/new-parts/${itemId}`);
            dispatch(fetchCart());
            return itemId;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка удаления товара из корзины'
            );
        }
    }
);

export const updateCartItemQuantity = createAsyncThunk(
    'cart/updateCartItemQuantity',
    async ({ itemId, quantity }, { rejectWithValue }) => {
        try {
            const response = await apiAxios.put(`/cart/new-parts/${itemId}/quantity`, { quantity });
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка обновления количества товара'
            );
        }
    }
);

export const addUsedPartsToCart = createAsyncThunk(
    'cart/addUsedPartsToCart',
    async (cartItem, { rejectWithValue, dispatch }) => {
        try {
            const response = await apiAxios.post('/cart/used-parts', cartItem);
            dispatch(fetchCart());
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка добавления товара в корзину'
            );
        }
    }
);

export const removeUsedFromCart = createAsyncThunk(
    'cart/removeUsedFromCart',
    async (itemId, { rejectWithValue, dispatch }) => {
        try {
            await apiAxios.delete(`/cart/used-parts/${itemId}`);
            dispatch(fetchCart());
            return itemId;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.detail || 'Ошибка удаления товара из корзины'
            );
        }
    }
);

export const updateUsedCartItemQuantity = createAsyncThunk(
    'cart/updateUsedCartItemQuantity',
    async ({ itemId, quantity }, { rejectWithValue }) => {
        try {
            const response = await apiAxios.put(`/cart/used-parts/${itemId}/quantity`, { quantity });
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
        summary: loadCartSummaryCache(),
        loading: false,
        quantityUpdatingIds: [],
        error: null,
        paymentSession: null,
        paymentSessionLoading: false,
        paymentSessionError: null,
    },
    reducers: {
        clearCartError: (state) => {
            state.error = null;
        },
        clearCart: (state) => {
            state.cart = null;
            state.summary = { itemCount: 0, totalPrice: 0 };
            state.loading = false;
            state.quantityUpdatingIds = [];
            state.error = null;
            clearCartSummaryCache();
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(addNewPartsToCart.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(addNewPartsToCart.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(addNewPartsToCart.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(fetchCart.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchCart.fulfilled, (state, action) => {
                state.loading = false;
                state.cart = action.payload;
                syncSummaryFromCart(state);
            })
            .addCase(fetchCart.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(removeFromCart.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(removeFromCart.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(removeFromCart.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(updateCartItemQuantity.pending, (state, action) => {
                const { itemId, quantity } = action.meta.arg;
                if (!state.quantityUpdatingIds.includes(itemId)) {
                    state.quantityUpdatingIds.push(itemId);
                }
                setCartItemQuantityById(state, itemId, quantity, 'new_parts_items');
                syncSummaryFromCart(state);
                state.error = null;
            })
            .addCase(updateCartItemQuantity.fulfilled, (state, action) => {
                removeQuantityUpdatingId(state, action.payload.id);
                patchCartItemInState(state, action.payload, 'new_parts_items');
                syncSummaryFromCart(state);
            })
            .addCase(updateCartItemQuantity.rejected, (state, action) => {
                removeQuantityUpdatingId(state, action.meta.arg.itemId);
                state.error = action.payload;
            })
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
            .addCase(updateUsedCartItemQuantity.pending, (state, action) => {
                const { itemId, quantity } = action.meta.arg;
                if (!state.quantityUpdatingIds.includes(itemId)) {
                    state.quantityUpdatingIds.push(itemId);
                }
                setCartItemQuantityById(state, itemId, quantity, 'used_parts_items');
                syncSummaryFromCart(state);
                state.error = null;
            })
            .addCase(updateUsedCartItemQuantity.fulfilled, (state, action) => {
                removeQuantityUpdatingId(state, action.payload.id);
                patchCartItemInState(state, action.payload, 'used_parts_items');
                syncSummaryFromCart(state);
            })
            .addCase(updateUsedCartItemQuantity.rejected, (state, action) => {
                removeQuantityUpdatingId(state, action.meta.arg.itemId);
                state.error = action.payload;
            })
            .addCase(createNewPartsPaymentSession.pending, (state) => {
                state.paymentSessionLoading = true;
                state.paymentSessionError = null;
            })
            .addCase(createNewPartsPaymentSession.fulfilled, (state, action) => {
                state.paymentSessionLoading = false;
                state.paymentSession = action.payload;
            })
            .addCase(createNewPartsPaymentSession.rejected, (state, action) => {
                state.paymentSessionLoading = false;
                state.paymentSessionError = action.payload;
            })
            .addCase(fetchPaymentSession.pending, (state) => {
                state.paymentSessionLoading = true;
            })
            .addCase(fetchPaymentSession.fulfilled, (state, action) => {
                state.paymentSessionLoading = false;
                state.paymentSession = action.payload;
                state.paymentSessionError = null;
            })
            .addCase(fetchPaymentSession.rejected, (state, action) => {
                state.paymentSessionLoading = false;
                state.paymentSessionError = action.payload;
            });
    },
});

export const { clearCartError, clearCart } = cartSlice.actions;

export const selectCart = (state) => state.cart.cart;
export const selectCartLoading = (state) => state.cart.loading;
export const selectCartQuantityUpdatingIds = (state) => state.cart.quantityUpdatingIds;
export const selectCartError = (state) => state.cart.error;
export const selectPaymentSession = (state) => state.cart.paymentSession;
export const selectPaymentSessionLoading = (state) => state.cart.paymentSessionLoading;
export const selectPaymentSessionError = (state) => state.cart.paymentSessionError;

/** Счётчик и сумма для шапки: из корзины или из кэша, пока идёт загрузка. */
export const selectCartSummary = (state) => {
    if (state.cart.cart) {
        return computeCartSummary(state.cart.cart);
    }
    return state.cart.summary || { itemCount: 0, totalPrice: 0 };
};

export default cartSlice.reducer;
