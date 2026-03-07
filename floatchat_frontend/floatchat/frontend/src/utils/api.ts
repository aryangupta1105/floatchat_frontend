import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_URL || "/api";

const API = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Normalize error responses so .data.error is always a string (never an object)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.data) {
      const d = error.response.data;
      // Vercel/backend may return { code, message } or { error: { code, message } }
      if (typeof d.error === 'object' && d.error !== null) {
        error.response.data.error = d.error.message || 'Something went wrong';
      } else if (typeof d === 'object' && d.code && d.message && !d.error) {
        error.response.data = { error: d.message };
      }
    }
    return Promise.reject(error);
  }
);

export default API;

