// src/store/slices/ModerationProductsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiAxios } from '../../utils/apiClient';

function apiErrorDetail(error) {
    const raw = error?.response?.data?.detail;
    if (raw == null) return null;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) {
        return raw.map((item) => (typeof item?.msg === 'string' ? item.msg : JSON.stringify(item))).join('; ');
    }
    if (typeof raw === 'object' && typeof raw.message === 'string') return raw.message;
    try {
        return JSON.stringify(raw);
    } catch {
        return String(raw);
    }
}

// Получить запчасти в ожидании модерации
export const fetchPendingProducts = createAsyncThunk(
    'moderationProducts/fetchPendingProducts',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get('/moderation/products/pending');
            return response.data;
        } catch (error) {
            return rejectWithValue(apiErrorDetail(error) || 'Ошибка загрузки запчастей');
        }
    }
);

// Одобрить запчасть
export const approveProduct = createAsyncThunk(
    'moderationProducts/approveProduct',
    async (productId, { rejectWithValue }) => {
        try {
            const response = await apiAxios.post(`/moderation/products/${productId}/approve`);
            return response.data;
        } catch (error) {
            return rejectWithValue(apiErrorDetail(error) || 'Ошибка одобрения запчасти');
        }
    }
);

// Отклонить запчасть
export const rejectProduct = createAsyncThunk(
    'moderationProducts/rejectProduct',
    async ({ productId, reason }, { rejectWithValue }) => {
        try {
            const response = await apiAxios.post(`/moderation/products/${productId}/reject`, {
                rejection_reason: reason
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(apiErrorDetail(error) || 'Ошибка отклонения запчасти');
        }
    }
);

// Получить отклоненные запчасти
export const fetchRejectedProducts = createAsyncThunk(
    'moderationProducts/fetchRejectedProducts',
    async (_, { rejectWithValue }) => {
        try {
            const response = await apiAxios.get('/moderation/products/rejected');
            return response.data;
        } catch (error) {
            return rejectWithValue(apiErrorDetail(error) || 'Ошибка загрузки отклоненных запчастей');
        }
    }
);

const moderationProductsSlice = createSlice({
    name: 'moderationProducts',
    initialState: {
        pendingProducts: [],
        rejectedProducts: [],
        loading: false,
        error: null,
    },
    reducers: {
        clearModerationError: (state) => {
            state.error = null;
        },
        resetModeration: (state) => {
            state.pendingProducts = [];
            state.rejectedProducts = [];
            state.loading = false;
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch pending products
            .addCase(fetchPendingProducts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPendingProducts.fulfilled, (state, action) => {
                state.loading = false;
                state.pendingProducts = action.payload;
            })
            .addCase(fetchPendingProducts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Approve product
            .addCase(approveProduct.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(approveProduct.fulfilled, (state, action) => {
                state.loading = false;
                // API возвращает id товара в каталоге, а в списке — id pending_products
                const pendingId = action.meta.arg;
                state.pendingProducts = state.pendingProducts.filter(
                    (product) => product.id !== pendingId
                );
            })
            .addCase(approveProduct.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Reject product
            .addCase(rejectProduct.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(rejectProduct.fulfilled, (state, action) => {
                state.loading = false;
                const pendingId = action.meta.arg.productId;
                state.pendingProducts = state.pendingProducts.filter(
                    (product) => product.id !== pendingId
                );
            })
            .addCase(rejectProduct.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Fetch rejected products
            .addCase(fetchRejectedProducts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchRejectedProducts.fulfilled, (state, action) => {
                state.loading = false;
                state.rejectedProducts = action.payload;
            })
            .addCase(fetchRejectedProducts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export const { clearModerationError, resetModeration } = moderationProductsSlice.actions;
export default moderationProductsSlice.reducer;