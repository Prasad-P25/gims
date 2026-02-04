import { Response } from 'express';
import { teamStatsService } from '../services/teamStats.service';
import { inAppNotificationService } from '../services/inAppNotification.service';
import { sendSuccess, sendError, sendNotFound } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { query } from '../config/database';

export class TeamStatsController {
  /**
   * Get team dashboard stats (for admin)
   */
  async getTeamDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;
    const role = req.user!.role;

    if (role !== 'admin' && role !== 'super_admin') {
      sendError(res, 'Only admins can view team dashboard', 403);
      return;
    }

    const dashboard = await teamStatsService.getTeamDashboard(userId);

    if (!dashboard) {
      sendError(res, 'No team found for this admin', 404);
      return;
    }

    sendSuccess(res, dashboard);
  }

  /**
   * Get member stats for a team
   */
  async getMemberStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;
    const teamId = req.user!.team_id;

    if (!teamId) {
      sendError(res, 'No team associated with this user', 400);
      return;
    }

    const members = await teamStatsService.getMemberStats(teamId);
    sendSuccess(res, members);
  }

  /**
   * Bulk assign tasks to a member
   */
  async bulkAssignTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;
    const { task_ids, assign_to } = req.body;

    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      sendError(res, 'task_ids array is required', 400);
      return;
    }

    if (!assign_to) {
      sendError(res, 'assign_to user ID is required', 400);
      return;
    }

    const result = await teamStatsService.bulkAssignTasks(task_ids, assign_to, userId);

    // Send notification to the assignee
    if (result.success > 0) {
      try {
        const assignerResult = await query<{ name: string }>(
          'SELECT name FROM users WHERE user_id = $1',
          [userId]
        );
        const assignerName = assignerResult.rows[0]?.name || 'Admin';

        await inAppNotificationService.createNotification({
          user_id: assign_to,
          type: 'task_assigned',
          title: '📋 Tasks Assigned',
          message: `${assignerName} assigned ${result.success} task(s) to you.`,
          triggered_by: userId,
        });
      } catch (error) {
        console.error('Failed to send bulk assignment notification:', error);
      }
    }

    sendSuccess(res, {
      message: `${result.success} task(s) assigned successfully`,
      success: result.success,
      failed: result.failed,
    });
  }

  /**
   * Quick status update for a task
   */
  async quickStatusUpdate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      sendError(res, 'Invalid status', 400);
      return;
    }

    // Get existing task
    const existingResult = await query(
      'SELECT registry_id, status, task_data, registered_by, assigned_to FROM task_registry WHERE registry_id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existingResult.rows.length === 0) {
      sendNotFound(res, 'Task not found');
      return;
    }

    const existingTask = existingResult.rows[0];
    const oldStatus = existingTask.status;

    // Update status
    const updateResult = await query(
      'UPDATE task_registry SET status = $1, updated_at = NOW() WHERE registry_id = $2 RETURNING *',
      [status, id]
    );

    // Send notifications if status changed
    if (status !== oldStatus) {
      try {
        const updaterResult = await query<{ name: string }>(
          'SELECT name FROM users WHERE user_id = $1',
          [userId]
        );
        const updaterName = updaterResult.rows[0]?.name || 'Someone';
        const taskTitle = existingTask.task_data?.title || 'Task';

        // Notify creator if different
        if (existingTask.registered_by !== userId) {
          await inAppNotificationService.notifyStatusChanged(
            existingTask.registered_by,
            taskTitle,
            status,
            userId,
            updaterName,
            id
          );
        }

        // Notify assignee if different
        if (existingTask.assigned_to && existingTask.assigned_to !== userId && existingTask.assigned_to !== existingTask.registered_by) {
          await inAppNotificationService.notifyStatusChanged(
            existingTask.assigned_to,
            taskTitle,
            status,
            userId,
            updaterName,
            id
          );
        }
      } catch (error) {
        console.error('Failed to send status notification:', error);
      }
    }

    sendSuccess(res, updateResult.rows[0], 'Status updated');
  }

  /**
   * Quick reassign task to another member
   */
  async reassignTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;
    const { id } = req.params;
    const { assign_to } = req.body;

    if (!assign_to) {
      sendError(res, 'assign_to user ID is required', 400);
      return;
    }

    // Get existing task
    const existingResult = await query(
      'SELECT registry_id, task_data, assigned_to FROM task_registry WHERE registry_id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (existingResult.rows.length === 0) {
      sendNotFound(res, 'Task not found');
      return;
    }

    const existingTask = existingResult.rows[0];

    // Update assignment
    const updateResult = await query(
      'UPDATE task_registry SET assigned_to = $1, updated_at = NOW() WHERE registry_id = $2 RETURNING *',
      [assign_to, id]
    );

    // Send notification to new assignee
    if (assign_to !== existingTask.assigned_to) {
      try {
        const assignerResult = await query<{ name: string }>(
          'SELECT name FROM users WHERE user_id = $1',
          [userId]
        );
        const assignerName = assignerResult.rows[0]?.name || 'Admin';
        const taskTitle = existingTask.task_data?.title || 'Task';

        await inAppNotificationService.notifyTaskReassigned(
          assign_to,
          taskTitle,
          userId,
          assignerName,
          id
        );
      } catch (error) {
        console.error('Failed to send reassignment notification:', error);
      }
    }

    sendSuccess(res, updateResult.rows[0], 'Task reassigned');
  }
}

export const teamStatsController = new TeamStatsController();
