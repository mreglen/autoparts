import axios from 'axios';
import {
    getOutageMessage,
    getRetryDelayMs,
    isApiOutage,
    isRetryableStatus,
    registerApiFailure,
    registerApiSuccess,
} from './apiOutageGuard';
import { assertOnlineForMutation } from './networkStatus';


const normalizeBaseUrl = (url) => {
    if (!url) return url;
  
    return String(url).trim().replace(/\/+$/, '');
};

/** Fallback when CRA build missed REACT_APP_* (avoids `/undefined/...` → nginx 405). */
const resolveApiBase = () => {
    const fromEnv = normalizeBaseUrl(process.env.REACT_APP_API_BASE_URL);
    if (fromEnv) return fromEnv;
    if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}/server/api`;
    }
    return '/server/api';
};

const resolveBackendBase = () => {
    const fromEnv = normalizeBaseUrl(process.env.REACT_APP_BACKEND_BASE_URL);
    if (fromEnv) return fromEnv;
    if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}/server`;
    }
    return '/server';
};

const API_BASE = resolveApiBase();
const BACKEND_BASE = resolveBackendBase();


export { API_BASE, BACKEND_BASE };

/** База для статики (/uploads): на проде — origin сайта, в dev — FastAPI (BACKEND_BASE). */
export const getMediaBaseUrl = () => {
    if (typeof window !== 'undefined' && window.location?.hostname) {
        const host = window.location.hostname;
        if ((host === 'localhost' || host === '127.0.0.1') && BACKEND_BASE) {
            return BACKEND_BASE;
        }
        return window.location.origin;
    }
    if (BACKEND_BASE) {
        return BACKEND_BASE.replace(/\/server\/?$/, '') || BACKEND_BASE;
    }
    return '';
};

const MEDIA_SUBPATH_PREFIXES = ['/pictures/', '/videos/', '/vehicle_pictures/'];

// WebSocket URL configuration
export const getWebSocketBaseUrl = () => {
    // Get the backend base URL and convert http/https to ws/wss
    let backendUrl = BACKEND_BASE || '';
    
    // Remove trailing slash if present
    backendUrl = backendUrl.replace(/\/+$/, '');

    // Defensive fallback: if someone accidentally configured .../api,
    // WebSocket endpoint should still resolve to backend root (or /server).
    backendUrl = backendUrl.replace(/\/api$/, '');
    
    // Convert http:// to ws:// and https:// to wss://
    let wsUrl = backendUrl
        .replace(/^http:\/\//, 'ws://')
        .replace(/^https:\/\//, 'wss://');
    
    return wsUrl;
};


let authTokenCache = typeof localStorage !== 'undefined'
    ? localStorage.getItem('token')
    : null;

const REFRESH_TOKEN_KEY = 'refresh_token';
let refreshInFlight = null;

export const getRefreshToken = () => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setRefreshToken = (token) => {
    if (typeof localStorage === 'undefined') return;
    if (token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
};

export const clearAuthTokens = () => {
    setAuthToken(null);
    setRefreshToken(null);
};

export async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
        try {
            const response = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (data.access_token) {
                setAuthToken(data.access_token);
            }
            if (data.refresh_token) {
                setRefreshToken(data.refresh_token);
            }
            return data.access_token || null;
        } catch {
            return null;
        } finally {
            refreshInFlight = null;
        }
    })();

    return refreshInFlight;
}

export const getAuthToken = () => {
    if (authTokenCache) return authTokenCache;
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem('token');
    authTokenCache = stored;
    return stored;
};

export const setAuthToken = (token) => {
    authTokenCache = token || null;
    if (typeof localStorage === 'undefined') return;
    if (token) {
        localStorage.setItem('token', token);
    } else {
        localStorage.removeItem('token');
    }
};

export const getAuthHeaders = () => {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};


/** Убирает /server/uploads → /uploads (nginx отдаёт файлы с корня сайта). */
export const fixServerUploadsPath = (url) => {
    if (!url || typeof url !== 'string') return url;
    return url.replace('/server/uploads/', '/uploads/');
};

