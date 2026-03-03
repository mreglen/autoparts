import axios from 'axios';


const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://svoygarage.ru/server/api';
const BACKEND_BASE = process.env.REACT_APP_BACKEND_BASE_URL || 'https://svoygarage.ru';

// const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://VM2512296768.vds.ru/api';
// const BACKEND_BASE = process.env.REACT_APP_BACKEND_BASE_URL || 'https://VM2512296768.vds.ru';

// const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://195.24.65.251/api';
// const BACKEND_BASE = process.env.REACT_APP_BACKEND_BASE_URL || 'https://195.24.65.251';
// локально

// const API_BASE = 'http://127.0.0.1:8000/api';
// const BACKEND_BASE = 'http://127.0.0.1:8000';

// const API_BASE = 'http://localhost:3000/api';
// const BACKEND_BASE = 'http://localhost:3000';

export const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};


export const normalizeImageUrl = (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== 'string') return imageUrl;

    if (imageUrl.startsWith(BACKEND_BASE) ||
        imageUrl.startsWith('blob:') ||
        imageUrl.startsWith('data:')) {
        return imageUrl;
    }

    // For other absolute URLs, return as is
    return imageUrl;
};

// Generic fetch wrapper for API calls
export const apiRequest = async (endpoint, options = {}) => {
    const url = `${API_BASE}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
            ...options.headers
        },
        ...options
    };

    const response = await fetch(url, defaultOptions);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
        return { status: 204, message: 'No Content' };
    }

    return response.json();
};

// Unauthenticated API request function
export const apiRequestUnauth = async (endpoint, options = {}) => {
    const url = `${API_BASE}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    const response = await fetch(url, defaultOptions);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
        return { status: 204, message: 'No Content' };
    }

    return response.json();
};

// For FormData requests (like file uploads)
export const apiRequestFormData = async (endpoint, formData, options = {}) => {
    const url = `${API_BASE}${endpoint}`;

    const defaultOptions = {
        method: 'POST', // Explicitly set POST method for uploads
        headers: {
            ...getAuthHeaders(),
            ...options.headers
        },
        ...options
    };

    const response = await fetch(url, {
        ...defaultOptions,
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
};

// Axios instance for backward compatibility (if needed)
export const apiAxios = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to axios requests
apiAxios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Axios instance without authentication
export const apiAxiosUnauth = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default apiRequest;
