// src/redux/slices/StockOutSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const createStockOut = createAsyncThunk(
  'stockOut/createStockOut',
  async (stockOutData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${API_BASE}/stock-outs/`,
        stockOutData,
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.detail || 'Ошибка создания расхода'
      );
    }
  }
);

export const fetchStockOuts = createAsyncThunk(
  'stockOut/fetchStockOuts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${API_BASE}/stock-outs/`,
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.detail || 'Ошибка загрузки расходов'
      );
    }
  }
);

const stockOutSlice = createSlice({
  name: 'stockOut',
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearStockOutError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createStockOut.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createStockOut.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload);
      })
      .addCase(createStockOut.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchStockOuts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStockOuts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchStockOuts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearStockOutError } = stockOutSlice.actions;
export default stockOutSlice.reducer;