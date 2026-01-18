// src/redux/slices/StorageCellsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

// Fetch all storage locations with their cells
export const fetchLocationsWithCells = createAsyncThunk(
    'storageCells/fetchLocationsWithCells',
    async (_, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/storage-cells/locations-with-cells/');
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки складов и ячеек');
        }
    }
);

// Fetch storage cells (optionally filtered by storage location)
export const fetchStorageCells = createAsyncThunk(
    'storageCells/fetchStorageCells',
    async (storageLocationId = null, { rejectWithValue }) => {
        try {
            let url = '/storage-cells/';
            if (storageLocationId) {
                url += `?storage_location_id=${storageLocationId}`;
            }
            const result = await apiRequest(url);
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки ячеек');
        }
    }
);

// Create storage cell
export const createStorageCell = createAsyncThunk(
    'storageCells/createStorageCell',
    async (cellData, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/storage-cells/', {
                method: 'POST',
                body: JSON.stringify(cellData),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка создания ячейки');
        }
    }
);

// Update storage cell
export const updateStorageCell = createAsyncThunk(
    'storageCells/updateStorageCell',
    async ({ id, ...updateData }, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/storage-cells/${id}`, {
                method: 'PUT',
                body: JSON.stringify(updateData),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка обновления ячейки');
        }
    }
);

// Delete storage cell
export const deleteStorageCell = createAsyncThunk(
    'storageCells/deleteStorageCell',
    async (id, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/storage-cells/${id}`, {
                method: 'DELETE',
            });
            
            // For 204 responses, apiRequest returns { status: 204, message: 'No Content' }
            // We just need to return the ID to indicate success
            return id;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка удаления ячейки');
        }
    }
);

// Link product to storage cell
export const linkProductToCell = createAsyncThunk(
    'storageCells/linkProductToCell',
    async (linkData, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/storage-cells/product-links/', {
                method: 'POST',
                body: JSON.stringify(linkData),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка привязки продукта к ячейке');
        }
    }
);

// Get product-cell links
export const fetchProductCellLinks = createAsyncThunk(
    'storageCells/fetchProductCellLinks',
    async ({ productId = null, storageCellId = null } = {}, { rejectWithValue }) => {
        try {
            let url = '/storage-cells/product-links/?';
            const params = [];
            if (productId) params.push(`product_id=${productId}`);
            if (storageCellId) params.push(`storage_cell_id=${storageCellId}`);
            url += params.join('&');
            
            const result = await apiRequest(url);
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки связей продуктов и ячеек');
        }
    }
);

// Track ongoing requests to prevent duplicates
const ongoingRequests = new Set();

// Get product-cell links for a specific product
export const fetchProductStorageCells = createAsyncThunk(
    'storageCells/fetchProductStorageCells',
    async (productId, { getState }) => {
        // Check if request is already in progress
        if (ongoingRequests.has(productId)) {
            return Promise.reject('Request already in progress');
        }
        
        // Check if data already exists in state
        const state = getState();
        if (state.storageCells.productStorageCells[productId] && 
            state.storageCells.productStorageCells[productId].length > 0) {
            return { productId, links: state.storageCells.productStorageCells[productId] };
        }
        
        try {
            ongoingRequests.add(productId);
            
            let url = '/storage-cells/product-links/?';
            const params = [];
            if (productId) params.push(`product_id=${productId}`);
            
            if (params.length > 0) {
                url += params.join('&');
            }
            
            const result = await apiRequest(url);
            return { productId, links: result.data || result };
        } catch (error) {
            throw error;
        } finally {
            ongoingRequests.delete(productId);
        }
    }
);

// Delete product-cell link
export const deleteProductCellLink = createAsyncThunk(
    'storageCells/deleteProductCellLink',
    async (linkId, { rejectWithValue }) => {
        try {
            await apiRequest(`/storage-cells/product-links/${linkId}`, {
                method: 'DELETE',
            });
            return linkId;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка удаления связи продукта и ячейки');
        }
    }
);

// Get storage cells with products for specific location
export const fetchCellsByLocationWithProducts = createAsyncThunk(
    'storageCells/fetchCellsByLocationWithProducts',
    async (locationId, { rejectWithValue }) => {
        try {
            const result = await apiRequest(`/storage-cells/by-location/${locationId}/with-products`);
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки ячеек с продуктами');
        }
    }
);

