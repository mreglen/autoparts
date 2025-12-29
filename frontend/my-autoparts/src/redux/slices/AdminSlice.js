// src/redux/slices/AdminSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const API_BASE = process.env.REACT_APP_API_URL;


const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchAllUsers = createAsyncThunk(
    'admin/fetchAllUsers',
    async (_, { rejectWithValue }) => {
        try {
            const res = await fetch(`${API_BASE}/admin/users`, {
                headers: getAuthHeaders(),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw err;
            }
            return await res.json();
        } catch (err) {
            return rejectWithValue(err?.detail || 'Не удалось загрузить пользователей');
        }
    }
);

export const fetchAllEvents = createAsyncThunk(
    'admin/fetchAllEvents',
    async (_, { rejectWithValue }) => {
        try {
            const res = await fetch(`${API_BASE}/admin/events`, {
                headers: getAuthHeaders(),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw err;
            }
            return await res.json();
        } catch (err) {
            return rejectWithValue(err?.detail || 'Не удалось загрузить журнал событий');
        }
    }
);

// Получение всех организаций
export const fetchAllOrganizations = createAsyncThunk(
    'admin/fetchAllOrganizations',
    async (_, { rejectWithValue }) => {
        try {
            const res = await fetch(`${API_BASE}/admin/organizations`, {
                headers: getAuthHeaders(),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw err;
            }
            return await res.json();
        } catch (err) {
            return rejectWithValue(err?.detail || 'Не удалось загрузить организации');
        }
    }
);

// Обновление организации
export const updateOrganizationAdmin = createAsyncThunk(
    'admin/updateOrganization',
    async ({ id, ...updateData }, { rejectWithValue }) => {
        try {
            const res = await fetch(`${API_BASE}/admin/organizations/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(),
                },
                body: JSON.stringify(updateData),
            });
            if (!res.ok) throw await res.json().catch(() => ({}));
            return await res.json();
        } catch (err) {
            return rejectWithValue(err?.detail || 'Не удалось обновить организацию');
        }
    }
);

const adminSlice = createSlice({
    name: 'admin',
    initialState: {
        users: [],
        events: [],
        organizations: [],
        loading: false,
        error: null,
    },
    reducers: {},
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
                const index = state.organizations.findIndex(org => org.id === action.payload.id);
                if (index !== -1) {
                    state.organizations[index] = action.payload;
                }
            });
    },
});

export default adminSlice.reducer;