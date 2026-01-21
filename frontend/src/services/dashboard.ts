import api from './api';
import type { DashboardStats, Task, Category } from '../types';

interface CategoryStat {
  category_id: number;
  name_english: string;
  name_marathi: string;
  task_count: number;
}

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },

  async getCategoryStats(): Promise<CategoryStat[]> {
    const response = await api.get('/dashboard/category-stats');
    return response.data.categories || [];
  },

  async getRecentTasks(limit = 10): Promise<Task[]> {
    const response = await api.get(`/dashboard/recent?limit=${limit}`);
    return response.data.tasks || [];
  },

  async getCategories(): Promise<Category[]> {
    const response = await api.get('/tasks/categories');
    return response.data;
  },
};
