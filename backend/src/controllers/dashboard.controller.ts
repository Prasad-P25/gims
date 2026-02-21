import { Response } from 'express';
import { taskService } from '../services/task.service';
import { query } from '../config/database';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';

export class DashboardController {
  /**
   * Build role-based WHERE conditions for dashboard queries
   */
  private buildRoleFilter(user: { user_id: string; role: string; team_id?: string }): { condition: string; params: unknown[] } {
    if (user.role === 'member') {
      return {
        condition: 'AND (tr.registered_by = $1 OR tr.assigned_to = $1)',
        params: [user.user_id],
      };
    } else if (user.role === 'admin' && user.team_id) {
      return {
        condition: `AND (
          tr.registered_by IN (SELECT user_id FROM users WHERE team_id = $1 AND deleted_at IS NULL)
          OR tr.assigned_to IN (SELECT user_id FROM users WHERE team_id = $1 AND deleted_at IS NULL)
        )`,
        params: [user.team_id],
      };
    }
    // super_admin sees all
    return { condition: '', params: [] };
  }

  /**
   * Get dashboard statistics
   * Role-based: members see only their own tasks
   */
  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user!;
    const { condition, params } = this.buildRoleFilter({
      user_id: user.user_id,
      role: user.role,
      team_id: user.team_id,
    });

    // All counts in a single efficient query
    const sql = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE tr.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE tr.status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE tr.status = 'completed') as completed,
        COUNT(*) FILTER (WHERE tr.status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE tr.registration_date = CURRENT_DATE) as today,
        COUNT(*) FILTER (WHERE tr.status = 'completed' AND DATE(tr.updated_at) = CURRENT_DATE) as completed_today,
        COUNT(*) FILTER (WHERE tr.status = 'pending' AND tr.created_at < NOW() - INTERVAL '24 hours') as overdue
      FROM task_registry tr
      WHERE tr.deleted_at IS NULL ${condition}
    `;

    const result = await query(sql, params);
    const stats = result.rows[0];

    sendSuccess(res, {
      total: parseInt(stats.total, 10),
      pending: parseInt(stats.pending, 10),
      in_progress: parseInt(stats.in_progress, 10),
      completed: parseInt(stats.completed, 10),
      cancelled: parseInt(stats.cancelled, 10),
      today: parseInt(stats.today, 10),
      completed_today: parseInt(stats.completed_today, 10),
      overdue: parseInt(stats.overdue, 10),
    });
  }

  /**
   * Get category breakdown
   * Role-based: members see only their own tasks per category
   */
  async getCategoryBreakdown(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user!;
    const userContext = {
      user_id: user.user_id,
      role: user.role,
      team_id: user.team_id,
    };

    // Get all categories
    const categories = await taskService.getCategories();

    // Get tasks filtered by user role
    const { tasks } = await taskService.getTasks({}, { page: 1, limit: 1000 }, userContext);

    // Count tasks per category from filtered tasks
    const categoryStats = categories.map(cat => {
      const taskCount = tasks.filter(t => t.category_id === cat.category_id).length;
      return {
        category_id: cat.category_id,
        name_english: cat.name_english,
        name_marathi: cat.name_marathi,
        task_count: taskCount,
      };
    });

    sendSuccess(res, { categories: categoryStats });
  }

  /**
   * Get recent tasks
   * Role-based: members see only their own tasks
   */
  async getRecentTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    const limit = Number(req.query.limit) || 10;
    const user = req.user!;
    const userContext = {
      user_id: user.user_id,
      role: user.role,
      team_id: user.team_id,
    };

    const { tasks } = await taskService.getTasks(
      {},
      { page: 1, limit, sortBy: 'created_at', sortOrder: 'desc' },
      userContext
    );

    sendSuccess(res, { tasks });
  }

  /**
   * Get daily summary
   */
  async getDailySummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    const dateParam = req.query.date as string;
    const date = dateParam ? new Date(dateParam) : new Date();

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const stats = await taskService.getTaskStats(startOfDay, endOfDay);

    sendSuccess(res, {
      date: date.toISOString().split('T')[0],
      summary: stats,
    });
  }

  /**
   * Get trends over time
   */
  async getTrends(req: AuthenticatedRequest, res: Response): Promise<void> {
    const period = (req.query.period as string) || 'month';

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const stats = await taskService.getTaskStats(startDate, endDate);

    sendSuccess(res, {
      period,
      dateRange: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
      },
      stats,
    });
  }

  /**
   * Get overdue/pending tasks
   */
  async getOverdueTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    const pendingTasks = await taskService.getPendingTasks();

    // Filter tasks older than 24 hours as "overdue"
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const overdueTasks = pendingTasks.filter(
      (task) => new Date(task.created_at) < oneDayAgo
    );

    sendSuccess(res, {
      tasks: overdueTasks,
      count: overdueTasks.length,
    });
  }
}

export const dashboardController = new DashboardController();
