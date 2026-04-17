import { Request, Response } from 'express';
import { taskService } from '../services/task.service';
import { geminiService } from '../services/gemini.service';
import { inAppNotificationService } from '../services/inAppNotification.service';
import { sendSuccess, sendCreated, sendNoContent, sendNotFound, sendError } from '../utils/response';
import { AuthenticatedRequest, TaskFilters, PaginationParams, UserContext } from '../types';
import { query } from '../config/database';

export class TaskController {
  /**
   * Get all tasks with filters and pagination
   * Filtered by user role:
   * - super_admin: all tasks
   * - admin: team tasks
   * - member: own tasks only
   */
  async getTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filters: TaskFilters = {
      category_id: req.query.category_id ? Number(req.query.category_id) : undefined,
      status: req.query.status as TaskFilters['status'],
      priority: req.query.priority as TaskFilters['priority'],
      registered_by: req.query.registered_by as string,
      assigned_to: req.query.assigned_to as string,
      team_id: req.query.team_id as string,
      project_id: req.query.project_id as string,
      date_from: req.query.date_from ? new Date(req.query.date_from as string) : undefined,
      date_to: req.query.date_to ? new Date(req.query.date_to as string) : undefined,
      search: req.query.search as string,
    };

    const pagination: PaginationParams = {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      sortBy: req.query.sortBy as string,
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    };

    // Build user context for role-based filtering
    const userContext: UserContext | undefined = req.user ? {
      user_id: req.user.user_id,
      role: req.user.role,
      team_id: req.user.team_id,
    } : undefined;

