import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use environment variable or fallback to the current IP
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://172.20.10.14:5000';

// Create socket with authentication
const createSocket = async () => {
  const token = await AsyncStorage.getItem('token');
  
  return io(SOCKET_URL, {
    timeout: 5000,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    auth: {
      token: token
    }
  });
};

// Initialize socket
let socket = null;

// Function to initialize or reconnect socket with fresh token
export const initializeSocket = async () => {
  if (socket) {
    socket.disconnect();
  }
  socket = await createSocket();
  
  // Add connection event listeners for debugging
  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
  });

  socket.on('reconnect_error', (error) => {
    console.error('❌ Socket reconnection error:', error);
  });
  
  return socket;
};

// Get current socket instance
export const getSocket = () => socket;

// Function to initialize socket after successful login
export const initializeSocketAfterLogin = async () => {
  try {
    console.log('🔌 Initializing socket after login...');
    await initializeSocket();
    console.log('✅ Socket initialized successfully after login');
  } catch (error) {
    console.error('❌ Failed to initialize socket after login:', error);
  }
};

// Function to disconnect socket on logout
export const disconnectSocket = () => {
  if (socket) {
    console.log('🔌 Disconnecting socket...');
    socket.disconnect();
    socket = null;
    console.log('✅ Socket disconnected');
  }
};

// Default export for backward compatibility
export default getSocket;
