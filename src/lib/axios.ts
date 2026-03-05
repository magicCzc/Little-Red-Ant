import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';

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
        // Check if this request specifically asked to skip global error handling
        if (error.config && error.config.skipAuthRefresh) {
            return Promise.reject(error);
        }

        if (error.response?.status === 401) {
            // Token expired or invalid
            // Avoid auto-logout which causes data loss. Warn user instead.
            console.warn('Unauthorized (401) detected. Token might be invalid.');
            
            // Only logout if we are not already on login page to avoid loops
            if (!window.location.pathname.includes('/login')) {
                 toast.error('系统登录状态可能已失效，请保存工作后重新登录。', { id: 'auth-error', duration: 5000 });
                 // useAuthStore.getState().logout(); // Disable auto-logout for stability
            }
        }
        return Promise.reject(error);
    }
);

export default axios;
