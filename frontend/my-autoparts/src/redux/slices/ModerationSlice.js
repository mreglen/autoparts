import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

// Fetch pending sellers
export const fetchPendingSellers = createAsyncThunk(
    'moderation/fetchPendingSellers',
    async (_, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/admin/pending-sellers');
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Не удалось загрузить заявки');
        }
    }
);

// Approve seller
export const approveSeller = createAsyncThunk(
    'moderation/approveSeller',
    async (sellerId, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/admin/pending-sellers/${sellerId}/approve`, {
                method: 'POST',
            });
            return { sellerId, ...result };
        } catch (err) {
            return rejectWithValue(err?.detail || 'Не удалось одобрить заявку');
        }
    }
);

// Reject seller
export const rejectSeller = createAsyncThunk(
    'moderation/rejectSeller',
    async ({ sellerId, reason }, { rejectWithValue }) => {
        try {
            await apiRequest(`/admin/pending-sellers/${sellerId}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reason }),
            });
            return sellerId;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Не удалось отклонить заявку');
        }
    }
);

const moderationSlice = createSlice({
    name: 'moderation',
    initialState: {
        pendingSellers: [],
        loading: false,
        error: null,
    },
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // fetchPendingSellers
            .addCase(fetchPendingSellers.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPendingSellers.fulfilled, (state, action) => {
                state.loading = false;
                state.pendingSellers = action.payload;
            })
            .addCase(fetchPendingSellers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // approveSeller
            .addCase(approveSeller.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(approveSeller.fulfilled, (state, action) => {
                state.loading = false;
                // Remove approved seller from list
                state.pendingSellers = state.pendingSellers.filter(
                    seller => seller.id !== action.payload.sellerId
                );
            })
            .addCase(approveSeller.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // rejectSeller
            .addCase(rejectSeller.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(rejectSeller.fulfilled, (state, action) => {
                state.loading = false;
                // Remove rejected seller from list
                state.pendingSellers = state.pendingSellers.filter(
                    seller => seller.id !== action.payload
                );
            })
            .addCase(rejectSeller.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export const { clearError } = moderationSlice.actions;
export default moderationSlice.reducer;