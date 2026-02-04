import api from './api';

export interface MemberStats {
  user_id: string;
  name: string;
  total_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  completed_this_week: number;
  completion_rate: number;
}

export interface TeamDashboardStats {
  team_id: string;
  team_name: string;
  total_members: number;
  total_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  members: MemberStats[];
}

export const teamStatsService = {
  async getTeamDashboard(): Promise<TeamDashboardStats> {
    const response = await api.get('/team-stats/dashboard');
    return response.data;
  },

  async getMemberStats(): Promise<MemberStats[]> {
    const response = await api.get('/team-stats/members');
    return response.data;
  },

  async bulkAssignTasks(taskIds: string[], assignTo: string): Promise<{ success: number; failed: number }> {
    const response = await api.post('/team-stats/bulk-assign', {
      task_ids: taskIds,
      assign_to: assignTo,
    });
    return response.data;
  },

  async quickStatusUpdate(taskId: string, status: string): Promise<void> {
    await api.patch(`/team-stats/tasks/${taskId}/status`, { status });
  },

  async reassignTask(taskId: string, assignTo: string): Promise<void> {
    await api.patch(`/team-stats/tasks/${taskId}/reassign`, { assign_to: assignTo });
  },
};