export const normalizeImageUrl = (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== 'string') return imageUrl;

    const url = imageUrl.trim();
    if (!url) return url;

    if (url.startsWith('blob:') || url.startsWith('data:')) {
        return url;
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
        return fixServerUploadsPath(url);
    }

    const mediaBase = getMediaBaseUrl();
    if (!mediaBase) return url;

    if (BACKEND_BASE && url.startsWith(BACKEND_BASE)) {
        return fixServerUploadsPath(url);
    }

    // Temp uploads live under uploads/temp (API returns /temp/org/file)
    if (url.startsWith('/temp/')) {
        return fixServerUploadsPath(`${mediaBase}/uploads${url}`);
    }

    if (MEDIA_SUBPATH_PREFIXES.some((prefix) => url.startsWith(prefix))) {
        return fixServerUploadsPath(`${mediaBase}/uploads${url}`);
    }

    if (url.startsWith('/uploads/')) {
        return fixServerUploadsPath(`${mediaBase}${url}`);
    }

    if (url.startsWith('/')) {
        return fixServerUploadsPath(`${mediaBase}${url}`);
    }

    if (!url.startsWith('http')) {
        return normalizeImageUrl(`/${url}`);
    }

    return url;
};

/** Уникальные URL для <img onError> — full → thumb → list → photo_url (карточка товара). */
export const buildImageUrlFallbackChain = (photo) => {
    if (!photo) return [];
    if (typeof photo === 'string') {
        const one = normalizeImageUrl(photo);
        return one ? [one] : [];
    }
    const raw = [
        pickFullImageUrl(photo),
        photo.thumb_url,
        photo.list_photo_url,
        photo.photo_url,
        photo.url,
        photo.image_url,
    ];
    const seen = new Set();
    const chain = [];
    for (const item of raw) {
        if (!item || typeof item !== 'string') continue;
        const normalized = normalizeImageUrl(item.trim());
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        chain.push(normalized);
    }
    return chain;
};

/** Списки/каталог: thumb → list → full (меньше трафика на LCP списка). */
export const buildListImageUrlFallbackChain = (photo) => {
    if (!photo) return [];
    if (typeof photo === 'string') {
        const one = normalizeImageUrl(photo);
        return one ? [one] : [];
    }
    const raw = [
        photo.thumb_url,
        photo.list_photo_url,
        pickFullImageUrl(photo),
        photo.photo_url,
        photo.url,
        photo.image_url,
    ];
    const seen = new Set();
    const chain = [];
    for (const item of raw) {
        if (!item || typeof item !== 'string') continue;
        const normalized = normalizeImageUrl(item.trim());
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        chain.push(normalized);
    }
    return chain;
};

/** Полноразмерное фото для fallback, если превью недоступно. */
export const pickFullImageUrl = (photo) => {
    if (!photo) return '';
    if (typeof photo === 'string') return photo;
    return photo.full_url || photo.photo_url || photo.url || photo.image_url || '';
};

/** URL для списков/каталога: thumb → list → full. */
export const pickListImageUrl = (photo) => {
    if (!photo) return '';
    if (typeof photo === 'string') return photo;
    return photo.thumb_url || photo.list_photo_url || pickFullImageUrl(photo) || '';
};

export const pickListImageUrlNormalized = (photo) => normalizeImageUrl(pickListImageUrl(photo));

export const pickFullImageUrlNormalized = (photo) => normalizeImageUrl(pickFullImageUrl(photo));


export function formatApiDetail(detail) {
    if (detail == null) return null;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
        return detail
            .map((e) => (typeof e === 'object' && e != null && e.msg ? e.msg : JSON.stringify(e)))
            .join('; ');
    }
    if (typeof detail === 'object') return JSON.stringify(detail);
    return String(detail);
}

const GUEST_CART_STORAGE_KEY = 'guest_cart_token';

const getGuestCartToken = () => {
    return localStorage.getItem(GUEST_CART_STORAGE_KEY) || null;
};

const setGuestCartToken = (token) => {
    if (!token) return;
    localStorage.setItem(GUEST_CART_STORAGE_KEY, token);
};

const GUEST_CART_HEADER_NAME = 'X-Guest-Cart-Token';

const API_REQUEST_TIMEOUT_MS = 20000;
export const API_LONG_REQUEST_TIMEOUT_MS = 120000;

