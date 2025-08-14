import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventEmitter from 'eventemitter3';

// API configuration - change IP address to match your computer
// You can set this via environment variable or change directly here
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://172.20.10.6:5000/api';
const api = axios.create({ baseURL: API_BASE_URL });

// Performance optimization: Add request caching
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds cache

// Cached GET function for better performance
const cachedGet = async (url, options = {}) => {
  const cacheKey = `${url}-${JSON.stringify(options)}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`📦 Cache hit for: ${url}`);
    return cached.data;
  }
  
  console.log(`🌐 Fetching: ${url}`);
  const response = await api.get(url, options);
  
  cache.set(cacheKey, {
    data: response,
    timestamp: Date.now()
  });
  
  return response;
};

// Clear cache function
const clearCache = () => {
  cache.clear();
  console.log('🧹 Cache cleared');
};

// Export cached functions
export { cachedGet, clearCache };

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add a response interceptor to handle 401 errors globally
export const apiEventEmitter = new EventEmitter();

api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response && error.response.status === 401) {
      await AsyncStorage.removeItem('token');
      apiEventEmitter.emit('logout');
    }
    return Promise.reject(error);
  }
);

export default api;