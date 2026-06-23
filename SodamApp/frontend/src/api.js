import axios from 'axios';

// 개발: .env에 VITE_API_URL=http://localhost:8000 설정
// 배포: 빈 문자열 → 동일 origin으로 API 요청
const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
    baseURL: `${API_BASE}/api`,
});

// Request interceptor: attach JWT token + SuperAdmin view-as header
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        // SuperAdmin "View As" feature: scope all API calls to selected business
        const viewAsBid = localStorage.getItem('view_as_business_id');
        if (viewAsBid) {
            config.headers['X-View-As-Business'] = viewAsBid;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor: handle 401 (expired / invalid token)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // 읽기전용 계정의 쓰기 시도 → 친절한 안내
        if (error.response && error.response.status === 403 &&
            typeof error.response.data?.detail === 'string' &&
            error.response.data.detail.includes('읽기 전용')) {
            alert('🔒 읽기 전용 계정입니다. 조회만 가능하며 수정/등록/삭제는 할 수 없습니다.');
            return Promise.reject(error);
        }
        if (error.response && error.response.status === 401) {
            // Token expired or invalid — clear session and redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('user_role');
            localStorage.removeItem('user_name');
            localStorage.removeItem('user_grade');
            localStorage.removeItem('profile_image');
            localStorage.removeItem('staff_id');

            // Only redirect if not already on login page
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
