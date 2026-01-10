// src/redux/slices/StockOutSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiAxios } from '../../utils/apiClient';

export const createStockOut = createAsyncThunk(
  'stockOut/createStockOut',
  async (stockOutData, { rejectWithValue }) => {
    try {
      const response = await apiAxios.post(
        `/stock-outs/`,
        stockOutData
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
      const response = await apiAxios.get(
        `/stock-outs/`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.detail || 'Ошибка загрузки расходов'
      );
    }
  }
);

export const createReturn = createAsyncThunk(
  'stockOut/createReturn',
  async (returnData, { rejectWithValue }) => {
    try {
      const response = await apiAxios.post(
        `/stock-outs/returns`,
        returnData
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.detail || 'Ошибка возврата запчастей'
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
      })
      .addCase(createReturn.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createReturn.fulfilled, (state, action) => {
        state.loading = false;
        // После успешного возврата обновляем список расходов
        // В идеале здесь нужно обновить конкретные записи, но для простоты перезагрузим весь список
      })
      .addCase(createReturn.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearStockOutError } = stockOutSlice.actions;
export default stockOutSlice.reducer;