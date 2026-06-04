// src/redux/slices/PublicInfoSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequestUnauth } from '../../utils/apiClient';

const PUBLIC_INFO_CACHE_TTL_MS = 10 * 60 * 1000;
const SITE_CONFIG_CACHE_KEY = 'sg_public_site_config_v1';
const QUICK_LINKS_CACHE_KEY = 'sg_site_quick_links_v1';

function readSessionCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (!ts || Date.now() - ts > PUBLIC_INFO_CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeSessionCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // quota / private mode
  }
}

/** Публичный конфиг: телефон админ-орг., флаг «новые запчасти», наценка на новые (всегда 200). */
export const fetchPublicSiteConfig = createAsyncThunk(
  'publicInfo/fetchPublicSiteConfig',
  async (_, { rejectWithValue }) => {
    const cached = readSessionCache(SITE_CONFIG_CACHE_KEY);
    if (cached) return cached;
    try {
      const result = await apiRequestUnauth('/auth/public-site-config');
      writeSessionCache(SITE_CONFIG_CACHE_KEY, result);
      return result;
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка загрузки информации');
    }
  }
);

/** @deprecated используйте fetchPublicSiteConfig */
export const fetchAdminOrganizationPhone = fetchPublicSiteConfig;

export const fetchSiteQuickLinks = createAsyncThunk(
  'publicInfo/fetchSiteQuickLinks',
  async (_, { rejectWithValue }) => {
    const cached = readSessionCache(QUICK_LINKS_CACHE_KEY);
    if (cached) return cached;
    try {
      const result = await apiRequestUnauth('/public/site-quick-links');
      const links = Array.isArray(result) ? result : [];
      writeSessionCache(QUICK_LINKS_CACHE_KEY, links);
      return links;
    } catch (err) {
      return rejectWithValue(err?.message || 'Ошибка загрузки быстрых ссылок');
    }
  }
);

const publicInfoSlice = createSlice({
  name: 'publicInfo',
    initialState: {
        adminOrganizationPhone: null,
        showNewAutoparts: true,
        showSiteReviews: true,
        newPartsMarkupPercent: 15,
        usedPartsPurchaseMode: 'both',
        adminSellerMarkupContext: null,
        quickLinks: [],
        quickLinksLoading: false,
        loading: false,
        error: null,
    },
  reducers: {
    clearPublicInfo: (state) => {
      state.adminOrganizationPhone = null;
      state.showNewAutoparts = true;
      state.showSiteReviews = true;
      state.newPartsMarkupPercent = 15;
      state.usedPartsPurchaseMode = 'both';
      state.error = null;
    },
    setShowNewAutoparts: (state, action) => {
      state.showNewAutoparts = action.payload !== false;
    },
    setShowSiteReviews: (state, action) => {
      state.showSiteReviews = action.payload !== false;
    },
    setNewPartsMarkupPercent: (state, action) => {
      const n = Number(action.payload);
      state.newPartsMarkupPercent =
        Number.isFinite(n) && n >= 0 ? n : 15;
    },
    setAdminSellerMarkupContext: (state, action) => {
      state.adminSellerMarkupContext = action.payload;
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
        state.showSiteReviews = p?.show_site_reviews !== false;
        const m = Number(p?.new_parts_markup_percent);
        state.newPartsMarkupPercent =
          Number.isFinite(m) && m >= 0 ? m : 15;
        const mode = p?.used_parts_purchase_mode;
        state.usedPartsPurchaseMode =
          mode === 'cart_only' || mode === 'cta_only' || mode === 'both' ? mode : 'both';
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
        state.showSiteReviews = true;
        state.newPartsMarkupPercent = 15;
      })
      .addCase(fetchSiteQuickLinks.pending, (state) => {
        state.quickLinksLoading = true;
      })
      .addCase(fetchSiteQuickLinks.fulfilled, (state, action) => {
        state.quickLinksLoading = false;
        state.quickLinks = action.payload || [];
      })
      .addCase(fetchSiteQuickLinks.rejected, (state) => {
        state.quickLinksLoading = false;
        state.quickLinks = [];
      });
  },
});

export const {
  clearPublicInfo,
  setShowNewAutoparts,
  setShowSiteReviews,
  setNewPartsMarkupPercent,
  setAdminSellerMarkupContext,
} = publicInfoSlice.actions;
export default publicInfoSlice.reducer;