    const { tasks, meta } = await taskService.getTasks(filters, pagination, userContext);
    sendSuccess(res, { tasks, meta });
  }

  /**
   * Get single task by ID
   */
  async getTaskById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const task = await taskService.getTaskWithCategory(id);

    if (!task) {
      sendNotFound(res, 'Task not found');
      return;
    }

    sendSuccess(res, task);
  }

  /**
   * Create new task
   */
  async createTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;

    // Auto-assign task to the member who created it (if no explicit assignment)
    if (req.user!.role === 'member' && !req.body.assigned_to) {
      req.body.assigned_to = userId;
    }

    const task = await taskService.createTask(req.body, userId);

    // Send notification if task is assigned to someone
    if (task.assigned_to && task.assigned_to !== userId) {
      try {
        // Get creator's name
        const creatorResult = await query<{ name: string }>(
          'SELECT name FROM users WHERE user_id = $1',
          [userId]
        );
        const creatorName = creatorResult.rows[0]?.name || 'Someone';
        const taskTitle = (task.task_data as any)?.title || 'New Task';

        await inAppNotificationService.notifyTaskAssigned(
          task.assigned_to,
          taskTitle,
          userId,
          creatorName,
          task.registry_id
        );
      } catch (error) {
        // Don't fail the request if notification fails
        console.error('Failed to send assignment notification:', error);
      }
    }

    sendCreated(res, task, 'Task created successfully');
  }

  /**
   * Update task
   */
  async updateTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user!.user_id;

    // Get existing task to compare changes
    const existingTask = await taskService.getTaskById(id);
    if (!existingTask) {
      sendNotFound(res, 'Task not found');
      return;
    }

    const oldAssignedTo = existingTask.assigned_to;
    const oldStatus = existingTask.status;

    const task = await taskService.updateTask(id, req.body, userId);

    if (!task) {
      sendNotFound(res, 'Task not found');
      return;
    }

    // Get updater's name for notifications
    const updaterResult = await query<{ name: string }>(
      'SELECT name FROM users WHERE user_id = $1',
      [userId]
    );
    const updaterName = updaterResult.rows[0]?.name || 'Someone';
    const taskTitle = (task.task_data as any)?.title || 'Task';

    try {
      // Notify if assignment changed
      if (req.body.assigned_to && req.body.assigned_to !== oldAssignedTo && req.body.assigned_to !== userId) {
        await inAppNotificationService.notifyTaskAssigned(
          req.body.assigned_to,
          taskTitle,
          userId,
          updaterName,
          task.registry_id
        );
      }

      // Notify if status changed
      if (req.body.status && req.body.status !== oldStatus) {
        // Notify the task creator (registered_by) if different from updater
        if (task.registered_by !== userId) {
          await inAppNotificationService.notifyStatusChanged(
            task.registered_by,
            taskTitle,
            req.body.status,
            userId,
            updaterName,
            task.registry_id
          );
        }

        // Also notify assignee if different from updater and creator
        if (task.assigned_to && task.assigned_to !== userId && task.assigned_to !== task.registered_by) {
          await inAppNotificationService.notifyStatusChanged(
            task.assigned_to,
            taskTitle,
            req.body.status,
            userId,
            updaterName,
            task.registry_id
          );
        }
      }
    } catch (error) {
      console.error('Failed to send update notification:', error);
    }

    sendSuccess(res, task, 'Task updated successfully');
  }

  /**
   * Delete task (soft delete)
   */
  async deleteTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user!.user_id;

    const deleted = await taskService.deleteTask(id, userId);

    if (!deleted) {
      sendNotFound(res, 'Task not found');
      return;
    }

    sendNoContent(res);
  }

  /**
   * Update task status
   */
  async updateTaskStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user!.user_id;

    // Get existing task to check old status
    const existingTask = await taskService.getTaskById(id);
    if (!existingTask) {
      sendNotFound(res, 'Task not found');
      return;
    }

    const oldStatus = existingTask.status;
    const task = await taskService.updateTaskStatus(id, status, userId);

    if (!task) {
      sendNotFound(res, 'Task not found');
      return;
    }

    // Send notifications if status actually changed
    if (status !== oldStatus) {
      try {
        const updaterResult = await query<{ name: string }>(
          'SELECT name FROM users WHERE user_id = $1',
          [userId]
        );
        const updaterName = updaterResult.rows[0]?.name || 'Someone';
        const taskTitle = (task.task_data as any)?.title || 'Task';

        // Notify the task creator if different from updater
        if (task.registered_by !== userId) {
          await inAppNotificationService.notifyStatusChanged(
            task.registered_by,
            taskTitle,
            status,
            userId,
            updaterName,
            task.registry_id
          );
        }

        // Also notify assignee if different from updater and creator
        if (task.assigned_to && task.assigned_to !== userId && task.assigned_to !== task.registered_by) {
          await inAppNotificationService.notifyStatusChanged(
            task.assigned_to,
            taskTitle,
            status,
            userId,
            updaterName,
            task.registry_id
          );
        }
      } catch (error) {
        console.error('Failed to send status notification:', error);
      }
    }

    sendSuccess(res, task, 'Task status updated');
  }

  /**
   * Get tasks by category
   */
  async getTasksByCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const categoryId = Number(req.params.categoryId);
    const pagination: PaginationParams = {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    };

    const { tasks, meta } = await taskService.getTasksByCategory(categoryId, pagination);
    sendSuccess(res, { tasks, meta });
  }

  /**
   * Get today's tasks
   */
  async getTodaysTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    const tasks = await taskService.getTodaysTasks(req.user?.user_id);
    sendSuccess(res, tasks);
  }

  /**
   * Get pending tasks
   */
  async getPendingTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    const tasks = await taskService.getPendingTasks(req.user?.user_id);
    sendSuccess(res, tasks);
  }

  /**
   * Get all categories
   */
  async getCategories(req: Request, res: Response): Promise<void> {
    const categories = await taskService.getCategories();
    sendSuccess(res, categories);
  }

  /**
   * Get users that can be assigned tasks
   * Returns team members for admin, all users for super_admin
   */
  async getAssignableUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const userContext: UserContext = {
      user_id: req.user.user_id,
      role: req.user.role,
      team_id: req.user.team_id,
    };

    const users = await taskService.getAssignableUsers(userContext);
    sendSuccess(res, users);
  }

  /**
   * Process voice input and extract task data
   * Used by frontend voice recording feature
   */
  async processVoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const audioBuffer = req.file?.buffer;
      const mimeType = req.file?.mimetype || 'audio/webm';

      if (!audioBuffer) {
        sendError(res, 'No audio file provided', 400);
        return;
      }

      // Transcribe audio using Gemini
      const transcription = await geminiService.transcribeAudio(audioBuffer, mimeType);

      // Get categories for extraction
      const categories = await taskService.getCategories();

      // Extract task data from transcription
      const extracted = await geminiService.extractTaskData(
        transcription.text,
        categories,
        transcription.language
      );

      // Return extracted data for form auto-fill
      sendSuccess(res, {
        transcription: {
          text: transcription.text,
          language: transcription.language,
          confidence: transcription.confidence,
        },
        extracted: {
          category_id: extracted.category_id,
          task_data: extracted.task_data,
          priority: extracted.priority,
          summary: extracted.summary,
          confidence: extracted.confidence,
        },
      });
    } catch (error: any) {
      console.error('Voice processing error:', error);
      sendError(res, error.message || 'Failed to process voice input', 500);
    }
  }
}

export const taskController = new TaskController();