const storageCellsSlice = createSlice({
    name: 'storageCells',
    initialState: {
        locationsWithCells: [],
        storageCells: [],
        productCellLinks: [],
        loading: false,
        loadingLinks: false,
        error: null,
        linksError: null,
        productStorageCells: {}, // { productId: [{cell_id, cell_name, value}, ...] }
    },
    reducers: {
        clearStorageCells: (state) => {
            state.locationsWithCells = [];
            state.storageCells = [];
            state.productCellLinks = [];
            state.error = null;
            state.linksError = null;
        },
        clearProductCellLinks: (state) => {
            state.productCellLinks = [];
            state.linksError = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch locations with cells
            .addCase(fetchLocationsWithCells.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchLocationsWithCells.fulfilled, (state, action) => {
                state.loading = false;
                state.locationsWithCells = Array.isArray(action.payload) ? action.payload : [];
            })
            .addCase(fetchLocationsWithCells.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Fetch storage cells
            .addCase(fetchStorageCells.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchStorageCells.fulfilled, (state, action) => {
                state.loading = false;
                state.storageCells = Array.isArray(action.payload) ? action.payload : [];
            })
            .addCase(fetchStorageCells.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Create storage cell
            .addCase(createStorageCell.fulfilled, (state, action) => {
                state.storageCells.push(action.payload);
                
                // Also update locationsWithCells if the location exists there
                const locationIndex = state.locationsWithCells.findIndex(
                    loc => loc.id === action.payload.storage_location_id
                );
                if (locationIndex !== -1) {
                    state.locationsWithCells[locationIndex].cells.push(action.payload);
                }
            })
            
            // Update storage cell
            .addCase(updateStorageCell.fulfilled, (state, action) => {
                // Update in storageCells array
                const index = state.storageCells.findIndex(cell => cell.id === action.payload.id);
                if (index !== -1) {
                    state.storageCells[index] = action.payload;
                }
                
                // Update in locationsWithCells
                state.locationsWithCells.forEach(location => {
                    const cellIndex = location.cells.findIndex(cell => cell.id === action.payload.id);
                    if (cellIndex !== -1) {
                        location.cells[cellIndex] = action.payload;
                    }
                });
            })
            
            // Delete storage cell
            .addCase(deleteStorageCell.fulfilled, (state, action) => {
                // Remove from storageCells array
                state.storageCells = state.storageCells.filter(cell => cell.id !== action.payload);
                
                // Remove from locationsWithCells
                state.locationsWithCells.forEach(location => {
                    location.cells = location.cells.filter(cell => cell.id !== action.payload);
                });
            })
            .addCase(deleteStorageCell.rejected, (state, action) => {
                console.error('Delete storage cell failed:', action.payload);
                // Error is handled in the component, no state changes needed
            })
            
            // Link product to cell
            .addCase(linkProductToCell.fulfilled, (state, action) => {
                state.productCellLinks.push(action.payload);
            })
            
            // Fetch product-cell links
            .addCase(fetchProductCellLinks.pending, (state) => {
                state.loadingLinks = true;
                state.linksError = null;
            })
            .addCase(fetchProductCellLinks.fulfilled, (state, action) => {
                state.loadingLinks = false;
                state.productCellLinks = Array.isArray(action.payload) ? action.payload : [];
            })
            .addCase(fetchProductCellLinks.rejected, (state, action) => {
                state.loadingLinks = false;
                state.linksError = action.payload;
            })
            
            // Delete product-cell link
            .addCase(deleteProductCellLink.fulfilled, (state, action) => {
                state.productCellLinks = state.productCellLinks.filter(link => link.id !== action.payload);
            })
            
            // Fetch cells by location with products
            .addCase(fetchCellsByLocationWithProducts.fulfilled, (state, action) => {
                // This could be used to update specific location data if needed
                // For now, we'll just store the result in storageCells
                if (Array.isArray(action.payload)) {
                    // Merge or replace cells for the specific location
                    const locationId = action.meta.arg; // Get locationId from args
                    state.storageCells = [
                        ...state.storageCells.filter(cell => cell.storage_location_id !== locationId),
                        ...action.payload
                    ];
                }
            })
            .addCase(fetchProductStorageCells.fulfilled, (state, action) => {
                const { productId, links } = action.payload;
                state.productStorageCells[productId] = links;
            })
            .addCase(fetchProductStorageCells.rejected, (state, action) => {
                console.error('Failed to fetch product storage cells:', action.error);
            });
    },
});

export default storageCellsSlice.reducer;