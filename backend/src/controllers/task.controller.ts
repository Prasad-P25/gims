import { Request, Response } from 'express';
import { taskService } from '../services/task.service';
import { geminiService } from '../services/gemini.service';
import { sendSuccess, sendCreated, sendNoContent, sendNotFound, sendError } from '../utils/response';
import { AuthenticatedRequest, TaskFilters, PaginationParams } from '../types';

export class TaskController {
  /**
   * Get all tasks with filters and pagination
   */
  async getTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filters: TaskFilters = {
      category_id: req.query.category_id ? Number(req.query.category_id) : undefined,
      status: req.query.status as TaskFilters['status'],
      priority: req.query.priority as TaskFilters['priority'],
      registered_by: req.query.registered_by as string,
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

    const { tasks, meta } = await taskService.getTasks(filters, pagination);
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
    const task = await taskService.createTask(req.body, userId);
    sendCreated(res, task, 'Task created successfully');
  }

  /**
   * Update task
   */
  async updateTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user!.user_id;

    const task = await taskService.updateTask(id, req.body, userId);

    if (!task) {
      sendNotFound(res, 'Task not found');
      return;
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

    const task = await taskService.updateTaskStatus(id, status, userId);

    if (!task) {
      sendNotFound(res, 'Task not found');
      return;
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
