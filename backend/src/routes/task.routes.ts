import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.middleware';
import { taskCreateSchema, taskUpdateSchema, taskFiltersSchema, paginationSchema, uuidSchema } from '../utils/validators';
import { asyncHandler } from '../middlewares/error.middleware';
import { taskController } from '../controllers/task.controller';
import { AuthenticatedRequest } from '../types';
import { z } from 'zod';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// GET /api/tasks/categories - Get all categories (before :id route)
router.get(
  '/categories',
  asyncHandler((req, res) => taskController.getCategories(req, res))
);

// GET /api/tasks/today - Get today's tasks
router.get(
  '/today',
  asyncHandler((req, res) => taskController.getTodaysTasks(req as AuthenticatedRequest, res))
);

// GET /api/tasks/pending - Get pending tasks
router.get(
  '/pending',
  asyncHandler((req, res) => taskController.getPendingTasks(req as AuthenticatedRequest, res))
);

// GET /api/tasks - Get all tasks with filters and pagination
router.get(
  '/',
  validateQuery(taskFiltersSchema.merge(paginationSchema)),
  asyncHandler((req, res) => taskController.getTasks(req as AuthenticatedRequest, res))
);

// GET /api/tasks/:id - Get single task by ID
router.get(
  '/:id',
  validateParams(z.object({ id: uuidSchema })),
  asyncHandler((req, res) => taskController.getTaskById(req as AuthenticatedRequest, res))
);

// POST /api/tasks - Create new task
router.post(
  '/',
  validateBody(taskCreateSchema),
  asyncHandler((req, res) => taskController.createTask(req as AuthenticatedRequest, res))
);

// PUT /api/tasks/:id - Update task
router.put(
  '/:id',
  validateParams(z.object({ id: uuidSchema })),
  validateBody(taskUpdateSchema),
  asyncHandler((req, res) => taskController.updateTask(req as AuthenticatedRequest, res))
);

// DELETE /api/tasks/:id - Soft delete task
router.delete(
  '/:id',
  validateParams(z.object({ id: uuidSchema })),
  asyncHandler((req, res) => taskController.deleteTask(req as AuthenticatedRequest, res))
);

// POST /api/tasks/:id/status - Update task status
router.post(
  '/:id/status',
  validateParams(z.object({ id: uuidSchema })),
  validateBody(z.object({ status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']) })),
  asyncHandler((req, res) => taskController.updateTaskStatus(req as AuthenticatedRequest, res))
);

// GET /api/tasks/category/:categoryId - Get tasks by category
router.get(
  '/category/:categoryId',
  validateParams(z.object({ categoryId: z.coerce.number().int().positive() })),
  validateQuery(paginationSchema),
  asyncHandler((req, res) => taskController.getTasksByCategory(req as AuthenticatedRequest, res))
);

export default router;
