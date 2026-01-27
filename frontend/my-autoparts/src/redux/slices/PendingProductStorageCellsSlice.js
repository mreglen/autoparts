// src/redux/slices/PendingProductStorageCellsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

// Create pending product storage cell
export const createPendingProductStorageCell = createAsyncThunk(
    'pendingProductStorageCells/createPendingProductStorageCell',
    async (cellData, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/pending-product-storage-cells/', {
                method: 'POST',
                body: JSON.stringify(cellData),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка создания связи ячейки');
        }
    }
);

// Create batch of pending product storage cells
export const createPendingProductStorageCellsBatch = createAsyncThunk(
    'pendingProductStorageCells/createPendingProductStorageCellsBatch',
    async (cellsData, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/pending-product-storage-cells/batch', {
                method: 'POST',
                body: JSON.stringify(cellsData),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка создания связей ячеек');
        }
    }
);

// Get pending product storage cells
export const fetchPendingProductStorageCells = createAsyncThunk(
    'pendingProductStorageCells/fetchPendingProductStorageCells',
    async ({ pendingProductId = null, storageCellId = null } = {}, { rejectWithValue }) => {
        try {
            let url = '/pending-product-storage-cells/?';
            const params = [];
            if (pendingProductId) params.push(`pending_product_id=${pendingProductId}`);
            if (storageCellId) params.push(`storage_cell_id=${storageCellId}`);
            url += params.join('&');
            
            const result = await apiRequest(url);
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка загрузки связей ячеек');
        }
    }
);

// Delete pending product storage cell
export const deletePendingProductStorageCell = createAsyncThunk(
    'pendingProductStorageCells/deletePendingProductStorageCell',
    async (linkId, { rejectWithValue }) => {
        try {
            await apiRequest(`/pending-product-storage-cells/${linkId}`, {
                method: 'DELETE',
            });
            return linkId;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка удаления связи ячейки');
        }
    }
);

const pendingProductStorageCellsSlice = createSlice({
    name: 'pendingProductStorageCells',
    initialState: {
        items: [],
        loading: false,
        error: null,
        lastModified: null,
    },
    reducers: {
        clearPendingProductStorageCells: (state) => {
            state.items = [];
            state.error = null;
        },
        clearPendingProductStorageCellsError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Create single cell
            .addCase(createPendingProductStorageCell.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createPendingProductStorageCell.fulfilled, (state, action) => {
                state.loading = false;
                state.items.push(action.payload);
                state.lastModified = Date.now();
            })
            .addCase(createPendingProductStorageCell.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Create batch cells
            .addCase(createPendingProductStorageCellsBatch.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createPendingProductStorageCellsBatch.fulfilled, (state, action) => {
                state.loading = false;
                // Add new items, avoiding duplicates
                const newItems = action.payload.filter(newItem => 
                    !state.items.some(existingItem => existingItem.id === newItem.id)
                );
                state.items = [...state.items, ...newItems];
                state.lastModified = Date.now();
            })
            .addCase(createPendingProductStorageCellsBatch.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Fetch cells
            .addCase(fetchPendingProductStorageCells.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPendingProductStorageCells.fulfilled, (state, action) => {
                state.loading = false;
                state.items = Array.isArray(action.payload) ? action.payload : [];
            })
            .addCase(fetchPendingProductStorageCells.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            
            // Delete cell
            .addCase(deletePendingProductStorageCell.fulfilled, (state, action) => {
                state.items = state.items.filter(item => item.id !== action.payload);
                state.lastModified = Date.now();
            })
            .addCase(deletePendingProductStorageCell.rejected, (state, action) => {
                state.error = action.payload;
            });
    },
});

export const { clearPendingProductStorageCells, clearPendingProductStorageCellsError } = pendingProductStorageCellsSlice.actions;
export default pendingProductStorageCellsSlice.reducer;