import axios from 'axios';


const normalizeBaseUrl = (url) => {
    if (!url) return url;
  
    return String(url).trim().replace(/\/+$/, '');
};

const API_BASE = normalizeBaseUrl(process.env.REACT_APP_API_BASE_URL);
const BACKEND_BASE = normalizeBaseUrl(process.env.REACT_APP_BACKEND_BASE_URL);


if (process.env.NODE_ENV !== 'production') {
    console.log('REACT_APP_API_BASE_URL', process.env.REACT_APP_API_BASE_URL);
    console.log('REACT_APP_BACKEND_BASE_URL', process.env.REACT_APP_BACKEND_BASE_URL);
    console.log('API_BASE:', API_BASE);
    console.log('BACKEND_BASE:', BACKEND_BASE);
}


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
    
    console.log('[WS Config] BACKEND_BASE from env:', BACKEND_BASE);
    console.log('[WS Config] Processed backendUrl:', backendUrl);
    
    // Remove trailing slash if present
    backendUrl = backendUrl.replace(/\/+$/, '');

    // Defensive fallback: if someone accidentally configured .../api,
    // WebSocket endpoint should still resolve to backend root (or /server).
    backendUrl = backendUrl.replace(/\/api$/, '');
    
    // Convert http:// to ws:// and https:// to wss://
    let wsUrl = backendUrl
        .replace(/^http:\/\//, 'ws://')
        .replace(/^https:\/\//, 'wss://');
    
    console.log('[WS Config] Final WebSocket URL:', wsUrl);
    
    return wsUrl;
};


export const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
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

/** Уникальные URL для <img onError> — full → thumb → list → photo_url. */
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

/** Полноразмерное фото для fallback, если превью недоступно. */
export const pickFullImageUrl = (photo) => {
    if (!photo) return '';
    if (typeof photo === 'string') return photo;
    return photo.full_url || photo.photo_url || photo.url || photo.image_url || '';
};

/** URL для списков/каталога: сначала полное фото (стабильно на диске), затем thumb. */
export const pickListImageUrl = (photo) => {
    if (!photo) return '';
    if (typeof photo === 'string') return photo;
    const full = pickFullImageUrl(photo);
    if (full) return full;
    return photo.thumb_url || photo.list_photo_url || '';
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

export const apiRequest = async (endpoint, options = {}) => {
    const url = `${API_BASE}${endpoint}`;
    const defaultOptions = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
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


export const apiRequestFormData = async (endpoint, formData, options = {}) => {
    const url = `${API_BASE}${endpoint}`;
    const token = localStorage.getItem('token');
    console.log('apiRequestFormData - Token exists:', !!token);
    console.log('apiRequestFormData - Endpoint:', endpoint);

    const defaultOptions = {
        method: 'POST',
        headers: {
            ...getAuthHeaders(),
            ...options.headers
        },
        ...options
    };
    
    console.log('apiRequestFormData - Headers:', defaultOptions.headers);

    const response = await fetch(url, {
        ...defaultOptions,
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('apiRequestFormData - Error:', errorData);
        const msg = formatApiDetail(errorData.detail) || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(msg);
    }

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
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    const guestToken = getGuestCartToken();
    if (guestToken) {
        config.headers[GUEST_CART_HEADER_NAME] = guestToken;
    }
    return config;
});

apiAxios.interceptors.response.use((response) => {
    const guestTokenFromResponse = response.headers?.['x-guest-cart-token'];
    if (guestTokenFromResponse) {
        setGuestCartToken(guestTokenFromResponse);
    }
    return response;
});


export const apiAxiosUnauth = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiAxiosUnauth.interceptors.request.use((config) => {
    const guestToken = getGuestCartToken();
    if (guestToken) {
        config.headers[GUEST_CART_HEADER_NAME] = guestToken;
    }
    return config;
});

apiAxiosUnauth.interceptors.response.use((response) => {
    const guestTokenFromResponse = response.headers?.['x-guest-cart-token'];
    if (guestTokenFromResponse) {
        setGuestCartToken(guestTokenFromResponse);
    }
    return response;
});

export default apiRequest;
