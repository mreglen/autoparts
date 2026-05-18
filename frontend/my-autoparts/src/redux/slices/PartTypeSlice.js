import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest, apiRequestUnauth } from '../../utils/apiClient';

export const fetchPublicPartTypes = createAsyncThunk(
    'partTypes/fetchPublicPartTypes',
    async (_, { rejectWithValue }) => {
        try {
            return await apiRequestUnauth('/part-types/public');
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const fetchPartTypes = createAsyncThunk(
    'partTypes/fetchPartTypes',
    async (_, { rejectWithValue, getState }) => {
        try {
            const token = getState()?.auth?.token;
            if (token) {
                return await apiRequest('/part-types/');
            }
            return await apiRequestUnauth('/part-types/public');
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

const partTypeSlice = createSlice({
    name: 'partTypes',
    initialState: {
        items: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchPartTypes.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPartTypes.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchPartTypes.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(fetchPublicPartTypes.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPublicPartTypes.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchPublicPartTypes.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export default partTypeSlice.reducer;
