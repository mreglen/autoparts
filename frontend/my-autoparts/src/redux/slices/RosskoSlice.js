// src/features/rossko/rosskoSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiAxios } from '../../utils/apiClient';

// Асинхронный thunk для выполнения поиска с кэшированием
export const fetchSearchResults = createAsyncThunk(
  'rossko/fetchSearchResults',
  async ({ text, delivery_id = "000000001", address_id = 176458 }, { rejectWithValue, getState }) => {
    const trimmedText = text.trim();

    // Проверяем кэш
    const state = getState();
    const cacheEntry = state.rossko.searchCache[trimmedText];

    // Если данные в кэше свежие (менее 5 минут), используем их
    if (cacheEntry && (Date.now() - cacheEntry.timestamp) < 5 * 60 * 1000) {
      return cacheEntry.data;
    }

    try {
      const response = await apiAxios.post(`/rossko/GetSearch`, {
        text: trimmedText,
        delivery_id,
        address_id
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Ошибка поиска');
    }
  }
);

const RosskoSlice = createSlice({
  name: 'rossko',
  initialState: {
    items: null,
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
    searchQuery: '', // Сохраняем последний запрос
    searchCache: {}, // Кэш результатов поиска: {query: {data, timestamp}}
    orders: null,
    ordersStatus: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    ordersError: null,
    databaseOrders: null,
    databaseOrdersStatus: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    databaseOrdersError: null,
  },
  reducers: {
    clearSearch: (state) => {
      state.items = null;
      state.status = 'idle';
      state.error = null;
      state.searchQuery = '';
    },
    clearSearchCache: (state) => {
      state.searchCache = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSearchResults.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchSearchResults.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
        state.searchQuery = action.payload?.text || '';

        // Сохраняем в кэш
        const query = action.payload?.text || '';
        if (query) {
          state.searchCache[query] = {
            data: action.payload,
            timestamp: Date.now()
          };
        }
      })
      .addCase(fetchSearchResults.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Неизвестная ошибка';
      })
      .addCase(fetchRosskoOrders.pending, (state) => {
        state.ordersStatus = 'loading';
        state.ordersError = null;
      })
      .addCase(fetchRosskoOrders.fulfilled, (state, action) => {
        state.ordersStatus = 'succeeded';
        state.orders = action.payload;
      })
      .addCase(fetchRosskoOrders.rejected, (state, action) => {
        state.ordersStatus = 'failed';
        state.ordersError = action.payload || 'Неизвестная ошибка';
      })
      .addCase(createRosskoCheckout.pending, (state) => {
        // Можно добавить состояние загрузки для checkout если нужно
      })
      .addCase(createRosskoCheckout.fulfilled, (state, action) => {
        // Обработка успешного создания заказа
      })
      .addCase(createRosskoCheckout.rejected, (state, action) => {
        // Обработка ошибки создания заказа
      })
      .addCase(fetchDatabaseOrders.pending, (state) => {
        state.databaseOrdersStatus = 'loading';
        state.databaseOrdersError = null;
      })
      .addCase(fetchDatabaseOrders.fulfilled, (state, action) => {
        state.databaseOrdersStatus = 'succeeded';
        state.databaseOrders = action.payload;
      })
      .addCase(fetchDatabaseOrders.rejected, (state, action) => {
        state.databaseOrdersStatus = 'failed';
        state.databaseOrdersError = action.payload || 'Неизвестная ошибка';
      });
  },
});

export const { clearSearch, clearSearchCache } = RosskoSlice.actions;

export default RosskoSlice.reducer;

// Асинхронный thunk для получения заказов Росско
export const fetchRosskoOrders = createAsyncThunk(
  'rossko/fetchRosskoOrders',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await apiAxios.post(`/rossko/GetOrders`, params);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Ошибка получения заказов');
    }
  }
);

// Асинхронный thunk для оформления заказа Росско
export const createRosskoCheckout = createAsyncThunk(
  'rossko/createRosskoCheckout',
  async (checkoutData, { rejectWithValue }) => {
    try {
      const response = await apiAxios.post(`/rossko/GetCheckout`, checkoutData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Ошибка оформления заказа');
    }
  }
);

// Асинхронный thunk для получения заказов из базы данных (новые запчасти)
export const fetchDatabaseOrders = createAsyncThunk(
  'rossko/fetchDatabaseOrders',
  async (params = {}, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiAxios.get(`/orders/`, {
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Ошибка получения заказов из базы данных');
    }
  }
);

// Селекторы
export const selectRosskoItems = (state) => state.rossko.items;
export const selectRosskoStatus = (state) => state.rossko.status;
export const selectRosskoError = (state) => state.rossko.error;
export const selectSearchQuery = (state) => state.rossko.searchQuery;
export const selectRosskoOrders = (state) => state.rossko.orders;
export const selectRosskoOrdersStatus = (state) => state.rossko.ordersStatus;
export const selectRosskoOrdersError = (state) => state.rossko.ordersError;
export const selectDatabaseOrders = (state) => state.rossko.databaseOrders;
export const selectDatabaseOrdersStatus = (state) => state.rossko.databaseOrdersStatus;
export const selectDatabaseOrdersError = (state) => state.rossko.databaseOrdersError;