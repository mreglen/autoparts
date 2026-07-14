import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

export const fetchSalesMenuCounts = createAsyncThunk(
  'salesMenuCounts/fetch',
  async (_, { rejectWithValue }) => {
    try {
      return await apiRequest('/sales/menu-counts');
    } catch (err) {
      return rejectWithValue(err?.detail || 'Не удалось загрузить счётчики продаж');
    }
  }
);

const salesMenuCountsSlice = createSlice({
  name: 'salesMenuCounts',
  initialState: {
    orders: 0,
    returns: 0,
    sales: 0,
    status: 'idle',
    error: null,
  },
  reducers: {
    clearSalesMenuCounts(state) {
      state.orders = 0;
      state.returns = 0;
      state.sales = 0;
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSalesMenuCounts.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchSalesMenuCounts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.orders = Number(action.payload?.orders) || 0;
        state.returns = Number(action.payload?.returns) || 0;
        state.sales = Number(action.payload?.sales) || 0;
      })
      .addCase(fetchSalesMenuCounts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Ошибка загрузки';
      });
  },
});

export const { clearSalesMenuCounts } = salesMenuCountsSlice.actions;
export default salesMenuCountsSlice.reducer;
