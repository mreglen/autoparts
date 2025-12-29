// src/store/slices/StockInSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL;


const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchStockIns = createAsyncThunk(
  'stockIn/fetchStockIns',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE}/stock-ins/`, {
        headers: getAuthHeaders(),
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
      const response = await axios.post(`${API_BASE}/stock-ins/`, stockInData, {
        headers: getAuthHeaders(),
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