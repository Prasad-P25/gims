import api from './api';
import type { Task, TaskCreateInput, TaskUpdateInput, TaskFilters, Category } from '../types';

export const tasksService = {
  async getTasks(
    params: { page?: number; limit?: number } & TaskFilters = {}
  ): Promise<{ tasks: Task[]; total: number }> {
    const { page = 1, limit = 20, ...filters } = params;
    const queryParams = new URLSearchParams();
    queryParams.append('page', String(page));
    queryParams.append('limit', String(limit));

    if (filters.category_id) queryParams.append('category_id', String(filters.category_id));
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.priority) queryParams.append('priority', filters.priority);
    if (filters.date_from) queryParams.append('date_from', filters.date_from);
    if (filters.date_to) queryParams.append('date_to', filters.date_to);
    if (filters.search) queryParams.append('search', filters.search);

    const response = await api.get(`/tasks?${queryParams}`);
    return {
      tasks: response.data.tasks || response.data || [],
      total: response.data.meta?.total || 0,
    };
  },

  async getTask(id: string): Promise<Task> {
    const response = await api.get(`/tasks/${id}`);
    return response.data;
  },

  async createTask(data: TaskCreateInput): Promise<Task> {
    const response = await api.post('/tasks', data);
    return response.data;
  },

  async updateTask(id: string, data: TaskUpdateInput): Promise<Task> {
    const response = await api.put(`/tasks/${id}`, data);
    return response.data;
  },

  async deleteTask(id: string): Promise<void> {
    await api.delete(`/tasks/${id}`);
  },

  async getCategories(): Promise<Category[]> {
    const response = await api.get('/tasks/categories');
    return response.data;
  },
};
