import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

// Fetch all sellers (admin only)
export const fetchSellers = createAsyncThunk(
    'sellers/fetchSellers',
    async (_, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/admin/sellers');
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Не удалось загрузить продавцов');
        }
    }
);

// Fetch public sellers
export const fetchPublicSellers = createAsyncThunk(
    'sellers/fetchPublicSellers',
    async (_, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/admin/public/sellers');
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Не удалось загрузить продавцов');
        }
    }
);

const sellersSlice = createSlice({
    name: 'sellers',
    initialState: {
        sellers: [],
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
            // fetchSellers
            .addCase(fetchSellers.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSellers.fulfilled, (state, action) => {
                state.loading = false;
                state.sellers = action.payload;
            })
            .addCase(fetchSellers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // fetchPublicSellers
            .addCase(fetchPublicSellers.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPublicSellers.fulfilled, (state, action) => {
                state.loading = false;
                state.sellers = action.payload;
            })
            .addCase(fetchPublicSellers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export const { clearError } = sellersSlice.actions;
export default sellersSlice.reducer;