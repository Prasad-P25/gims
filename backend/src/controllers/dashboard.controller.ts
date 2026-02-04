import { Response } from 'express';
import { taskService } from '../services/task.service';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';

export class DashboardController {
  /**
   * Get dashboard statistics
   * Role-based: members see only their own tasks
   */
  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user!;
    const userContext = {
      user_id: user.user_id,
      role: user.role,
      team_id: user.team_id,
    };

    // Get stats filtered by user role
    const { tasks, meta } = await taskService.getTasks({}, { page: 1, limit: 1000 }, userContext);

    const total = meta.total;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const cancelled = tasks.filter(t => t.status === 'cancelled').length;

    const today = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => t.registration_date?.toString().startsWith(today));
    const completedToday = todayTasks.filter(t => t.status === 'completed').length;

    sendSuccess(res, {
      total,
      pending,
      in_progress: inProgress,
      completed,
      cancelled,
      today: todayTasks.length,
      completed_today: completedToday,
      overdue: pending, // Tasks pending would be considered for overdue
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
