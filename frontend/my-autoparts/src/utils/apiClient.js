import axios from 'axios';



const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';
const BACKEND_BASE = process.env.REACT_APP_BACKEND_BASE_URL || 'http://127.0.0.1:8000';

// const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://svoygarage.ru/server/api';
// const BACKEND_BASE = process.env.REACT_APP_BACKEND_BASE_URL || 'https://svoygarage.ru/server';


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

  
    if (imageUrl.startsWith(BACKEND_BASE) ||
        imageUrl.startsWith('blob:') ||
        imageUrl.startsWith('data:')) {
        return imageUrl;
    }

   
    // Replace /pictures/ and /videos/ with /media/ to use CORS-enabled endpoint
    if (imageUrl.startsWith('/pictures/') || imageUrl.startsWith('/videos/')) {
        const path = imageUrl.startsWith('/pictures/') 
            ? imageUrl.replace('/pictures/', '') 
            : imageUrl.replace('/videos/', '');
        
        // Determine original type
        const type = imageUrl.startsWith('/pictures/') ? 'pictures' : 'videos';
        
        // Use /media/ endpoint for CORS support
        return `${BACKEND_BASE}/media/${type}/${path}`;
    }
    
    if (imageUrl.startsWith('/')) {
        return `${BACKEND_BASE}${imageUrl}`;
    }


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

    const defaultOptions = {
        method: 'POST',
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
