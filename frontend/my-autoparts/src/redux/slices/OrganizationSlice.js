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
            // Use the path field from the response (relative URL)
            return res.path || res.url;
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
            return rejectWithValue(err?.message || err?.detail || 'Ошибка создания склада');
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
            return rejectWithValue(err?.message || err?.detail || 'Ошибка загрузки складов');
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
            return rejectWithValue(err?.message || err?.detail || 'Ошибка обновления склада');
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
            return rejectWithValue(err?.message || err?.detail || 'Ошибка удаления склада');
        }
    }
);

// Получить карточки сотрудников
export const fetchEmployees = createAsyncThunk(
    'organization/fetchEmployees',
    async (orgId, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/organizations/${orgId}/employee-cards`);
            return result;
        } catch (err) {
            return rejectWithValue(err?.message || err?.detail || 'Ошибка загрузки сотрудников');
        }
    }
);

// Добавить карточку сотрудника
export const addEmployee = createAsyncThunk(
    'organization/addEmployee',
    async ({ orgId, employeeData }, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/organizations/${orgId}/employee-cards`, {
                method: 'POST',
                body: JSON.stringify(employeeData),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.message || err?.detail || 'Ошибка добавления сотрудника');
        }
    }
);

export const deleteEmployee = createAsyncThunk(
    'organization/deleteEmployee',
    async ({ orgId, cardId }, { rejectWithValue }) => {
        try {
            await apiRequest(`/organizations/${orgId}/employee-cards/${cardId}`, {
                method: 'DELETE',
            });
            return cardId;
        } catch (err) {
            return rejectWithValue(err?.message || err?.detail || 'Ошибка удаления сотрудника');
        }
    }
);

// Обновление карточки сотрудника
export const updateEmployee = createAsyncThunk(
    'organization/updateEmployee',
    async ({ orgId, cardId, updateData }, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/organizations/${orgId}/employee-cards/${cardId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.message || err?.detail || 'Ошибка обновления сотрудника');
        }
    }
);

