// src/redux/slices/PublicInfoSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

// Fetch admin organization phone number
export const fetchAdminOrganizationPhone = createAsyncThunk(
    'publicInfo/fetchAdminOrganizationPhone',
    async (_, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/auth/admin-organization-phone');
            return result;
        } catch (err) {
            // Don't reject on 404 - it's expected for sites without admin org
            if (err?.status === 404) {
                return null;
            }
            return rejectWithValue(err?.detail || 'Ошибка загрузки информации');
        }
    }
);

const publicInfoSlice = createSlice({
    name: 'publicInfo',
    initialState: {
        adminOrganizationPhone: null,
        loading: false,
        error: null,
    },
    reducers: {
        clearPublicInfo: (state) => {
            state.adminOrganizationPhone = null;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAdminOrganizationPhone.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAdminOrganizationPhone.fulfilled, (state, action) => {
                state.loading = false;
                state.adminOrganizationPhone = action.payload;
            })
            .addCase(fetchAdminOrganizationPhone.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                state.adminOrganizationPhone = null;
            });
    },
});

export const { clearPublicInfo } = publicInfoSlice.actions;
export default publicInfoSlice.reducer;