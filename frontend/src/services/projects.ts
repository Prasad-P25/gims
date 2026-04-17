import api from './api';
import type {
  Project,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectTeamAssignment,
  ProjectDashboardStats,
} from '../types';

export const projectsService = {
  async list(status?: string): Promise<Project[]> {
    const response = await api.get('/projects', { params: status ? { status } : undefined });
    return response.data;
  },

  async mine(): Promise<Project[]> {
    const response = await api.get('/projects/mine');
    return response.data;
  },

  async get(id: string): Promise<Project> {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },

  async create(data: ProjectCreateInput): Promise<Project> {
    const response = await api.post('/projects', data);
    return response.data;
  },

  async update(id: string, data: ProjectUpdateInput): Promise<Project> {
    const response = await api.put(`/projects/${id}`, data);
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/projects/${id}`);
  },

  async getTeams(id: string): Promise<ProjectTeamAssignment[]> {
    const response = await api.get(`/projects/${id}/teams`);
    return response.data;
  },

  async assignTeams(id: string, teamIds: string[]): Promise<ProjectTeamAssignment[]> {
    const response = await api.post(`/projects/${id}/teams`, { team_ids: teamIds });
    return response.data;
  },

  async removeTeam(id: string, teamId: string): Promise<void> {
    await api.delete(`/projects/${id}/teams/${teamId}`);
  },

  async dashboard(id: string): Promise<ProjectDashboardStats> {
    const response = await api.get(`/projects/${id}/dashboard`);
    return response.data;
  },
};
