import axios from 'axios';
import { io, Socket } from 'socket.io-client';

export const API_BASE = '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('shopfast_token', token);
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
    localStorage.removeItem('shopfast_token');
  }
};

// Khởi tạo token từ localStorage nếu có
const savedToken = localStorage.getItem('shopfast_token');
if (savedToken) {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}

// Socket.io singleton instance
let socketInstance: Socket | null = null;

export const getSocket = (token?: string): Socket => {
  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      auth: { token: token || localStorage.getItem('shopfast_token') || '' },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  } else if (token) {
    socketInstance.auth = { token };
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
  }
  return socketInstance;
};

