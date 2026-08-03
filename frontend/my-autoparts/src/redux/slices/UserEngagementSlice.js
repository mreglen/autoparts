import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { apiRequest, getAuthToken } from '../../utils/apiClient';
import { favoriteKeyFromItem, productFavoriteKey, rosskoFavoriteKey } from '../../utils/favoriteKeys';

export function isAuthEngagementError(message) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('401')
    || text.includes('unauthorized')
    || text.includes('not authenticated')
    || text.includes('учетные данные')
    || text.includes('учётные данные')
    || text.includes('сессия')
  );
}

export function isNetworkEngagementError(message) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('failed to fetch')
    || text.includes('networkerror')
    || text.includes('network')
    || text.includes('не отвечает')
    || text.includes('name_not_resolved')
    || text.includes('load failed')
  );
}

function hasAuthenticatedUser(getState) {
  const auth = getState().auth;
  const token = auth?.token || getAuthToken();
  return Boolean(token && auth?.user);
}

function authHeadersFromState(getState) {
  const auth = getState().auth;
  const token = auth?.token || getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const fetchFavoriteStatus = createAsyncThunk(
  'userEngagement/fetchFavoriteStatus',
  async (productId, { rejectWithValue }) => {
    try {
      const data = await apiRequest(`/user/favorites/${productId}/status`);
      return { key: productFavoriteKey(productId), isFavorite: Boolean(data?.is_favorite) };
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось загрузить избранное');
    }
  },
  {
    condition: (productId, { getState }) => {
      if (!hasAuthenticatedUser(getState)) return false;
      const key = productFavoriteKey(productId);
      if (!key) return false;
      return !Object.prototype.hasOwnProperty.call(
        getState().userEngagement?.favoriteByKey || {},
        key,
      );
    },
  },
);

export const fetchFavoriteStatusesBatch = createAsyncThunk(
  'userEngagement/fetchFavoriteStatusesBatch',
  async (productIds, { rejectWithValue }) => {
    try {
      const ids = [...new Set(
        (productIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      )].slice(0, 100);
      if (!ids.length) return { entries: [] };
      const data = await apiRequest('/user/favorites/status/batch', {
        method: 'POST',
        body: JSON.stringify({ product_ids: ids }),
      });
      const favorites = data?.favorites || {};
      const entries = ids.map((id) => ({
        key: productFavoriteKey(id),
        isFavorite: Boolean(favorites[String(id)] ?? favorites[id]),
      }));
      return { entries };
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось загрузить избранное');
    }
  },
  {
    condition: (productIds, { getState }) => {
      if (!hasAuthenticatedUser(getState)) return false;
      const known = getState().userEngagement?.favoriteByKey || {};
      return (productIds || []).some((id) => {
        const key = productFavoriteKey(id);
        return key && !Object.prototype.hasOwnProperty.call(known, key);
      });
    },
  },
);

export const fetchRosskoFavoriteStatus = createAsyncThunk(
  'userEngagement/fetchRosskoFavoriteStatus',
  async ({ brand, partnumber }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({
        brand: String(brand || '').trim(),
        partnumber: String(partnumber || '').trim(),
      });
      const data = await apiRequest(`/user/favorites/rossko/status?${params.toString()}`);
      return {
        key: rosskoFavoriteKey(brand, partnumber),
        isFavorite: Boolean(data?.is_favorite),
      };
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось загрузить избранное');
    }
  },
  {
    condition: (_, { getState }) => hasAuthenticatedUser(getState),
  },
);

export const toggleFavorite = createAsyncThunk(
  'userEngagement/toggleFavorite',
  async ({ productId, isFavorite }, { rejectWithValue }) => {
    try {
      if (isFavorite) {
        await apiRequest(`/user/favorites/${productId}`, { method: 'DELETE' });
        return { key: productFavoriteKey(productId), isFavorite: false };
      }
      await apiRequest(`/user/favorites/${productId}`, { method: 'POST' });
      return { key: productFavoriteKey(productId), isFavorite: true };
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось обновить избранное');
    }
  },
  {
    condition: (_, { getState }) => hasAuthenticatedUser(getState),
  },
);

export const toggleRosskoFavorite = createAsyncThunk(
  'userEngagement/toggleRosskoFavorite',
  async ({ brand, partnumber, guid, title, minPrice, isFavorite }, { rejectWithValue }) => {
    try {
      const key = rosskoFavoriteKey(brand, partnumber);
      if (isFavorite) {
        const params = new URLSearchParams({
          brand: String(brand || '').trim(),
          partnumber: String(partnumber || '').trim(),
        });
        await apiRequest(`/user/favorites/rossko?${params.toString()}`, { method: 'DELETE' });
        return { key, isFavorite: false };
      }
      await apiRequest('/user/favorites/rossko', {
        method: 'POST',
        body: JSON.stringify({
          brand: String(brand || '').trim(),
          partnumber: String(partnumber || '').trim(),
          guid: guid || undefined,
          title: title || undefined,
          min_price: minPrice != null ? Number(minPrice) : undefined,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      return { key, isFavorite: true };
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось обновить избранное');
    }
  },
  {
    condition: (_, { getState }) => hasAuthenticatedUser(getState),
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
  async (_, { rejectWithValue, getState }) => {
    try {
      const data = await apiRequest('/user/search-subscriptions', {
        headers: authHeadersFromState(getState),
      });
      return Array.isArray(data?.items) ? data.items : [];
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось загрузить подписки');
    }
  },
  {
    condition: (_, { getState }) => hasAuthenticatedUser(getState),
  },
);

export const subscribeToSearch = createAsyncThunk(
  'userEngagement/subscribeToSearch',
  async (query, { rejectWithValue, getState }) => {
    try {
      const data = await apiRequest('/user/search-subscriptions', {
        method: 'POST',
        body: JSON.stringify({ query }),
        headers: {
          'Content-Type': 'application/json',
          ...authHeadersFromState(getState),
        },
      });
      return data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Не удалось оформить подписку');
    }
  },
  {
    condition: (_, { getState }) => hasAuthenticatedUser(getState),
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

function syncFavoriteKeysFromItems(state, items) {
  items.forEach((item) => {
    const key = favoriteKeyFromItem(item);
    if (key) {
      state.favoriteByKey[key] = true;
    }
  });
}

const initialState = {
  favoriteByKey: {},
  favorites: [],
  favoritesLoading: false,
  viewHistory: [],
  viewHistoryLoading: false,
  subscriptions: [],
  subscriptionsLoading: false,
  subscriptionActionLoading: false,
  favoriteTogglingKey: null,
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
        if (action.payload.key) {
          state.favoriteByKey[action.payload.key] = action.payload.isFavorite;
        }
      })
      .addCase(fetchFavoriteStatusesBatch.fulfilled, (state, action) => {
        for (const entry of action.payload?.entries || []) {
          if (entry?.key) {
            state.favoriteByKey[entry.key] = Boolean(entry.isFavorite);
          }
        }
      })
      .addCase(fetchRosskoFavoriteStatus.fulfilled, (state, action) => {
        const key = action.payload?.key;
        if (!key) return;
        // Don't clobber an in-flight optimistic toggle
        if (state.favoriteTogglingKey === key) return;
        state.favoriteByKey[key] = Boolean(action.payload.isFavorite);
      })
      .addCase(toggleFavorite.pending, (state, action) => {
        const key = productFavoriteKey(action.meta.arg.productId);
        state.favoriteTogglingKey = key;
        const { isFavorite } = action.meta.arg;
        if (key) state.favoriteByKey[key] = !isFavorite;
      })
      .addCase(toggleFavorite.fulfilled, (state, action) => {
        state.favoriteTogglingKey = null;
        if (action.payload.key) {
          state.favoriteByKey[action.payload.key] = action.payload.isFavorite;
        }
      })
      .addCase(toggleFavorite.rejected, (state, action) => {
        state.favoriteTogglingKey = null;
        const key = productFavoriteKey(action.meta.arg.productId);
        const { isFavorite } = action.meta.arg;
        if (key) state.favoriteByKey[key] = isFavorite;
        if (!isAuthEngagementError(action.payload)) {
          state.error = action.payload;
        }
      })
      .addCase(toggleRosskoFavorite.pending, (state, action) => {
        const { brand, partnumber, isFavorite } = action.meta.arg;
        const key = rosskoFavoriteKey(brand, partnumber);
        state.favoriteTogglingKey = key;
        if (key) state.favoriteByKey[key] = !isFavorite;
      })
      .addCase(toggleRosskoFavorite.fulfilled, (state, action) => {
        state.favoriteTogglingKey = null;
        if (action.payload.key) {
          state.favoriteByKey[action.payload.key] = action.payload.isFavorite;
        }
      })
      .addCase(toggleRosskoFavorite.rejected, (state, action) => {
        state.favoriteTogglingKey = null;
        const { brand, partnumber, isFavorite } = action.meta.arg;
        const key = rosskoFavoriteKey(brand, partnumber);
        if (key) state.favoriteByKey[key] = isFavorite;
        if (!isAuthEngagementError(action.payload)) {
          state.error = action.payload;
        }
      })
      .addCase(fetchFavorites.pending, (state) => {
        state.favoritesLoading = true;
      })
      .addCase(fetchFavorites.fulfilled, (state, action) => {
        state.favoritesLoading = false;
        state.favorites = action.payload;
        syncFavoriteKeysFromItems(state, action.payload);
      })
      .addCase(fetchFavorites.rejected, (state, action) => {
        state.favoritesLoading = false;
        if (isAuthEngagementError(action.payload)) {
          state.favorites = [];
          return;
        }
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
        if (action.meta?.condition) return;
        if (isAuthEngagementError(action.payload)) {
          state.subscriptions = [];
          return;
        }
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
        if (action.meta?.condition) return;
        if (!isAuthEngagementError(action.payload)) {
          state.error = action.payload;
        }
      })
      .addCase(deleteSearchSubscription.fulfilled, (state, action) => {
        state.subscriptions = state.subscriptions.filter((item) => item.id !== action.payload);
      });
  },
});

export const { clearEngagementError } = userEngagementSlice.actions;
export default userEngagementSlice.reducer;
