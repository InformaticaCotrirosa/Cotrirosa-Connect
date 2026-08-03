import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '') || 'http://localhost:3001';

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}
