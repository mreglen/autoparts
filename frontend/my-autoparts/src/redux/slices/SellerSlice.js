import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

export const fetchSellers = createAsyncThunk(
    'sellers/fetchSellers',
    async (_, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/admin/sellers');
            return result;
        } catch (err) {
            return rejectWithValue(err?.message || err?.detail || 'Не удалось загрузить продавцов');
        }
    }
);

export const fetchPublicSellers = createAsyncThunk(
    'sellers/fetchPublicSellers',
    async (_, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/admin/public/sellers');
            return result;
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить продавцов');
        }
    }
);

export const fetchSellerWorkspace = createAsyncThunk(
    'sellers/fetchSellerWorkspace',
    async (sellerId, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/sellers/${sellerId}`);
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить рабочий стол продавца');
        }
    }
);

export const fetchSellerProducts = createAsyncThunk(
    'sellers/fetchSellerProducts',
    async ({ sellerId, storageLocationId }, { rejectWithValue }) => {
        try {
            const query = storageLocationId ? `?storage_location_id=${storageLocationId}` : '';
            return await apiRequest(`/admin/sellers/${sellerId}/products${query}`);
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить запчасти');
        }
    }
);

export const fetchSellerProduct = createAsyncThunk(
    'sellers/fetchSellerProduct',
    async ({ sellerId, productId }, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/sellers/${sellerId}/products/${productId}`);
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить запчасть');
        }
    }
);

export const fetchSellerClients = createAsyncThunk(
    'sellers/fetchSellerClients',
    async (sellerId, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/sellers/${sellerId}/clients`);
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить клиентов');
        }
    }
);

export const fetchSellerVehicles = createAsyncThunk(
    'sellers/fetchSellerVehicles',
    async (sellerId, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/sellers/${sellerId}/vehicles`);
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить автомобили');
        }
    }
);

export const fetchSellerStorageLocations = createAsyncThunk(
    'sellers/fetchSellerStorageLocations',
    async (sellerId, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/sellers/${sellerId}/storage-locations`);
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить склады');
        }
    }
);

export const fetchSellerStockIns = createAsyncThunk(
    'sellers/fetchSellerStockIns',
    async (sellerId, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/sellers/${sellerId}/stock-ins`);
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить поступления');
        }
    }
);

export const fetchSellerStockOuts = createAsyncThunk(
    'sellers/fetchSellerStockOuts',
    async (sellerId, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/sellers/${sellerId}/stock-outs`);
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить расходы');
        }
    }
);

export const fetchSellerWarehouseSales = createAsyncThunk(
    'sellers/fetchSellerWarehouseSales',
    async (sellerId, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/sellers/${sellerId}/warehouse-sales`);
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить продажи');
        }
    }
);

export const fetchSellerEmployees = createAsyncThunk(
    'sellers/fetchSellerEmployees',
    async (sellerId, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/sellers/${sellerId}/employees`);
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось загрузить сотрудников');
        }
    }
);

export const updateSellerMarkup = createAsyncThunk(
    'sellers/updateSellerMarkup',
    async ({ sellerId, new_parts_markup_percent }, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/sellers/${sellerId}/markup`, {
                method: 'PATCH',
                body: JSON.stringify({ new_parts_markup_percent }),
            });
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось сохранить наценку');
        }
    }
);

export const resetSellerMarkup = createAsyncThunk(
    'sellers/resetSellerMarkup',
    async (sellerId, { rejectWithValue }) => {
        try {
            return await apiRequest(`/admin/sellers/${sellerId}/markup/reset`, { method: 'POST' });
        } catch (err) {
            return rejectWithValue(err?.message || 'Не удалось сбросить наценку');
        }
    }
);

