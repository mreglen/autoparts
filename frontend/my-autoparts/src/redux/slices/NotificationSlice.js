import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';
import {
  CABINET_MODE_AUTOSERVICE,
  CABINET_MODE_SELLER,
  getCabinetMode,
} from '../../utils/cabinetMode';

const FEED_LIMIT = 30;

const MODE_CATEGORIES = {
  [CABINET_MODE_AUTOSERVICE]: 'autoservice',
  [CABINET_MODE_SELLER]: 'orders,messages,search,other',
};

function notificationCategoriesParam(getState) {
  const state = getState();
  const user = state.auth?.user;
  if (!user) return null;
  const autoserviceOrganizationId = state.publicInfo?.autoserviceOrganizationId || null;
  const mode = getCabinetMode(user, { autoserviceOrganizationId });
  return MODE_CATEGORIES[mode] || null;
}

function feedUrl(getState) {
  const categories = notificationCategoriesParam(getState);
  const suffix = categories ? `&categories=${encodeURIComponent(categories)}` : '';
  return `/notifications/feed?limit=${FEED_LIMIT}${suffix}`;
}

export const fetchNotifications = createAsyncThunk(
  'notifications/fetch',
  async (_, { getState, rejectWithValue }) => {
    try {
      return await apiRequest(feedUrl(getState));
    } catch (err) {
      return rejectWithValue(err?.detail || err?.message || 'Не удалось загрузить уведомления');
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (id, { rejectWithValue }) => {
    try {
      return await apiRequest(`/notifications/feed/${id}/read`, { method: 'POST' });
    } catch (err) {
      return rejectWithValue(err?.detail || err?.message || 'Ошибка');
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { rejectWithValue }) => {
    try {
      await apiRequest('/notifications/feed/read-all', { method: 'POST' });
      return true;
    } catch (err) {
      return rejectWithValue(err?.detail || err?.message || 'Ошибка');
    }
  }
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],
    unreadCount: 0,
    status: 'idle',
    error: null,
    modalOpen: false,
    lastFetchedAt: 0,
  },
  reducers: {
    openNotificationCenter(state) {
      state.modalOpen = true;
    },
    closeNotificationCenter(state) {
      state.modalOpen = false;
    },
    clearNotifications(state) {
      state.items = [];
      state.unreadCount = 0;
      state.status = 'idle';
      state.error = null;
      state.modalOpen = false;
      state.lastFetchedAt = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = Array.isArray(action.payload?.items) ? action.payload.items : [];
        state.unreadCount = Number(action.payload?.unread_count) || 0;
        state.lastFetchedAt = Date.now();
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Ошибка загрузки';
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const updated = action.payload;
        const idx = state.items.findIndex((item) => item.id === updated?.id);
        if (idx >= 0) {
          const wasUnread = !state.items[idx].is_read;
          state.items[idx] = { ...state.items[idx], ...updated };
          if (wasUnread) state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items = state.items.map((item) => ({ ...item, is_read: true }));
        state.unreadCount = 0;
      });
  },
});

export const {
  openNotificationCenter,
  closeNotificationCenter,
  clearNotifications,
} = notificationsSlice.actions;
export default notificationsSlice.reducer;
