// src/utils/api.js
import axios from 'axios';

const api = axios.create({
  // Use CRA env var, fallback to localhost for local dev
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;