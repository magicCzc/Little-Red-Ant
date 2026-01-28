import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// Request Interceptor
axios.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            useAuthStore.getState().logout();
            // Optional: Redirect to login is handled by RequireAuth component usually
            // window.location.href = '/login'; 
        }
        return Promise.reject(error);
    }
);

export default axios;
