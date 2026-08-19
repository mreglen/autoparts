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

export const fetchRosskoCredentials = createAsyncThunk(
    'rosskoAdmin/fetchCredentials',
    async (_, { rejectWithValue }) => {
        try {
            return await apiRequest('/admin/rossko/credentials');
        } catch (error) {
            return rejectWithValue(error?.message || 'Ошибка загрузки ключей Rossko');
        }
    }
);

export const saveRosskoCredentials = createAsyncThunk(
    'rosskoAdmin/saveCredentials',
    async (payload, { rejectWithValue }) => {
        try {
            return await apiRequest('/admin/rossko/credentials', {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
        } catch (error) {
            return rejectWithValue(error?.message || 'Ошибка сохранения ключей Rossko');
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

export const fetchRosskoMarkupSettings = createAsyncThunk(
    'rosskoAdmin/fetchMarkupSettings',
    async (_, { rejectWithValue }) => {
        try {
            return await apiRequest('/admin/rossko/markup-settings');
        } catch (error) {
            return rejectWithValue(error?.message || 'Ошибка загрузки наценок');
        }
    }
);

export const saveRosskoMarkupSettings = createAsyncThunk(
    'rosskoAdmin/saveMarkupSettings',
    async (payload, { rejectWithValue }) => {
        try {
            return await apiRequest('/admin/rossko/markup-settings', {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
        } catch (error) {
            return rejectWithValue(error?.message || 'Ошибка сохранения наценок');
        }
    }
);

const rosskoAdminSlice = createSlice({
    name: 'rosskoAdmin',
    initialState: {
        checkoutDetails: null,
        credentials: null,
        settings: null,
        markupSettings: null,
        loadingDetails: false,
        loadingCredentials: false,
        loadingSettings: false,
        loadingMarkupSettings: false,
        saving: false,
        savingCredentials: false,
        savingMarkup: false,
        error: null,
        saveError: null,
        credentialsSaveError: null,
        markupSaveError: null,
    },
    reducers: {
        clearRosskoAdminErrors: (state) => {
            state.error = null;
            state.saveError = null;
            state.credentialsSaveError = null;
            state.markupSaveError = null;
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
            .addCase(fetchRosskoCredentials.pending, (state) => {
                state.loadingCredentials = true;
            })
            .addCase(fetchRosskoCredentials.fulfilled, (state, action) => {
                state.loadingCredentials = false;
                state.credentials = action.payload;
            })
            .addCase(fetchRosskoCredentials.rejected, (state, action) => {
                state.loadingCredentials = false;
                state.error = action.payload;
            })
            .addCase(saveRosskoCredentials.pending, (state) => {
                state.savingCredentials = true;
                state.credentialsSaveError = null;
            })
            .addCase(saveRosskoCredentials.fulfilled, (state, action) => {
                state.savingCredentials = false;
                state.credentials = action.payload;
                if (state.settings) {
                    state.settings = {
                        ...state.settings,
                        keys_configured: action.payload.keys_configured,
                    };
                }
            })
            .addCase(saveRosskoCredentials.rejected, (state, action) => {
                state.savingCredentials = false;
                state.credentialsSaveError = action.payload;
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
            })
            .addCase(fetchRosskoMarkupSettings.pending, (state) => {
                state.loadingMarkupSettings = true;
            })
            .addCase(fetchRosskoMarkupSettings.fulfilled, (state, action) => {
                state.loadingMarkupSettings = false;
                state.markupSettings = action.payload;
            })
            .addCase(fetchRosskoMarkupSettings.rejected, (state, action) => {
                state.loadingMarkupSettings = false;
                state.error = action.payload;
            })
            .addCase(saveRosskoMarkupSettings.pending, (state) => {
                state.savingMarkup = true;
                state.markupSaveError = null;
            })
            .addCase(saveRosskoMarkupSettings.fulfilled, (state, action) => {
                state.savingMarkup = false;
                state.markupSettings = action.payload;
            })
            .addCase(saveRosskoMarkupSettings.rejected, (state, action) => {
                state.savingMarkup = false;
                state.markupSaveError = action.payload;
            });
    },
});

export const { clearRosskoAdminErrors } = rosskoAdminSlice.actions;
export default rosskoAdminSlice.reducer;
