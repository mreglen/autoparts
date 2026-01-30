// src/redux/slices/OrganizationSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

// Загрузка организации
export const fetchOrganization = createAsyncThunk(
    'organization/fetchOrganization',
    async (orgId, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/organizations/${orgId}`);
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки организации');
        }
    }
);

// Обновление организации
export const updateOrganization = createAsyncThunk(
    'organization/updateOrganization',
    async ({ id, ...updateData }, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/organizations/${id}`, {
                method: 'PUT',
                body: JSON.stringify(updateData),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка обновления организации');
        }
    }
);

// Загрузка складов по organization_id
export const fetchStorageLocations = createAsyncThunk(
    'organization/fetchStorageLocations',
    async (orgId, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/api/storage-locations?organization_id=${orgId}`);
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки складов');
        }
    }
);

// Создание склада
export const createStorageLocation = createAsyncThunk(
    'organization/createStorageLocation',
    async (newLoc, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/storage-locations/`, {
                method: 'POST',
                body: JSON.stringify(newLoc),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка создания склада');
        }
    }
);

// Обновление склада
export const updateStorageLocation = createAsyncThunk(
    'organization/updateStorageLocation',
    async ({ id, ...updateData }, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/storage-locations/${id}`, {
                method: 'PUT',
                body: JSON.stringify(updateData),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка обновления склада');
        }
    }
);

// Удаление склада
export const deleteStorageLocation = createAsyncThunk(
    'organization/deleteStorageLocation',
    async (id, { rejectWithValue }) => {
        try {
            await apiRequest(`/storage-locations/${id}`, {
                method: 'DELETE',
            });
            return id;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка удаления склада');
        }
    }
);

// Получить сотрудников
export const fetchEmployees = createAsyncThunk(
    'organization/fetchEmployees',
    async (orgId, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/organizations/${orgId}/employees`);
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки сотрудников');
        }
    }
);

// Добавить сотрудника
export const addEmployee = createAsyncThunk(
    'organization/addEmployee',
    async ({ orgId, employeeData }, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/organizations/${orgId}/employees`, {
                method: 'POST',
                body: JSON.stringify(employeeData),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка добавления сотрудника');
        }
    }
);

export const deleteEmployee = createAsyncThunk(
    'organization/deleteEmployee',
    async ({ orgId, userId }, { rejectWithValue }) => {
        try {
            await apiRequest(`/organizations/${orgId}/employees/${userId}`, {
                method: 'DELETE',
            });
            return userId;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка удаления сотрудника');
        }
    }
);

// Обновление сотрудника
export const updateEmployee = createAsyncThunk(
    'organization/updateEmployee',
    async ({ orgId, userId, updateData }, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/organizations/${orgId}/employees/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка обновления сотрудника');
        }
    }
);


const organizationSlice = createSlice({
    name: 'organization',
    initialState: {
        data: null,
        storageLocations: [],
        loading: false,
        loadingLocations: false,
        error: null,
        locationsError: null,
        employees: [],
        loadingEmployees: false,
        employeesError: null,
    },
    reducers: {
        clearOrganization: (state) => {
            state.data = null;
            state.storageLocations = [];
            state.error = null;
            state.locationsError = null;
        },
    },
    extraReducers: (builder) => {
        // Организация
        builder
            .addCase(updateEmployee.fulfilled, (state, action) => {
                const index = state.employees.findIndex(emp => emp.id === action.payload.id);
                if (index !== -1) {
                    state.employees[index] = action.payload;
                }
            })
            .addCase(deleteEmployee.fulfilled, (state, action) => {
                state.employees = state.employees.filter(emp => emp.id !== action.payload);
            })
            .addCase(deleteEmployee.rejected, (state, action) => {
                state.employeesError = action.payload;
            })
            .addCase(fetchEmployees.pending, (state) => {
                state.loadingEmployees = true;
                state.employeesError = null;
            })
            .addCase(fetchEmployees.fulfilled, (state, action) => {
                state.loadingEmployees = false;
                state.employees = action.payload;
            })
            .addCase(fetchEmployees.rejected, (state, action) => {
                state.loadingEmployees = false;
                state.employeesError = action.payload;
            })
            .addCase(addEmployee.fulfilled, (state, action) => {
                state.employees.push(action.payload);
                state.loadingEmployees = false;
                state.employeesError = null;
            })
            .addCase(addEmployee.rejected, (state, action) => {
                state.loadingEmployees = false;
                state.employeesError = action.payload;
            })
            .addCase(createStorageLocation.fulfilled, (state, action) => {
                state.storageLocations.push(action.payload);
            })
            .addCase(updateStorageLocation.fulfilled, (state, action) => {
                const index = state.storageLocations.findIndex(loc => loc.id === action.payload.id);
                if (index !== -1) state.storageLocations[index] = action.payload;
            })
            .addCase(deleteStorageLocation.fulfilled, (state, action) => {
                state.storageLocations = state.storageLocations.filter(loc => loc.id !== action.payload);
            })
            .addCase(fetchOrganization.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchOrganization.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload;
            })
            .addCase(fetchOrganization.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(updateOrganization.fulfilled, (state, action) => {
                state.data = action.payload;
            })
            // Склады
            .addCase(fetchStorageLocations.pending, (state) => {
                state.loadingLocations = true;
                state.locationsError = null;
            })
            .addCase(fetchStorageLocations.fulfilled, (state, action) => {
                state.loadingLocations = false;
                state.storageLocations = Array.isArray(action.payload) ? action.payload : [];
            })
            .addCase(fetchStorageLocations.rejected, (state, action) => {
                state.loadingLocations = false;
                state.locationsError = action.payload;
            });
    },
});

export const { clearOrganization } = organizationSlice.actions;
export default organizationSlice.reducer;