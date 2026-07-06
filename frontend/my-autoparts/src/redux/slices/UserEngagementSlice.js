import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

export const fetchFavoriteStatus = createAsyncThunk(
  'userEngagement/fetchFavoriteStatus',
  async (productId, { rejectWithValue }) => {
    try {
      const data = await apiRequest(`/user/favorites/${productId}/status`);
      return { productId, isFavorite: Boolean(data?.is_favorite) };
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось загрузить избранное');
    }
  },
);

export const toggleFavorite = createAsyncThunk(
  'userEngagement/toggleFavorite',
  async ({ productId, isFavorite }, { rejectWithValue }) => {
    try {
      if (isFavorite) {
        await apiRequest(`/user/favorites/${productId}`, { method: 'DELETE' });
        return { productId, isFavorite: false };
      }
      await apiRequest(`/user/favorites/${productId}`, { method: 'POST' });
      return { productId, isFavorite: true };
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось обновить избранное');
    }
  },
);

export const fetchFavorites = createAsyncThunk(
  'userEngagement/fetchFavorites',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiRequest('/user/favorites');
      return Array.isArray(data?.items) ? data.items : [];
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось загрузить избранное');
    }
  },
);

export const recordProductView = createAsyncThunk(
  'userEngagement/recordProductView',
  async (productId, { rejectWithValue }) => {
    try {
      await apiRequest(`/user/product-views/${productId}`, { method: 'POST' });
      return productId;
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось сохранить просмотр');
    }
  },
);

export const fetchViewHistory = createAsyncThunk(
  'userEngagement/fetchViewHistory',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiRequest('/user/product-views');
      return Array.isArray(data?.items) ? data.items : [];
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось загрузить историю');
    }
  },
);

export const clearViewHistory = createAsyncThunk(
  'userEngagement/clearViewHistory',
  async (_, { rejectWithValue }) => {
    try {
      await apiRequest('/user/product-views', { method: 'DELETE' });
      return true;
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось очистить историю');
    }
  },
);

export const fetchSearchSubscriptions = createAsyncThunk(
  'userEngagement/fetchSearchSubscriptions',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiRequest('/user/search-subscriptions');
      return Array.isArray(data?.items) ? data.items : [];
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось загрузить подписки');
    }
  },
);

export const subscribeToSearch = createAsyncThunk(
  'userEngagement/subscribeToSearch',
  async (query, { rejectWithValue }) => {
    try {
      const data = await apiRequest('/user/search-subscriptions', {
        method: 'POST',
        body: JSON.stringify({ query }),
        headers: { 'Content-Type': 'application/json' },
      });
      return data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось оформить подписку');
    }
  },
);

export const deleteSearchSubscription = createAsyncThunk(
  'userEngagement/deleteSearchSubscription',
  async (subscriptionId, { rejectWithValue }) => {
    try {
      await apiRequest(`/user/search-subscriptions/${subscriptionId}`, { method: 'DELETE' });
      return subscriptionId;
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось удалить подписку');
    }
  },
);

const normalizeProductId = (productId) => Number(productId);

const initialState = {
  favoriteByProductId: {},
  favorites: [],
  favoritesLoading: false,
  viewHistory: [],
  viewHistoryLoading: false,
  subscriptions: [],
  subscriptionsLoading: false,
  subscriptionActionLoading: false,
  favoriteToggleLoading: false,
  error: null,
};

const userEngagementSlice = createSlice({
  name: 'userEngagement',
  initialState,
  reducers: {
    clearEngagementError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFavoriteStatus.fulfilled, (state, action) => {
        const productId = normalizeProductId(action.payload.productId);
        state.favoriteByProductId[productId] = action.payload.isFavorite;
      })
      .addCase(toggleFavorite.pending, (state, action) => {
        state.favoriteToggleLoading = true;
        const productId = normalizeProductId(action.meta.arg.productId);
        const { isFavorite } = action.meta.arg;
        state.favoriteByProductId[productId] = !isFavorite;
      })
      .addCase(toggleFavorite.fulfilled, (state, action) => {
        state.favoriteToggleLoading = false;
        const productId = normalizeProductId(action.payload.productId);
        state.favoriteByProductId[productId] = action.payload.isFavorite;
      })
      .addCase(toggleFavorite.rejected, (state, action) => {
        state.favoriteToggleLoading = false;
        const productId = normalizeProductId(action.meta.arg.productId);
        const { isFavorite } = action.meta.arg;
        state.favoriteByProductId[productId] = isFavorite;
        state.error = action.payload;
      })
      .addCase(fetchFavorites.pending, (state) => {
        state.favoritesLoading = true;
      })
      .addCase(fetchFavorites.fulfilled, (state, action) => {
        state.favoritesLoading = false;
        state.favorites = action.payload;
      })
      .addCase(fetchFavorites.rejected, (state, action) => {
        state.favoritesLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchViewHistory.pending, (state) => {
        state.viewHistoryLoading = true;
      })
      .addCase(fetchViewHistory.fulfilled, (state, action) => {
        state.viewHistoryLoading = false;
        state.viewHistory = action.payload;
      })
      .addCase(fetchViewHistory.rejected, (state, action) => {
        state.viewHistoryLoading = false;
        state.error = action.payload;
      })
      .addCase(clearViewHistory.fulfilled, (state) => {
        state.viewHistory = [];
      })
      .addCase(fetchSearchSubscriptions.pending, (state) => {
        state.subscriptionsLoading = true;
      })
      .addCase(fetchSearchSubscriptions.fulfilled, (state, action) => {
        state.subscriptionsLoading = false;
        state.subscriptions = action.payload;
      })
      .addCase(fetchSearchSubscriptions.rejected, (state, action) => {
        state.subscriptionsLoading = false;
        state.error = action.payload;
      })
      .addCase(subscribeToSearch.pending, (state) => {
        state.subscriptionActionLoading = true;
      })
      .addCase(subscribeToSearch.fulfilled, (state, action) => {
        state.subscriptionActionLoading = false;
        const row = action.payload;
        if (!row?.id) return;
        const exists = state.subscriptions.some((item) => item.id === row.id);
        if (!exists) {
          state.subscriptions = [row, ...state.subscriptions];
        }
      })
      .addCase(subscribeToSearch.rejected, (state, action) => {
        state.subscriptionActionLoading = false;
        state.error = action.payload;
      })
      .addCase(deleteSearchSubscription.fulfilled, (state, action) => {
        state.subscriptions = state.subscriptions.filter((item) => item.id !== action.payload);
      });
  },
});

export const { clearEngagementError } = userEngagementSlice.actions;
export default userEngagementSlice.reducer;
