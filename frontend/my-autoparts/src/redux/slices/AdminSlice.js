import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

export const fetchAllUsers = createAsyncThunk(
    'admin/fetchAllUsers',
    async (_, { rejectWithValue }) => {
        try {
            return await apiRequest('/admin/users');
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить пользователей');
        }
    }
);

export const fetchAdminUsers = fetchAllUsers;

export const fetchAdminUserDetail = createAsyncThunk(
    'admin/fetchAdminUserDetail',
    async (userId, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/users/${userId}`);
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить пользователя');
        }
    }
);

export const fetchAdminUserAudit = createAsyncThunk(
    'admin/fetchAdminUserAudit',
    async ({ userId, page = 1, limit = 30 }, { rejectWithValue }) => {
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            return await apiRequest(`/admin/users/${userId}/audit?${params}`);
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить журнал');
        }
    }
);

export const revokeUserSessions = createAsyncThunk(
    'admin/revokeUserSessions',
    async (userId, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/users/${userId}/revoke-sessions`, { method: 'POST' });
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось завершить сессии');
        }
    }
);

export const patchAdminUserMarkup = createAsyncThunk(
    'admin/patchAdminUserMarkup',
    async ({ userId, tier }, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/users/${userId}/markup`, {
                method: 'PATCH',
                body: JSON.stringify({ tier }),
            });
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось сохранить наценку');
        }
    }
);

export const fetchAllEvents = createAsyncThunk(
    'admin/fetchAllEvents',
    async (_, { rejectWithValue }) => {
        try {
            return await apiRequest('/admin/events');
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить журнал событий');
        }
    }
);

export const fetchAllOrganizations = createAsyncThunk(
    'admin/fetchAllOrganizations',
    async (_, { rejectWithValue }) => {
        try {
            return await apiRequest('/admin/organizations');
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить организации');
        }
    }
);

export const updateOrganizationAdmin = createAsyncThunk(
    'admin/updateOrganization',
    async ({ id, ...updateData }, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/organizations/${id}`, {
                method: 'PUT',
                body: JSON.stringify(updateData),
            });
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось обновить организацию');
        }
    }
);

const adminSlice = createSlice({
    name: 'admin',
    initialState: {
        users: [],
        events: [],
        organizations: [],
        userDetail: null,
        userAudit: null,
        loading: false,
        auditLoading: false,
        error: null,
    },
    reducers: {
        clearUserDetail: (state) => {
            state.userDetail = null;
            state.userAudit = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAllUsers.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAllUsers.fulfilled, (state, action) => {
                state.loading = false;
                state.users = action.payload;
            })
            .addCase(fetchAllUsers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(fetchAdminUserDetail.pending, (state) => {
                state.error = null;
            })
            .addCase(fetchAdminUserDetail.fulfilled, (state, action) => {
                state.userDetail = action.payload;
            })
            .addCase(fetchAdminUserDetail.rejected, (state, action) => {
                state.error = action.payload;
            })
            .addCase(fetchAdminUserAudit.pending, (state) => {
                state.auditLoading = true;
            })
            .addCase(fetchAdminUserAudit.fulfilled, (state, action) => {
                state.auditLoading = false;
                state.userAudit = action.payload;
            })
            .addCase(fetchAdminUserAudit.rejected, (state, action) => {
                state.auditLoading = false;
                state.error = action.payload;
            })
            .addCase(fetchAllEvents.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAllEvents.fulfilled, (state, action) => {
                state.loading = false;
                state.events = action.payload;
            })
            .addCase(fetchAllEvents.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(fetchAllOrganizations.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAllOrganizations.fulfilled, (state, action) => {
                state.loading = false;
                state.organizations = action.payload;
            })
            .addCase(fetchAllOrganizations.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(updateOrganizationAdmin.fulfilled, (state, action) => {
                const index = state.organizations.findIndex((org) => org.id === action.payload.id);
                if (index !== -1) {
                    state.organizations[index] = action.payload;
                }
            })
            .addCase(patchAdminUserMarkup.fulfilled, (state, action) => {
                if (state.userDetail) {
                    state.userDetail = {
                        ...state.userDetail,
                        markup: action.payload,
                    };
                }
            });
    },
});

export const { clearUserDetail } = adminSlice.actions;
export default adminSlice.reducer;
