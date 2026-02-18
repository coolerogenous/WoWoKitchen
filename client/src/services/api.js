import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 请求拦截器：自动添加 JWT token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('wk_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 响应拦截器：处理 401
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('wk_token');
            localStorage.removeItem('wk_user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    getProfile: () => api.get('/auth/profile'),
};

// Ingredient API
export const ingredientAPI = {
    getAll: () => api.get('/ingredients'),
    getOne: (id) => api.get(`/ingredients/${id}`),
    create: (data) => api.post('/ingredients', data),
    update: (id, data) => api.put(`/ingredients/${id}`, data),
    delete: (id) => api.delete(`/ingredients/${id}`),
};

// Dish API
export const dishAPI = {
    getAll: () => api.get('/dishes'),
    getOne: (id) => api.get(`/dishes/${id}`),
    create: (data) => api.post('/dishes', data),
    update: (id, data) => api.put(`/dishes/${id}`, data),
    delete: (id) => api.delete(`/dishes/${id}`),
};

// Menu API
export const menuAPI = {
    getAll: () => api.get('/menus'),
    getOne: (id) => api.get(`/menus/${id}`),
    create: (data) => api.post('/menus', data),
    update: (id, data) => api.put(`/menus/${id}`, data),
    delete: (id) => api.delete(`/menus/${id}`),
    getShoppingList: (id) => api.get(`/menus/${id}/shopping-list`),
};

// Token API (密语系统)
export const tokenAPI = {
    exportDish: (id) => api.post(`/tokens/export/dish/${id}`),
    exportMenu: (id) => api.post(`/tokens/export/menu/${id}`),
    importByCode: (code) => api.post('/tokens/import', { code }),
};

// Party API
export const partyAPI = {
    create: (data) => api.post('/parties', data),
    getMyParties: () => api.get('/parties/my'),
    update: (id, data) => api.put(`/parties/${id}`, data),
    delete: (id) => api.delete(`/parties/${id}`),
    getByShareCode: (code) => api.get(`/parties/join/${code}`),
    joinAsGuest: (code, data) => api.post(`/parties/join/${code}/guest`, data),
    addDish: (code, data) => api.post(`/parties/join/${code}/add-dish`, data),
    removeDish: (dishId) => api.delete(`/parties/dish/${dishId}`),
    updateDishServings: (dishId, servings) => api.put(`/parties/dish/${dishId}/servings`, { servings }),
    getShoppingList: (code) => api.get(`/parties/join/${code}/shopping-list`),
    toggleLock: (id) => api.put(`/parties/${id}/toggle-lock`),
};

export default api;