const withRequestTimeout = (options = {}, timeoutMs = API_REQUEST_TIMEOUT_MS) => {
    if (options.signal) return { fetchOptions: options, timeoutId: null };
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    const { _timeoutId: _ignored, ...rest } = options;
    return {
        fetchOptions: { ...rest, signal: controller.signal },
        timeoutId,
    };
};

const clearRequestTimeout = (timeoutId) => {
    if (timeoutId) {
        window.clearTimeout(timeoutId);
    }
};

export const apiRequest = async (endpoint, options = {}, retryCount = 0) => {
    if (isApiOutage() && retryCount === 0) {
        throw new Error(getOutageMessage());
    }

    const { timeoutMs, ...requestOptions } = options;
    const method = requestOptions.method || 'GET';
    assertOnlineForMutation(method);

    const url = `${API_BASE}${endpoint}`;
    const timed = withRequestTimeout(requestOptions, timeoutMs ?? API_REQUEST_TIMEOUT_MS);
    const defaultOptions = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
            [GUEST_CART_HEADER_NAME]: getGuestCartToken() || undefined,
            ...requestOptions.headers
        },
        ...timed.fetchOptions
    };

    let response;
    try {
        response = await fetch(url, defaultOptions);
    } catch (err) {
        clearRequestTimeout(timed.timeoutId);
        if (err?.name === 'AbortError') {
            throw new Error('Сервер не отвечает. Попробуйте ещё раз через несколько секунд.');
        }
        throw err;
    }
    clearRequestTimeout(timed.timeoutId);

    const guestTokenFromResponse = response.headers.get(GUEST_CART_HEADER_NAME);
    if (guestTokenFromResponse) {
        setGuestCartToken(guestTokenFromResponse);
    }

    if (response.status === 401 && retryCount === 0 && !endpoint.includes('/auth/refresh')) {
        const newToken = await refreshAccessToken();
        if (newToken) {
            return apiRequest(endpoint, options, retryCount + 1);
        }
    }

    if (!response.ok) {
        if (retryCount < 1 && isRetryableStatus(response.status)) {
            registerApiFailure(response.status);
            await new Promise((resolve) => setTimeout(resolve, getRetryDelayMs(retryCount)));
            return apiRequest(endpoint, options, retryCount + 1);
        }
        if (isRetryableStatus(response.status)) {
            registerApiFailure(response.status);
        }
        const errorData = await response.json().catch(() => ({}));
        const msg = formatApiDetail(errorData.detail) || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(msg);
    }

    registerApiSuccess();

    if (response.status === 204) {
        return { status: 204, message: 'No Content' };
    }

    return response.json();
};


export const apiRequestUnauth = async (endpoint, options = {}) => {
    const url = `${API_BASE}${endpoint}`;
    const defaultOptions = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            [GUEST_CART_HEADER_NAME]: getGuestCartToken() || undefined,
            ...options.headers
        },
        ...options
    };

    const response = await fetch(url, defaultOptions);

    const guestTokenFromResponse = response.headers.get(GUEST_CART_HEADER_NAME);
    if (guestTokenFromResponse) {
        setGuestCartToken(guestTokenFromResponse);
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = formatApiDetail(errorData.detail) || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(msg);
    }


    if (response.status === 204) {
        return { status: 204, message: 'No Content' };
    }

    return response.json();
};


export const apiRequestFormData = async (endpoint, formData, options = {}, retryCount = 0) => {
    const method = options.method || 'POST';
    assertOnlineForMutation(method);

    const url = `${API_BASE}${endpoint}`;
    const timed = withRequestTimeout(options);

    const defaultOptions = {
        method: 'POST',
        headers: {
            ...getAuthHeaders(),
            ...options.headers
        },
        ...timed.fetchOptions
    };

    let response;
    try {
        response = await fetch(url, {
            ...defaultOptions,
            body: formData
        });
    } catch (err) {
        clearRequestTimeout(timed.timeoutId);
        if (err?.name === 'AbortError') {
            throw new Error('Сервер не отвечает. Попробуйте ещё раз через несколько секунд.');
        }
        throw err;
    }
    clearRequestTimeout(timed.timeoutId);

    if (response.status === 401 && retryCount === 0 && !endpoint.includes('/auth/refresh')) {
        const newToken = await refreshAccessToken();
        if (newToken) {
            return apiRequestFormData(endpoint, formData, options, retryCount + 1);
        }
    }

    if (!response.ok) {
        if (retryCount < 1 && isRetryableStatus(response.status)) {
            registerApiFailure(response.status);
            await new Promise((resolve) => setTimeout(resolve, getRetryDelayMs(retryCount)));
            return apiRequestFormData(endpoint, formData, options, retryCount + 1);
        }
        if (isRetryableStatus(response.status)) {
            registerApiFailure(response.status);
        }
        const errorData = await response.json().catch(() => ({}));
        const msg = formatApiDetail(errorData.detail) || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(msg);
    }

    registerApiSuccess();
    return response.json();
};


