import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

export const fetchContractors = createAsyncThunk(
    'contractors/fetchContractors',
    async ({ includeInactive = false } = {}, { rejectWithValue }) => {
        try {
            const params = new URLSearchParams();
            if (includeInactive) params.set('include_inactive', 'true');
            const query = params.toString();
            return await apiRequest(`/autoservice/contractors${query ? `?${query}` : ''}`);
        } catch (err) {
            return rejectWithValue(err?.detail || err?.message || 'Ошибка загрузки подрядчиков');
        }
    }
);

export const createContractor = createAsyncThunk(
    'contractors/createContractor',
    async (payload, { rejectWithValue }) => {
        try {
            return await apiRequest('/autoservice/contractors', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
        } catch (err) {
            return rejectWithValue(err?.detail || err?.message || 'Ошибка добавления подрядчика');
        }
    }
);

export const updateContractor = createAsyncThunk(
    'contractors/updateContractor',
    async ({ contractorId, payload }, { rejectWithValue }) => {
        try {
            return await apiRequest(`/autoservice/contractors/${contractorId}`, {
                method: 'PATCH',
                body: JSON.stringify(payload),
            });
        } catch (err) {
            return rejectWithValue(err?.detail || err?.message || 'Ошибка обновления подрядчика');
        }
    }
);

export const fetchContractorOptions = createAsyncThunk(
    'contractors/fetchContractorOptions',
    async (_, { rejectWithValue }) => {
        try {
            return await apiRequest('/autoservice/repair-orders/contractors-options');
        } catch (err) {
            return rejectWithValue(err?.detail || err?.message || 'Ошибка загрузки подрядчиков');
        }
    }
);

const contractorsSlice = createSlice({
    name: 'contractors',
    initialState: {
        contractors: [],
        contractorOptions: [],
        loadingContractors: false,
        contractorsError: null,
        saving: false,
    },
    reducers: {
        clearContractorsError(state) {
            state.contractorsError = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchContractors.pending, (state) => {
                state.loadingContractors = true;
                state.contractorsError = null;
            })
            .addCase(fetchContractors.fulfilled, (state, action) => {
                state.loadingContractors = false;
                state.contractors = action.payload || [];
            })
            .addCase(fetchContractors.rejected, (state, action) => {
                state.loadingContractors = false;
                state.contractorsError = action.payload;
            })
            .addCase(createContractor.pending, (state) => {
                state.saving = true;
                state.contractorsError = null;
            })
            .addCase(createContractor.fulfilled, (state, action) => {
                state.saving = false;
                state.contractors.push(action.payload);
            })
            .addCase(createContractor.rejected, (state, action) => {
                state.saving = false;
                state.contractorsError = action.payload;
            })
            .addCase(updateContractor.pending, (state) => {
                state.saving = true;
                state.contractorsError = null;
            })
            .addCase(updateContractor.fulfilled, (state, action) => {
                state.saving = false;
                const index = state.contractors.findIndex((row) => row.id === action.payload.id);
                if (index !== -1) {
                    state.contractors[index] = action.payload;
                }
            })
            .addCase(updateContractor.rejected, (state, action) => {
                state.saving = false;
                state.contractorsError = action.payload;
            })
            .addCase(fetchContractorOptions.fulfilled, (state, action) => {
                state.contractorOptions = action.payload || [];
            });
    },
});

export const { clearContractorsError } = contractorsSlice.actions;

export default contractorsSlice.reducer;
