import api from './api';

export interface Notification {
  notification_id: string;
  user_id: string;
  type: 'task_assigned' | 'status_changed' | 'task_completed' | 'task_reassigned';
  title: string;
  message: string;
  registry_id?: string;
  triggered_by?: string;
  triggered_by_name?: string;
  is_read: boolean;
  read_at?: string;
  telegram_sent: boolean;
  created_at: string;
}

export const notificationsService = {
  async getUnreadNotifications(): Promise<Notification[]> {
    const response = await api.get('/notifications/unread');
    return response.data;
  },

  async getNotifications(page: number = 1, limit: number = 20): Promise<{
    notifications: Notification[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const response = await api.get(`/notifications?page=${page}&limit=${limit}`);
    return response.data;
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get('/notifications/count');
    return response.data.count;
  },

  async markAsRead(notificationId: string): Promise<void> {
    await api.post(`/notifications/${notificationId}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.post('/notifications/read-all');
  },
};