const sellersSlice = createSlice({
    name: 'sellers',
    initialState: {
        sellers: [],
        loading: false,
        error: null,
        workspace: null,
        workspaceLoading: false,
        workspaceError: null,
        products: [],
        productsLoading: false,
        clients: [],
        clientsLoading: false,
        vehicles: [],
        vehiclesLoading: false,
        storageLocations: [],
        stockIns: [],
        stockInsLoading: false,
        stockOuts: [],
        stockOutsLoading: false,
        warehouseSales: [],
        warehouseSalesLoading: false,
        employees: [],
        employeesLoading: false,
        markupSaving: false,
    },
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        clearWorkspace: (state) => {
            state.workspace = null;
            state.workspaceError = null;
            state.products = [];
            state.clients = [];
            state.vehicles = [];
            state.storageLocations = [];
            state.stockIns = [];
            state.stockOuts = [];
            state.warehouseSales = [];
            state.employees = [];
        },
        applyWorkspaceMarkup: (state, action) => {
            if (state.workspace) {
                state.workspace.new_parts_markup_percent = action.payload.new_parts_markup_percent;
                state.workspace.new_parts_markup_manual = action.payload.new_parts_markup_manual;
                state.workspace.global_new_parts_markup_percent = action.payload.global_new_parts_markup_percent;
            }
        },
    },
    extraReducers: (builder) => {
        builder
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
            })
            .addCase(fetchSellerWorkspace.pending, (state) => {
                state.workspaceLoading = true;
                state.workspaceError = null;
            })
            .addCase(fetchSellerWorkspace.fulfilled, (state, action) => {
                state.workspaceLoading = false;
                state.workspace = action.payload;
            })
            .addCase(fetchSellerWorkspace.rejected, (state, action) => {
                state.workspaceLoading = false;
                state.workspaceError = action.payload;
            })
            .addCase(fetchSellerProducts.pending, (state) => {
                state.productsLoading = true;
            })
            .addCase(fetchSellerProducts.fulfilled, (state, action) => {
                state.productsLoading = false;
                state.products = action.payload;
            })
            .addCase(fetchSellerProducts.rejected, (state) => {
                state.productsLoading = false;
            })
            .addCase(fetchSellerClients.pending, (state) => {
                state.clientsLoading = true;
            })
            .addCase(fetchSellerClients.fulfilled, (state, action) => {
                state.clientsLoading = false;
                state.clients = action.payload;
            })
            .addCase(fetchSellerClients.rejected, (state) => {
                state.clientsLoading = false;
            })
            .addCase(fetchSellerVehicles.pending, (state) => {
                state.vehiclesLoading = true;
            })
            .addCase(fetchSellerVehicles.fulfilled, (state, action) => {
                state.vehiclesLoading = false;
                state.vehicles = action.payload;
            })
            .addCase(fetchSellerVehicles.rejected, (state) => {
                state.vehiclesLoading = false;
            })
            .addCase(fetchSellerStorageLocations.fulfilled, (state, action) => {
                state.storageLocations = action.payload;
            })
            .addCase(fetchSellerStockIns.pending, (state) => {
                state.stockInsLoading = true;
            })
            .addCase(fetchSellerStockIns.fulfilled, (state, action) => {
                state.stockInsLoading = false;
                state.stockIns = action.payload;
            })
            .addCase(fetchSellerStockIns.rejected, (state) => {
                state.stockInsLoading = false;
            })
            .addCase(fetchSellerStockOuts.pending, (state) => {
                state.stockOutsLoading = true;
            })
            .addCase(fetchSellerStockOuts.fulfilled, (state, action) => {
                state.stockOutsLoading = false;
                state.stockOuts = action.payload;
            })
            .addCase(fetchSellerStockOuts.rejected, (state) => {
                state.stockOutsLoading = false;
            })
            .addCase(fetchSellerWarehouseSales.pending, (state) => {
                state.warehouseSalesLoading = true;
            })
            .addCase(fetchSellerWarehouseSales.fulfilled, (state, action) => {
                state.warehouseSalesLoading = false;
                state.warehouseSales = action.payload;
            })
            .addCase(fetchSellerWarehouseSales.rejected, (state) => {
                state.warehouseSalesLoading = false;
            })
            .addCase(fetchSellerEmployees.pending, (state) => {
                state.employeesLoading = true;
            })
            .addCase(fetchSellerEmployees.fulfilled, (state, action) => {
                state.employeesLoading = false;
                state.employees = action.payload;
            })
            .addCase(fetchSellerEmployees.rejected, (state) => {
                state.employeesLoading = false;
            })
            .addCase(updateSellerMarkup.pending, (state) => {
                state.markupSaving = true;
            })
            .addCase(updateSellerMarkup.fulfilled, (state, action) => {
                state.markupSaving = false;
                if (state.workspace) {
                    state.workspace.new_parts_markup_percent = action.payload.new_parts_markup_percent;
                    state.workspace.new_parts_markup_manual = action.payload.new_parts_markup_manual;
                    state.workspace.global_new_parts_markup_percent = action.payload.global_new_parts_markup_percent;
                }
            })
            .addCase(updateSellerMarkup.rejected, (state) => {
                state.markupSaving = false;
            })
            .addCase(resetSellerMarkup.pending, (state) => {
                state.markupSaving = true;
            })
            .addCase(resetSellerMarkup.fulfilled, (state, action) => {
                state.markupSaving = false;
                if (state.workspace) {
                    state.workspace.new_parts_markup_percent = action.payload.new_parts_markup_percent;
                    state.workspace.new_parts_markup_manual = action.payload.new_parts_markup_manual;
                    state.workspace.global_new_parts_markup_percent = action.payload.global_new_parts_markup_percent;
                }
            })
            .addCase(resetSellerMarkup.rejected, (state) => {
                state.markupSaving = false;
            });
    },
});

export const { clearError, clearWorkspace, applyWorkspaceMarkup } = sellersSlice.actions;
export default sellersSlice.reducer;
