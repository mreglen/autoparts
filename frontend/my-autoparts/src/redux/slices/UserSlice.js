// src/redux/slices/UserSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest, apiRequestFormData } from '../../utils/apiClient';

export const updateProfile = createAsyncThunk(
    'user/updateProfile',
    async (userData, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/users/me', {
                method: 'PUT',
                body: JSON.stringify(userData),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось обновить профиль');
        }
    }
);

export const uploadAvatar = createAsyncThunk(
    'user/uploadAvatar',
    async (file, { rejectWithValue }) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            return await apiRequestFormData('/users/me/avatar', formData);
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить фото');
        }
    }
);

export const deleteAvatar = createAsyncThunk(
    'user/deleteAvatar',
    async (_, { rejectWithValue }) => {
        try {
            return await apiRequest('/users/me/avatar', { method: 'DELETE' });
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось удалить фото');
        }
    }
);

const userSlice = createSlice({
    name: 'user',
    initialState: {
        loading: false,
        avatarLoading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(updateProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateProfile.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(updateProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(uploadAvatar.pending, (state) => {
                state.avatarLoading = true;
                state.error = null;
            })
            .addCase(uploadAvatar.fulfilled, (state) => {
                state.avatarLoading = false;
            })
            .addCase(uploadAvatar.rejected, (state, action) => {
                state.avatarLoading = false;
                state.error = action.payload;
            })
            .addCase(deleteAvatar.pending, (state) => {
                state.avatarLoading = true;
                state.error = null;
            })
            .addCase(deleteAvatar.fulfilled, (state) => {
                state.avatarLoading = false;
            })
            .addCase(deleteAvatar.rejected, (state, action) => {
                state.avatarLoading = false;
                state.error = action.payload;
            });
    },
});

export default userSlice.reducer;
