import { createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'newPartsClientMarkup';

export const CLIENT_MARKUP_DISPLAY_BOTH = 'both';
export const CLIENT_MARKUP_DISPLAY_MARKED_UP_ONLY = 'marked_up_only';

const defaults = {
  percent: 0,
  displayMode: CLIENT_MARKUP_DISPLAY_MARKED_UP_ONLY,
  showPurchaseInCart: true,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    const percent = Number(parsed?.percent);
    return {
      percent: Number.isFinite(percent) && percent >= 0 ? Math.min(percent, 500) : 0,
      displayMode: parsed?.displayMode === CLIENT_MARKUP_DISPLAY_BOTH
        ? CLIENT_MARKUP_DISPLAY_BOTH
        : CLIENT_MARKUP_DISPLAY_MARKED_UP_ONLY,
      showPurchaseInCart: parsed?.showPurchaseInCart !== false,
    };
  } catch {
    return { ...defaults };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

const clientMarkupSlice = createSlice({
  name: 'clientMarkup',
  initialState: loadSettings(),
  reducers: {
    applyClientMarkupSettings: (state, action) => {
      const next = {
        percent: Math.max(0, Math.min(500, Number(action.payload?.percent) || 0)),
        displayMode: action.payload?.displayMode === CLIENT_MARKUP_DISPLAY_BOTH
          ? CLIENT_MARKUP_DISPLAY_BOTH
          : CLIENT_MARKUP_DISPLAY_MARKED_UP_ONLY,
        showPurchaseInCart: action.payload?.showPurchaseInCart !== false,
      };
      saveSettings(next);
      return next;
    },
  },
});

export const { applyClientMarkupSettings } = clientMarkupSlice.actions;
export default clientMarkupSlice.reducer;
