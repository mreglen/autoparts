import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

export const fetchPartTypes = createAsyncThunk(
    'partTypes/fetchPartTypes',
    async (_, { rejectWithValue }) => {
        try {
            const data = await apiRequest('/part-types/');
            return data;
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
            });
    },
});

export default partTypeSlice.reducer;
