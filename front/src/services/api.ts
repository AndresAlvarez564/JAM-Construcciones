import axios from 'axios';
import config from '../config';

const api = axios.create({
  baseURL: config.apiUrl,
  headers: { 'Content-Type': 'application/json' },
});

// Adjunta el token en cada request
api.interceptors.request.use((req) => {
  const token = localStorage.getItem('access_token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

// Si el token expiró, limpia sesión y redirige al login
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
