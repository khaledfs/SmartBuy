// services/socketEvents.js
import socket from './socket';

/**
 * Listen for group changes (e.g. members added/removed, group deleted)
 * @param {Function} callback - function to run when groupUpdate is received
 * @returns {Function} unsubscribe function
 */
export function registerGroupUpdates(callback) {
  socket.on('groupUpdate', callback);
  return () => socket.off('groupUpdate', callback);
}

/**
 * Listen for shopping list changes (e.g. item added/removed/changed)
 * @param {Function} callback - function to run when listUpdate is received
 * @returns {Function} unsubscribe function
 */
export function registerListUpdates(callback) {
  socket.on('listUpdate', callback);
  return () => socket.off('listUpdate', callback);
}

/**
 * Emit that the user is joining a socket room (group or list)
 * @param {string} roomId - groupId or listId
 */
export function joinRoom(roomId) {
  socket.emit('joinGroup', roomId);
}

export function joinListRoom(listId) {
  socket.emit('joinList', listId);
}

export function emitListUpdate(listId) {
  socket.emit('listUpdate', { listId });
}