export const createEmployeeAccount = createAsyncThunk(
    'organization/createEmployeeAccount',
    async ({ orgId, cardId }, { rejectWithValue }) => {
        try {
            const result = await apiRequest(
                `/organizations/${orgId}/employee-cards/${cardId}/create-account`,
                { method: 'POST' },
            );
            return { cardId, ...result };
        } catch (err) {
            return rejectWithValue(err?.message || err?.detail || 'Ошибка создания аккаунта');
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

// Загрузка прав карточки сотрудника
export const fetchEmployeePermissions = createAsyncThunk(
    'organization/fetchEmployeePermissions',
    async ({ orgId, cardId }, { rejectWithValue }) => {
        try {
            const result = await apiRequest(
                `/organizations/${orgId}/employee-cards/${cardId}/permissions`,
            );
            return { cardId, permissions: result };
        } catch (err) {
            return rejectWithValue(err?.message || err?.detail || 'Ошибка загрузки прав сотрудника');
        }
    }
);

// Сохранение прав карточки сотрудника
export const saveEmployeePermissions = createAsyncThunk(
    'organization/saveEmployeePermissions',
    async ({ orgId, cardId, permissionIds }, { rejectWithValue }) => {
        try {
            await apiRequest(`/organizations/${orgId}/employee-cards/${cardId}/permissions`, {
                method: 'PUT',
                body: JSON.stringify({ permission_ids: permissionIds }),
            });
            return { cardId, permissionIds };
        } catch (err) {
            return rejectWithValue(err?.message || err?.detail || 'Ошибка сохранения прав');
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
        // Payment methods state
        allPaymentMethods: [],
        orgPaymentMethods: [],
        loadingPaymentMethods: {
            paymentMethods: false,
            paymentMethodAssignments: false,
        },
        paymentMethodsError: null,
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
        clearPaymentMethodsError: (state) => {
            state.paymentMethodsError = null;
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
            .addCase(createEmployeeAccount.fulfilled, (state, action) => {
                const index = state.employees.findIndex((emp) => emp.id === action.payload.cardId);
                if (index !== -1) {
                    state.employees[index] = {
                        ...state.employees[index],
                        user_id: action.payload.user_id,
                        account_status: 'linked',
                    };
                }
            })
            .addCase(createStorageLocation.pending, (state) => {
                state.locationsError = null;
            })
            .addCase(createStorageLocation.fulfilled, (state, action) => {
                const created = action.payload;
                if (created?.id && !state.storageLocations.some((loc) => loc.id === created.id)) {
                    state.storageLocations.push(created);
                }
                state.locationsError = null;
            })
            .addCase(createStorageLocation.rejected, (state, action) => {
                state.locationsError = action.payload;
            })
            .addCase(updateStorageLocation.fulfilled, (state, action) => {
                const index = state.storageLocations.findIndex(loc => loc.id === action.payload.id);
                if (index !== -1) state.storageLocations[index] = action.payload;
                state.locationsError = null;
            })
            .addCase(updateStorageLocation.rejected, (state, action) => {
                state.locationsError = action.payload;
            })
            .addCase(deleteStorageLocation.fulfilled, (state, action) => {
                state.storageLocations = state.storageLocations.filter(loc => loc.id !== action.payload);
                state.locationsError = null;
            })
            .addCase(deleteStorageLocation.rejected, (state, action) => {
                state.locationsError = action.payload;
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
                state.employeePermissions[action.payload.cardId] = action.payload.permissions;
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
                state.employeePermissions[action.payload.cardId] = action.payload.permissionIds;
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
            })
            // Payment methods
            .addCase(fetchAllPaymentMethods.pending, (state) => {
                state.loadingPaymentMethods.paymentMethods = true;
                state.paymentMethodsError = null;
            })
            .addCase(fetchAllPaymentMethods.fulfilled, (state, action) => {
                state.loadingPaymentMethods.paymentMethods = false;
                state.allPaymentMethods = Array.isArray(action.payload) ? action.payload : [];
            })
            .addCase(fetchAllPaymentMethods.rejected, (state, action) => {
                state.loadingPaymentMethods.paymentMethods = false;
                state.paymentMethodsError = action.payload;
            })
            .addCase(fetchOrgPaymentMethods.pending, (state) => {
                state.loadingPaymentMethods.paymentMethods = true;
                state.paymentMethodsError = null;
            })
            .addCase(fetchOrgPaymentMethods.fulfilled, (state, action) => {
                state.loadingPaymentMethods.paymentMethods = false;
                state.orgPaymentMethods = Array.isArray(action.payload) ? action.payload : [];
            })
            .addCase(fetchOrgPaymentMethods.rejected, (state, action) => {
                state.loadingPaymentMethods.paymentMethods = false;
                state.paymentMethodsError = action.payload;
            })
            .addCase(assignPaymentMethod.pending, (state) => {
                state.loadingPaymentMethods.paymentMethodAssignments = true;
                state.paymentMethodsError = null;
            })
            .addCase(assignPaymentMethod.fulfilled, (state, action) => {
                state.loadingPaymentMethods.paymentMethodAssignments = false;
                const method = state.allPaymentMethods.find((m) => m.id === action.meta.arg.methodId);
                if (method && !state.orgPaymentMethods.some((m) => m.id === method.id)) {
                    state.orgPaymentMethods.push(method);
                }
            })
            .addCase(assignPaymentMethod.rejected, (state, action) => {
                state.loadingPaymentMethods.paymentMethodAssignments = false;
                state.paymentMethodsError = action.payload;
            })
            .addCase(removePaymentMethod.pending, (state) => {
                state.loadingPaymentMethods.paymentMethodAssignments = true;
                state.paymentMethodsError = null;
            })
            .addCase(removePaymentMethod.fulfilled, (state, action) => {
                state.loadingPaymentMethods.paymentMethodAssignments = false;
                state.orgPaymentMethods = state.orgPaymentMethods.filter(
                    (m) => m.id !== action.payload.methodId
                );
            })
            .addCase(removePaymentMethod.rejected, (state, action) => {
                state.loadingPaymentMethods.paymentMethodAssignments = false;
                state.paymentMethodsError = action.payload;
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

export const fetchAllPaymentMethods = createAsyncThunk(
    'organization/fetchAllPaymentMethods',
    async (_, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/payment-methods/');
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки способов оплаты');
        }
    }
);

export const fetchOrgPaymentMethods = createAsyncThunk(
    'organization/fetchOrgPaymentMethods',
    async (orgId, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/payment-methods/by-organization/${orgId}`);
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки способов оплаты организации');
        }
    }
);

export const assignPaymentMethod = createAsyncThunk(
    'organization/assignPaymentMethod',
    async ({ orgId, methodId }, { rejectWithValue }) => {
        try {
            const result = await apiRequest(
                `/payment-methods/assign-to-org?organization_id=${orgId}&payment_method_id=${methodId}`,
                { method: 'POST' }
            );
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка добавления способа оплаты');
        }
    }
);

export const removePaymentMethod = createAsyncThunk(
    'organization/removePaymentMethod',
    async ({ orgId, methodId }, { rejectWithValue }) => {
        try {
            await apiRequest(`/payment-methods/remove-from-org/${orgId}/${methodId}`, {
                method: 'DELETE',
            });
            return { orgId, methodId };
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка удаления способа оплаты');
        }
    }
);

export const { clearOrganization, clearPermissionsError, clearDeliveryMethodsError, clearPaymentMethodsError } = organizationSlice.actions;
export default organizationSlice.reducer;