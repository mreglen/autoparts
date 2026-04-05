// src/redux/slices/PublicInfoSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequestUnauth } from '../../utils/apiClient';

/** Публичный конфиг: телефон админ-орг. и флаг «новые запчасти» (всегда 200). */
export const fetchPublicSiteConfig = createAsyncThunk(
  'publicInfo/fetchPublicSiteConfig',
  async (_, { rejectWithValue }) => {
    try {
      const result = await apiRequestUnauth('/auth/public-site-config');
      return result;
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка загрузки информации');
    }
  }
);

/** @deprecated используйте fetchPublicSiteConfig */
export const fetchAdminOrganizationPhone = fetchPublicSiteConfig;

const publicInfoSlice = createSlice({
  name: 'publicInfo',
  initialState: {
    adminOrganizationPhone: null,
    showNewAutoparts: true,
    loading: false,
    error: null,
  },
  reducers: {
    clearPublicInfo: (state) => {
      state.adminOrganizationPhone = null;
      state.showNewAutoparts = true;
      state.error = null;
    },
    setShowNewAutoparts: (state, action) => {
      state.showNewAutoparts = action.payload !== false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPublicSiteConfig.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPublicSiteConfig.fulfilled, (state, action) => {
        state.loading = false;
        const p = action.payload;
        state.showNewAutoparts = p?.show_new_autoparts !== false;
        if (p?.organization_phone) {
          state.adminOrganizationPhone = {
            organization_name: p.organization_name ?? null,
            organization_phone: p.organization_phone,
          };
        } else {
          state.adminOrganizationPhone = null;
        }
      })
      .addCase(fetchPublicSiteConfig.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.showNewAutoparts = true;
      });
  },
});

export const { clearPublicInfo, setShowNewAutoparts } = publicInfoSlice.actions;
export default publicInfoSlice.reducer;
