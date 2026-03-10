// src/redux/slices/OrganizationSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest, apiRequestFormData } from '../../utils/apiClient';

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


// Загрузка логотипа организации
export const uploadOrganizationLogo = createAsyncThunk(
    'organization/uploadOrganizationLogo',
    async (file, { rejectWithValue }) => {
        try {
            console.log('Uploading organization logo:', file.name);
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiRequestFormData('/upload/organization-logo', formData);
            console.log('Organization logo upload response:', res);
            return res.url;
        } catch (error) {
            console.error('Organization logo upload error:', error);
            return rejectWithValue(
                error.response?.data?.detail || error.message || 'Ошибка загрузки логотипа'
            );
        }
    }
);


// Обновление организации
export const updateOrganization = createAsyncThunk(
    'organization/updateOrganization',
    async ({ id, ...updateData }, { rejectWithValue }) => {
        try {
            console.log('Updating organization with data:', { id, ...updateData });
            console.log('Specifically checking logo_organization field:', updateData.logo_organization);
            const result = await apiRequest(`/organizations/${id}`, {
                method: 'PUT',
                body: JSON.stringify(updateData),
            });
            console.log('Organization update successful:', result);
            console.log('Updated logo_organization field:', result.logo_organization);
            return result;
        } catch (err) {
            console.error('Organization update error:', err);
            console.error('Error details:', err?.response?.data);
            return rejectWithValue(err?.response?.data?.detail || err?.detail || 'Ошибка обновления организации');
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

// Загрузка складов по organization_id
export const fetchStorageLocations = createAsyncThunk(
    'organization/fetchStorageLocations',
    async (orgId, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/storage-locations/?organization_id=${orgId}`);
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки складов');
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

// Загрузка всех доступных прав (permissions)
export const fetchPermissions = createAsyncThunk(
    'organization/fetchPermissions',
    async (_, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/employees/permissions/all');
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки прав');
        }
    }
);

// Загрузка прав сотрудника
export const fetchEmployeePermissions = createAsyncThunk(
    'organization/fetchEmployeePermissions',
    async (employeeId, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/employees/${employeeId}/permissions`);
            return { employeeId, permissions: result };
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки прав сотрудника');
        }
    }
);

// Сохранение прав сотрудника
export const saveEmployeePermissions = createAsyncThunk(
    'organization/saveEmployeePermissions',
    async ({ employeeId, permissionIds }, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/employees/${employeeId}/permissions`, {
                method: 'PUT',
                body: JSON.stringify({
                    employee_id: employeeId,
                    permission_ids: permissionIds
                }),
            });
            return { employeeId, permissionIds };
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка сохранения прав');
        }
    }
);

// Инициализация прав (для директоров)
export const initPermissions = createAsyncThunk(
    'organization/initPermissions',
    async (_, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/employees/permissions/init', {
                method: 'POST',
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка инициализации прав');
        }
    }
);


const organizationSlice = createSlice({
    name: 'organization',
    initialState: {
        data: null,
        storageLocations: [],
        loading: false, // Loading state for organization data
        loadingLocations: false,
        error: null,
        locationsError: null,
        employees: [],
        loadingEmployees: false,
        employeesError: null,
        // Permissions state
        permissions: [],
        loadingPermissions: false,
        permissionsError: null,
        employeePermissions: {}, // Map: employeeId -> [permissionIds]
        loadingEmployeePermissions: false,
        savingEmployeePermissions: false,
        // Delivery methods state
        allDeliveryMethods: [],
        orgDeliveryMethods: [],
        loadingDeliveryMethods: {
            deliveryMethods: false,
            deliveryMethodAssignments: false,
        },
        deliveryMethodsError: null,
    },
    reducers: {
        clearOrganization: (state) => {
            state.data = null;
            state.storageLocations = [];
            state.error = null;
            state.locationsError = null;
        },
        clearPermissionsError: (state) => {
            state.permissionsError = null;
        },
        clearDeliveryMethodsError: (state) => {
            state.deliveryMethodsError = null;
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
            })
            // Permissions
            .addCase(fetchPermissions.pending, (state) => {
                state.loadingPermissions = true;
                state.permissionsError = null;
            })
            .addCase(fetchPermissions.fulfilled, (state, action) => {
                state.loadingPermissions = false;
                state.permissions = action.payload;
            })
            .addCase(fetchPermissions.rejected, (state, action) => {
                state.loadingPermissions = false;
                state.permissionsError = action.payload;
            })
            .addCase(fetchEmployeePermissions.pending, (state) => {
                state.loadingEmployeePermissions = true;
                state.permissionsError = null;
            })
            .addCase(fetchEmployeePermissions.fulfilled, (state, action) => {
                state.loadingEmployeePermissions = false;
                state.employeePermissions[action.payload.employeeId] = action.payload.permissions;
            })
            .addCase(fetchEmployeePermissions.rejected, (state, action) => {
                state.loadingEmployeePermissions = false;
                state.permissionsError = action.payload;
            })
            .addCase(saveEmployeePermissions.pending, (state) => {
                state.savingEmployeePermissions = true;
                state.permissionsError = null;
            })
            .addCase(saveEmployeePermissions.fulfilled, (state, action) => {
                state.savingEmployeePermissions = false;
                state.employeePermissions[action.payload.employeeId] = action.payload.permissionIds;
            })
            .addCase(saveEmployeePermissions.rejected, (state, action) => {
                state.savingEmployeePermissions = false;
                state.permissionsError = action.payload;
            })
            .addCase(initPermissions.fulfilled, (state, action) => {
                // Refresh permissions after init
                state.permissions = action.payload.created || state.permissions;
            })
            // Delivery methods
            .addCase(fetchAllDeliveryMethods.pending, (state) => {
                state.loadingDeliveryMethods.deliveryMethods = true;
                state.deliveryMethodsError = null;
            })
            .addCase(fetchAllDeliveryMethods.fulfilled, (state, action) => {
                state.loadingDeliveryMethods.deliveryMethods = false;
                state.allDeliveryMethods = Array.isArray(action.payload) ? action.payload : [];
            })
            .addCase(fetchAllDeliveryMethods.rejected, (state, action) => {
                state.loadingDeliveryMethods.deliveryMethods = false;
                state.deliveryMethodsError = action.payload;
            })
            .addCase(fetchOrgDeliveryMethods.pending, (state) => {
                state.loadingDeliveryMethods.deliveryMethods = true;
                state.deliveryMethodsError = null;
            })
            .addCase(fetchOrgDeliveryMethods.fulfilled, (state, action) => {
                state.loadingDeliveryMethods.deliveryMethods = false;
                state.orgDeliveryMethods = Array.isArray(action.payload) ? action.payload : [];
            })
            .addCase(fetchOrgDeliveryMethods.rejected, (state, action) => {
                state.loadingDeliveryMethods.deliveryMethods = false;
                state.deliveryMethodsError = action.payload;
            })
            .addCase(assignDeliveryMethod.pending, (state) => {
                state.loadingDeliveryMethods.deliveryMethodAssignments = true;
                state.deliveryMethodsError = null;
            })
            .addCase(assignDeliveryMethod.fulfilled, (state, action) => {
                state.loadingDeliveryMethods.deliveryMethodAssignments = false;
                // Add the assigned method to orgDeliveryMethods if not already present
                const method = state.allDeliveryMethods.find(m => m.id === action.meta.arg.methodId);
                if (method && !state.orgDeliveryMethods.some(m => m.id === method.id)) {
                    state.orgDeliveryMethods.push(method);
                }
            })
            .addCase(assignDeliveryMethod.rejected, (state, action) => {
                state.loadingDeliveryMethods.deliveryMethodAssignments = false;
                state.deliveryMethodsError = action.payload;
            })
            .addCase(removeDeliveryMethod.pending, (state) => {
                state.loadingDeliveryMethods.deliveryMethodAssignments = true;
                state.deliveryMethodsError = null;
            })
            .addCase(removeDeliveryMethod.fulfilled, (state, action) => {
                state.loadingDeliveryMethods.deliveryMethodAssignments = false;
                // Remove the method from orgDeliveryMethods
                state.orgDeliveryMethods = state.orgDeliveryMethods.filter(
                    m => m.id !== action.payload.methodId
                );
            })
            .addCase(removeDeliveryMethod.rejected, (state, action) => {
                state.loadingDeliveryMethods.deliveryMethodAssignments = false;
                state.deliveryMethodsError = action.payload;
            });
    },
});

// Async thunks for delivery methods
export const fetchAllDeliveryMethods = createAsyncThunk(
    'organization/fetchAllDeliveryMethods',
    async (_, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/delivery-methods/');
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки способов доставки');
        }
    }
);

export const fetchOrgDeliveryMethods = createAsyncThunk(
    'organization/fetchOrgDeliveryMethods',
    async (orgId, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/delivery-methods/by-organization/${orgId}`);
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки способов доставки организации');
        }
    }
);

export const assignDeliveryMethod = createAsyncThunk(
    'organization/assignDeliveryMethod',
    async ({ orgId, methodId }, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/delivery-methods/assign-to-org?organization_id=${orgId}&delivery_method_id=${methodId}`, {
                method: 'POST',
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка добавления способа доставки');
        }
    }
);

export const removeDeliveryMethod = createAsyncThunk(
    'organization/removeDeliveryMethod',
    async ({ orgId, methodId }, { rejectWithValue }) => {
        try {
            await apiRequest(`/delivery-methods/remove-from-org/${orgId}/${methodId}`, {
                method: 'DELETE',
            });
            return { orgId, methodId };
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка удаления способа доставки');
        }
    }
);

export const { clearOrganization, clearPermissionsError, clearDeliveryMethodsError } = organizationSlice.actions;
export default organizationSlice.reducer;