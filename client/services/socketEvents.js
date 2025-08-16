// services/socketEvents.js
import { getSocket } from './socket';

// Helper function to get socket instance
const getSocketInstance = () => {
  const socket = getSocket();
  if (!socket) {
    console.warn('⚠️ Socket not initialized. Call initializeSocket() first.');
    return null;
  }
  return socket;
};

// Initialize socket event listeners when socket is available
let socket = null;

const initializeSocketListeners = () => {
  socket = getSocketInstance();
  if (!socket) return;

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
  });

  socket.on('joinedGroup', (data) => {
    console.log('👥 Joined group room:', data);
  });

  socket.on('listUpdate', (data) => {
    console.log('📢 Received listUpdate:', data);
  });
};

// Initialize listeners when module loads
setTimeout(initializeSocketListeners, 100);

/**
 * Listen for group changes (e.g. members added/removed, group deleted)
 * @param {Function} callback - function to run when groupUpdate is received
 * @returns {Function} unsubscribe function
 */
export function registerGroupUpdates(callback) {
  const socket = getSocketInstance();
  if (!socket) return () => {};
  
  socket.on('groupUpdate', callback);
  return () => socket.off('groupUpdate', callback);
}

/**
 * Listen for shopping list changes (e.g. item added/removed/changed)
 * @param {Function} callback - function to run when listUpdate is received
 * @returns {Function} unsubscribe function
 */
export function registerListUpdates(callback) {
  const socket = getSocketInstance();
  if (!socket) return () => {};
  
  socket.on('listUpdate', (data) => {
    console.log('📢 List update received in registerListUpdates:', data);
    callback(data);
  });
  return () => socket.off('listUpdate', callback);
}

/**
 * Listen for suggestion updates (favorites, purchases, etc.)
 * @param {Function} callback - function to run when suggestionUpdate is received
 * @returns {Function} unsubscribe function
 */
export function registerSuggestionUpdates(callback) {
  const socket = getSocketInstance();
  if (!socket) return () => {};
  
  socket.on('suggestionUpdate', (data) => {
    console.log('📊 Suggestion update received:', data);
    callback(data);
  });
  return () => socket.off('suggestionUpdate', callback);
}

export function registerGroupNotifications(callback) {
  const socket = getSocketInstance();
  if (!socket) return () => {};
  
  socket.on('groupCreated', (data) => {
    console.log('👥 Group created notification received:', data);
    callback(data);
  });
  
  socket.on('memberAdded', (data) => {
    console.log('👥 Member added notification received:', data);
    callback(data);
  });
  
  return () => {
    socket.off('groupCreated', callback);
    socket.off('memberAdded', callback);
  };
}

/**
 * Emit that the user is joining a socket room (group or list)
 * @param {string} roomId - groupId or listId
 */
export function joinRoom(roomId) {
  const socket = getSocketInstance();
  if (!socket) return;
  
  socket.emit('joinGroup', roomId);
}

export function joinListRoom(listId) {
  const socket = getSocketInstance();
  if (!socket) return;
  
  socket.emit('joinList', listId);
}

export function emitListUpdate(listId) {
  const socket = getSocketInstance();
  if (!socket) return;
  
  socket.emit('listUpdate', { listId });
}
