import { query } from '../config/database';
import { logger } from '../utils/logger';

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

class TeamStatsService {
  /**
   * Get team dashboard stats for an admin
   */
  async getTeamDashboard(adminUserId: string): Promise<TeamDashboardStats | null> {
    // Get admin's team
    const teamResult = await query<{ team_id: string; name: string }>(
      `SELECT t.team_id, t.name
       FROM teams t
       JOIN users u ON u.team_id = t.team_id
       WHERE u.user_id = $1 AND u.role = 'admin'`,
      [adminUserId]
    );

    if (teamResult.rows.length === 0) {
      return null;
    }

    const team = teamResult.rows[0];

    // Get member count
    const memberCountResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users
       WHERE team_id = $1 AND role = 'member' AND deleted_at IS NULL AND is_active = true`,
      [team.team_id]
    );

    // Get team task stats
    const taskStatsResult = await query<{
      total: string;
      pending: string;
      in_progress: string;
      completed: string;
      overdue: string;
    }>(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE tr.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE tr.status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE tr.status = 'completed') as completed,
        COUNT(*) FILTER (WHERE tr.status = 'pending' AND NULLIF(tr.task_data->>'due_date', '')::date < CURRENT_DATE) as overdue
       FROM task_registry tr
       WHERE tr.deleted_at IS NULL
         AND (tr.assigned_to IN (SELECT user_id FROM users WHERE team_id = $1 AND deleted_at IS NULL)
              OR tr.registered_by IN (SELECT user_id FROM users WHERE team_id = $1 AND deleted_at IS NULL))`,
      [team.team_id]
    );

    const stats = taskStatsResult.rows[0];
    const total = parseInt(stats.total, 10);
    const completed = parseInt(stats.completed, 10);

    // Get per-member stats
    const members = await this.getMemberStats(team.team_id);

    return {
      team_id: team.team_id,
      team_name: team.name,
      total_members: parseInt(memberCountResult.rows[0].count, 10),
      total_tasks: total,
      pending_tasks: parseInt(stats.pending, 10),
      in_progress_tasks: parseInt(stats.in_progress, 10),
      completed_tasks: completed,
      overdue_tasks: parseInt(stats.overdue, 10),
      completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      members,
    };
  }

  /**
   * Get stats for each member in a team
   */
  async getMemberStats(teamId: string): Promise<MemberStats[]> {
    const result = await query<{
      user_id: string;
      name: string;
      total_tasks: string;
      pending_tasks: string;
      in_progress_tasks: string;
      completed_tasks: string;
      overdue_tasks: string;
      completed_this_week: string;
    }>(
      `SELECT
        u.user_id,
        u.name,
        COUNT(tr.registry_id) as total_tasks,
        COUNT(tr.registry_id) FILTER (WHERE tr.status = 'pending') as pending_tasks,
        COUNT(tr.registry_id) FILTER (WHERE tr.status = 'in_progress') as in_progress_tasks,
        COUNT(tr.registry_id) FILTER (WHERE tr.status = 'completed') as completed_tasks,
        COUNT(tr.registry_id) FILTER (WHERE tr.status = 'pending' AND NULLIF(tr.task_data->>'due_date', '')::date < CURRENT_DATE) as overdue_tasks,
        COUNT(tr.registry_id) FILTER (WHERE tr.status = 'completed' AND tr.updated_at >= CURRENT_DATE - INTERVAL '7 days') as completed_this_week
       FROM users u
       LEFT JOIN task_registry tr ON (tr.assigned_to = u.user_id OR tr.registered_by = u.user_id) AND tr.deleted_at IS NULL
       WHERE u.team_id = $1 AND u.role = 'member' AND u.deleted_at IS NULL AND u.is_active = true
       GROUP BY u.user_id, u.name
       ORDER BY u.name`,
      [teamId]
    );

    return result.rows.map(row => {
      const total = parseInt(row.total_tasks, 10);
      const completed = parseInt(row.completed_tasks, 10);
      return {
        user_id: row.user_id,
        name: row.name,
        total_tasks: total,
        pending_tasks: parseInt(row.pending_tasks, 10),
        in_progress_tasks: parseInt(row.in_progress_tasks, 10),
        completed_tasks: completed,
        overdue_tasks: parseInt(row.overdue_tasks, 10),
        completed_this_week: parseInt(row.completed_this_week, 10),
        completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
  }

  /**
   * Bulk assign tasks to a member
   */
  async bulkAssignTasks(
    taskIds: string[],
    assignToUserId: string,
    assignedByUserId: string
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const taskId of taskIds) {
      try {
        const result = await query(
          `UPDATE task_registry
           SET assigned_to = $1, updated_at = NOW()
           WHERE registry_id = $2 AND deleted_at IS NULL
           RETURNING registry_id`,
          [assignToUserId, taskId]
        );

        if (result.rows.length > 0) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        logger.error('Failed to assign task', { taskId, error });
      }
    }

    logger.info('Bulk assignment completed', { success, failed, assignedBy: assignedByUserId });
    return { success, failed };
  }

  /**
   * Get tasks filtered by member (for admin view)
   */
  async getTasksByMember(
    teamId: string,
    memberId?: string,
    status?: string,
    page: number = 1,
    limit: number = 20
  ) {
    const offset = (page - 1) * limit;
    const conditions: string[] = ['tr.deleted_at IS NULL'];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Filter by team
    conditions.push(`(tr.assigned_to IN (SELECT user_id FROM users WHERE team_id = $${paramIndex})
                     OR tr.registered_by IN (SELECT user_id FROM users WHERE team_id = $${paramIndex}))`);
    values.push(teamId);
    paramIndex++;

    // Filter by specific member
    if (memberId) {
      conditions.push(`(tr.assigned_to = $${paramIndex} OR tr.registered_by = $${paramIndex})`);
      values.push(memberId);
      paramIndex++;
    }

    // Filter by status
    if (status) {
      conditions.push(`tr.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Count total
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM task_registry tr WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get tasks
    const tasksResult = await query(
      `SELECT
        tr.*,
        c.name_english as category_name_english,
        c.name_marathi as category_name_marathi,
        u.name as registered_by_name,
        ua.name as assigned_to_name
       FROM task_registry tr
       JOIN categories c ON tr.category_id = c.category_id
       LEFT JOIN users u ON tr.registered_by = u.user_id
       LEFT JOIN users ua ON tr.assigned_to = ua.user_id
       WHERE ${whereClause}
       ORDER BY tr.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      tasks: tasksResult.rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const teamStatsService = new TeamStatsService();
