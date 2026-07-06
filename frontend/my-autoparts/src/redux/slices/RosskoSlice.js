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
  },
  reducers: {
    clearSearch: (state) => {
      state.items = null;
      state.status = 'idle';
      state.error = null;
      state.searchQuery = '';
      state.searchCache = {};
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchSearchResults
      .addCase(fetchSearchResults.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchSearchResults.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
        state.searchQuery = action.meta.arg.text;
        // Кэшируем результат
        state.searchCache[action.meta.arg.text] = {
          data: action.payload,
          timestamp: Date.now()
        };
      })
      .addCase(fetchSearchResults.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { clearSearch, setSearchQuery } = RosskoSlice.actions;

// Селекторы
export const selectRosskoItems = (state) => state.rossko.items;
export const selectRosskoStatus = (state) => state.rossko.status;
export const selectRosskoError = (state) => state.rossko.error;
export const selectSearchQuery = (state) => state.rossko.searchQuery;

export default RosskoSlice.reducer;
