// src/redux/slices/PublicInfoSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequestUnauth } from '../../utils/apiClient';

const PUBLIC_INFO_CACHE_TTL_MS = 10 * 60 * 1000;
const SITE_CONFIG_CACHE_KEY = 'sg_public_site_config_v2';
const QUICK_LINKS_CACHE_KEY = 'sg_site_quick_links_v1';

export const DEFAULT_BUYER_MARKUP_PERCENT = 30;
export const DEFAULT_AUTOSERVICE_MARKUP_PERCENT = 7;

export function parseMarkupPercent(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function parseAutoserviceMarkupPercent(payload) {
  return parseMarkupPercent(payload?.autoservice_markup_percent, DEFAULT_AUTOSERVICE_MARKUP_PERCENT);
}

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

export function clearPublicSiteConfigCache() {
  try {
    sessionStorage.removeItem(SITE_CONFIG_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function patchPublicSiteConfigCache(patch) {
  try {
    const raw = sessionStorage.getItem(SITE_CONFIG_CACHE_KEY);
    if (!raw) {
      writeSessionCache(SITE_CONFIG_CACHE_KEY, patch);
      return;
    }
    const parsed = JSON.parse(raw);
    parsed.data = { ...(parsed.data || {}), ...patch };
    parsed.ts = Date.now();
    sessionStorage.setItem(SITE_CONFIG_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

/** Публичный конфиг: телефон админ-орг., флаг «новые запчасти», наценка на новые (всегда 200). */
export const fetchPublicSiteConfig = createAsyncThunk(
  'publicInfo/fetchPublicSiteConfig',
  async (forceRefresh = false, { rejectWithValue }) => {
    if (!forceRefresh) {
      const cached = readSessionCache(SITE_CONFIG_CACHE_KEY);
      if (cached) return cached;
    } else {
      clearPublicSiteConfigCache();
    }
    try {
      const suffix = forceRefresh ? `?_nc=${Date.now()}` : '';
      const result = await apiRequestUnauth(`/auth/public-site-config${suffix}`);
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
        showYandexBadge: true,
        showWarehouseInventory: false,
        showAutoservice: false,
        autoserviceOrganizationId: null,
        newPartsMarkupPercent: DEFAULT_BUYER_MARKUP_PERCENT,
        autoserviceMarkupPercent: DEFAULT_AUTOSERVICE_MARKUP_PERCENT,
        usedPartsPurchaseMode: 'both',
        roundProductPrices: false,
        laximoVinCatalogAvailable: false,
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
      state.showYandexBadge = true;
      state.showWarehouseInventory = false;
      state.showAutoservice = false;
      state.autoserviceOrganizationId = null;
      state.newPartsMarkupPercent = DEFAULT_BUYER_MARKUP_PERCENT;
      state.autoserviceMarkupPercent = DEFAULT_AUTOSERVICE_MARKUP_PERCENT;
      state.usedPartsPurchaseMode = 'both';
      state.roundProductPrices = false;
      state.laximoVinCatalogAvailable = false;
      state.error = null;
    },
    setShowNewAutoparts: (state, action) => {
      state.showNewAutoparts = action.payload !== false;
    },
    setShowSiteReviews: (state, action) => {
      state.showSiteReviews = action.payload !== false;
    },
    setShowYandexBadge: (state, action) => {
      state.showYandexBadge = action.payload !== false;
    },
    setShowWarehouseInventory: (state, action) => {
      state.showWarehouseInventory = action.payload === true;
    },
    setShowAutoservice: (state, action) => {
      state.showAutoservice = action.payload === true;
    },
    setAutoserviceOrganizationId: (state, action) => {
      state.autoserviceOrganizationId = action.payload || null;
    },
    setNewPartsMarkupPercent: (state, action) => {
      state.newPartsMarkupPercent = parseMarkupPercent(action.payload, DEFAULT_BUYER_MARKUP_PERCENT);
    },
    setAutoserviceMarkupPercent: (state, action) => {
      state.autoserviceMarkupPercent = parseMarkupPercent(
        action.payload,
        DEFAULT_AUTOSERVICE_MARKUP_PERCENT
      );
    },
    setRoundProductPrices: (state, action) => {
      state.roundProductPrices = action.payload === true;
    },
    setUsedPartsPurchaseMode: (state, action) => {
      const mode = action.payload;
      state.usedPartsPurchaseMode =
        mode === 'cart_only' || mode === 'cta_only' || mode === 'both' ? mode : 'both';
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
        state.showYandexBadge = p?.show_yandex_badge !== false;
        state.showWarehouseInventory = p?.show_warehouse_inventory === true;
        state.showAutoservice = p?.show_autoservice === true;
        state.autoserviceOrganizationId = p?.autoservice_organization_id || null;
        state.newPartsMarkupPercent = parseMarkupPercent(
          p?.new_parts_markup_percent,
          DEFAULT_BUYER_MARKUP_PERCENT
        );
        state.autoserviceMarkupPercent = parseAutoserviceMarkupPercent(p);
        const mode = p?.used_parts_purchase_mode;
        state.usedPartsPurchaseMode =
          mode === 'cart_only' || mode === 'cta_only' || mode === 'both' ? mode : 'both';
        state.roundProductPrices = p?.round_product_prices === true;
        state.laximoVinCatalogAvailable = p?.laximo_vin_catalog_available === true;
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
        state.showYandexBadge = true;
        state.newPartsMarkupPercent = DEFAULT_BUYER_MARKUP_PERCENT;
        state.autoserviceMarkupPercent = DEFAULT_AUTOSERVICE_MARKUP_PERCENT;
        state.laximoVinCatalogAvailable = false;
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
  setShowYandexBadge,
  setShowWarehouseInventory,
  setShowAutoservice,
  setAutoserviceOrganizationId,
  setNewPartsMarkupPercent,
  setAutoserviceMarkupPercent,
  setRoundProductPrices,
  setUsedPartsPurchaseMode,
  setAdminSellerMarkupContext,
} = publicInfoSlice.actions;
export default publicInfoSlice.reducer;
