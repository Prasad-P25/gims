import api from './api';
import type { Team, User } from '../types';

export const teamsService = {
  async getTeams(): Promise<Team[]> {
    const response = await api.get('/teams');
    return response.data;
  },

  async getTeam(id: string): Promise<Team> {
    const response = await api.get(`/teams/${id}`);
    return response.data;
  },

  async createTeam(data: { name: string; description?: string; admin_id?: string }): Promise<Team> {
    const response = await api.post('/teams', data);
    return response.data;
  },

  async updateTeam(id: string, data: { name?: string; description?: string; admin_id?: string; is_active?: boolean }): Promise<Team> {
    const response = await api.put(`/teams/${id}`, data);
    return response.data;
  },

  async deleteTeam(id: string): Promise<void> {
    await api.delete(`/teams/${id}`);
  },

  async getTeamMembers(teamId: string): Promise<User[]> {
    const response = await api.get(`/teams/${teamId}/members`);
    return response.data;
  },

  async addUserToTeam(teamId: string, userId: string, role: 'admin' | 'member' = 'member'): Promise<void> {
    await api.post(`/teams/${teamId}/members`, { user_id: userId, role });
  },

  async removeUserFromTeam(teamId: string, userId: string): Promise<void> {
    await api.delete(`/teams/${teamId}/members/${userId}`);
  },

  async getUnassignedUsers(): Promise<User[]> {
    const response = await api.get('/teams/unassigned-users');
    return response.data;
  },
};
