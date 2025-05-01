import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
const api = axios.create({ baseURL: 'http://10.0.2.2:3000/api' });

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('token');      // or AsyncStorage.getItem
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;