export const apiAxios = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});


apiAxios.interceptors.request.use((config) => {
    assertOnlineForMutation(config.method);
    const token = getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    const guestToken = getGuestCartToken();
    if (guestToken) {
        config.headers[GUEST_CART_HEADER_NAME] = guestToken;
    }
    return config;
});

apiAxios.interceptors.response.use(
    (response) => {
        registerApiSuccess();
        const guestTokenFromResponse = response.headers?.['x-guest-cart-token'];
        if (guestTokenFromResponse) {
            setGuestCartToken(guestTokenFromResponse);
        }
        return response;
    },
    async (error) => {
        const status = error.response?.status;
        const config = error.config;

        if (status === 401 && config && !config.__authRetried && !String(config.url || '').includes('/auth/refresh')) {
            config.__authRetried = true;
            const newToken = await refreshAccessToken();
            if (newToken) {
                config.headers.Authorization = `Bearer ${newToken}`;
                return apiAxios(config);
            }
        }

        if (isRetryableStatus(status)) {
            registerApiFailure(status);
        }
        return Promise.reject(error);
    },
);


export const apiAxiosUnauth = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
    timeout: API_REQUEST_TIMEOUT_MS,
    headers: {
        'Content-Type': 'application/json',
    },
});

const applyGuestCartTokenFromResponse = (response) => {
    const guestTokenFromResponse = response?.headers?.['x-guest-cart-token'];
    if (guestTokenFromResponse) {
        setGuestCartToken(guestTokenFromResponse);
    }
};

apiAxiosUnauth.interceptors.request.use((config) => {
    if (isApiOutage() && !config.__outageRetry) {
        return Promise.reject(new Error(getOutageMessage()));
    }
    const guestToken = getGuestCartToken();
    if (guestToken) {
        config.headers[GUEST_CART_HEADER_NAME] = guestToken;
    }
    return config;
});

apiAxiosUnauth.interceptors.response.use(
    (response) => {
        registerApiSuccess();
        applyGuestCartTokenFromResponse(response);
        return response;
    },
    async (error) => {
        const config = error.config;
        const status = error.response?.status;
        const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');

        if (config && !config.__retryCount && (isRetryableStatus(status) || isTimeout)) {
            config.__retryCount = 1;
            config.__outageRetry = true;
            if (status) registerApiFailure(status);
            else if (isTimeout) registerApiFailure(504);
            await new Promise((resolve) => setTimeout(resolve, getRetryDelayMs(0)));
            return apiAxiosUnauth(config);
        }

        if (isRetryableStatus(status)) {
            registerApiFailure(status);
        } else if (isTimeout) {
            registerApiFailure(504);
        }
        return Promise.reject(error);
    },
);

/** Сообщение об ошибке из ответа axios/fetch для показа пользователю. */
export const formatAxiosErrorMessage = (error, fallback = 'Ошибка запроса') => {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    const status = error.response?.status;
    const detail = formatApiDetail(error.response?.data?.detail);
    if (detail) return detail;
    if (status === 504) return 'Сервер не успел ответить. Попробуйте обновить страницу через несколько секунд.';
    if (status === 502 || status === 503) return 'Сервер временно недоступен. Попробуйте ещё раз.';
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return 'Сервер не отвечает. Попробуйте ещё раз через несколько секунд.';
    }
    if (error.message) return error.message;
    return fallback;
};

export default apiRequest;
