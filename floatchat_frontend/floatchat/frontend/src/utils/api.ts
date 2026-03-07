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

export default API;

