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


export const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};


export const normalizeImageUrl = (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== 'string') return imageUrl;

    // Don't modify full URLs with backend base or blob/data URLs
    if (imageUrl.startsWith(BACKEND_BASE) ||
        imageUrl.startsWith('blob:') ||
        imageUrl.startsWith('data:')) {
        return imageUrl;
    }

    // Temp uploads live under uploads/temp (API returns /temp/org/file)
    if (imageUrl.startsWith('/temp/')) {
        return `${BACKEND_BASE}/uploads${imageUrl}`;
    }

    // If path starts with /pictures/, /videos/, or /vehicle_pictures/, add /uploads prefix if missing
    if (
        imageUrl.startsWith('/pictures/') ||
        imageUrl.startsWith('/videos/') ||
        imageUrl.startsWith('/vehicle_pictures/')
    ) {
        return `${BACKEND_BASE}/uploads${imageUrl}`;
    }
    
    // If path already starts with /uploads/, just add backend base
    if (imageUrl.startsWith('/uploads/')) {
        return `${BACKEND_BASE}${imageUrl}`;
    }

    // For other paths starting with /, just add backend base
    if (imageUrl.startsWith('/')) {
        return `${BACKEND_BASE}${imageUrl}`;
    }

    // Return as-is for relative URLs or other formats
    return imageUrl;
};


function formatApiDetail(detail) {
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
