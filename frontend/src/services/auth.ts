import api from './api';
import type { LoginResponse, User } from '../types';

export const authService = {
  async login(phone: string, password: string): Promise<LoginResponse> {
    const response = await api.post('/auth/login', { phone, password });
    return response.data;
  },

  async getProfile(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await api.put('/auth/me', data);
    return response.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },

  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },
};
