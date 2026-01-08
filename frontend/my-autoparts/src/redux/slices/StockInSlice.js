// src/store/slices/StockInSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiAxios } from '../../utils/apiClient';

export const fetchStockIns = createAsyncThunk(
  'stockIn/fetchStockIns',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiAxios.get(`/stock-ins/`, {
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.detail || 'Ошибка загрузки документов поступления'
      );
    }
  }
);

export const createStockIn = createAsyncThunk(
  'stockIn/createStockIn',
  async (stockInData, { rejectWithValue }) => {
    try {
      const response = await apiAxios.post(`/stock-ins/`, stockInData, {
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.detail || 'Ошибка создания документа поступления'
      );
    }
  }
);

export const clearStockInError = () => ({ type: 'stockIn/clearError' });

const stockInSlice = createSlice({
  name: 'stockIn',
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearStockInError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStockIns.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStockIns.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchStockIns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createStockIn.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createStockIn.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload);
      })
      .addCase(createStockIn.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearStockInError: clearStockInErrorAction } = stockInSlice.actions;
export default stockInSlice.reducer;