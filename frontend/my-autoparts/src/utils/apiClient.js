import axios from 'axios';


const API_BASE = process.env.REACT_APP_API_BASE_URL;
const BACKEND_BASE = process.env.REACT_APP_BACKEND_BASE_URL;


console.log('REACT_APP_API_BASE_URL', process.env.REACT_APP_API_BASE_URL);
console.log('REACT_APP_BACKEND_BASE_URL', process.env.REACT_APP_BACKEND_BASE_URL);
console.log('API_BASE:', API_BASE);
console.log('BACKEND_BASE:', BACKEND_BASE);


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

    // If path starts with /pictures/ or /videos/, add /uploads prefix if missing
    if (imageUrl.startsWith('/pictures/') || imageUrl.startsWith('/videos/')) {
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


    if (response.status === 204) {
        return { status: 204, message: 'No Content' };
    }

    return response.json();
};


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
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
};


export const apiAxios = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});


apiAxios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});


export const apiAxiosUnauth = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default apiRequest;
