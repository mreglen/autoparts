import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

export const fetchRosskoCheckoutDetails = createAsyncThunk(
    'rosskoAdmin/fetchCheckoutDetails',
    async (_, { rejectWithValue }) => {
        try {
            return await apiRequest('/admin/rossko/checkout-details');
        } catch (error) {
            return rejectWithValue(error?.message || 'Ошибка загрузки справочников Rossko');
        }
    }
);

export const fetchRosskoSettings = createAsyncThunk(
    'rosskoAdmin/fetchSettings',
    async (_, { rejectWithValue }) => {
        try {
            return await apiRequest('/admin/rossko/settings');
        } catch (error) {
            return rejectWithValue(error?.message || 'Ошибка загрузки настроек Rossko');
        }
    }
);

export const saveRosskoSettings = createAsyncThunk(
    'rosskoAdmin/saveSettings',
    async (payload, { rejectWithValue }) => {
        try {
            return await apiRequest('/admin/rossko/settings', {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
        } catch (error) {
            return rejectWithValue(error?.message || 'Ошибка сохранения настроек Rossko');
        }
    }
);

const rosskoAdminSlice = createSlice({
    name: 'rosskoAdmin',
    initialState: {
        checkoutDetails: null,
        settings: null,
        loadingDetails: false,
        loadingSettings: false,
        saving: false,
        error: null,
        saveError: null,
    },
    reducers: {
        clearRosskoAdminErrors: (state) => {
            state.error = null;
            state.saveError = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchRosskoCheckoutDetails.pending, (state) => {
                state.loadingDetails = true;
                state.error = null;
            })
            .addCase(fetchRosskoCheckoutDetails.fulfilled, (state, action) => {
                state.loadingDetails = false;
                state.checkoutDetails = action.payload;
            })
            .addCase(fetchRosskoCheckoutDetails.rejected, (state, action) => {
                state.loadingDetails = false;
                state.error = action.payload;
            })
            .addCase(fetchRosskoSettings.pending, (state) => {
                state.loadingSettings = true;
            })
            .addCase(fetchRosskoSettings.fulfilled, (state, action) => {
                state.loadingSettings = false;
                state.settings = action.payload;
            })
            .addCase(fetchRosskoSettings.rejected, (state, action) => {
                state.loadingSettings = false;
                state.error = action.payload;
            })
            .addCase(saveRosskoSettings.pending, (state) => {
                state.saving = true;
                state.saveError = null;
            })
            .addCase(saveRosskoSettings.fulfilled, (state, action) => {
                state.saving = false;
                state.settings = action.payload;
            })
            .addCase(saveRosskoSettings.rejected, (state, action) => {
                state.saving = false;
                state.saveError = action.payload;
            });
    },
});

export const { clearRosskoAdminErrors } = rosskoAdminSlice.actions;
export default rosskoAdminSlice.reducer;
