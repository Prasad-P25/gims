import { Response } from 'express';
import { taskService } from '../services/task.service';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';

export class DashboardController {
  /**
   * Get dashboard statistics
   */
  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    const stats = await taskService.getTaskStats();
    const todayTasks = await taskService.getTodaysTasks();

    sendSuccess(res, {
      ...stats,
      todayTasks: todayTasks.length,
    });
  }

  /**
   * Get category breakdown
   */
  async getCategoryBreakdown(req: AuthenticatedRequest, res: Response): Promise<void> {
    const stats = await taskService.getTaskStats();
    sendSuccess(res, { categories: stats.byCategory });
  }

  /**
   * Get recent tasks
   */
  async getRecentTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    const limit = Number(req.query.limit) || 10;

    const { tasks } = await taskService.getTasks(
      {},
      { page: 1, limit, sortBy: 'created_at', sortOrder: 'desc' }
    );

    sendSuccess(res, tasks);
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
