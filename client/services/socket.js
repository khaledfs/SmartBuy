import { io } from 'socket.io-client';

// Use environment variable or fallback to the current IP
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://172.20.10.14:5000';

const socket = io(SOCKET_URL, {
  timeout: 5000,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

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

export default socket;
