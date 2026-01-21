import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validateQuery } from '../middlewares/validate.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { dashboardController } from '../controllers/dashboard.controller';
import { AuthenticatedRequest } from '../types';
import { z } from 'zod';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// GET /api/dashboard/stats - Get dashboard statistics
router.get(
  '/stats',
  asyncHandler((req, res) => dashboardController.getStats(req as AuthenticatedRequest, res))
);

// GET /api/dashboard/category-breakdown - Get tasks breakdown by category
router.get(
  '/category-breakdown',
  asyncHandler((req, res) => dashboardController.getCategoryBreakdown(req as AuthenticatedRequest, res))
);

// GET /api/dashboard/recent-tasks - Get recent tasks
router.get(
  '/recent-tasks',
  validateQuery(z.object({ limit: z.coerce.number().int().positive().max(50).default(10) })),
  asyncHandler((req, res) => dashboardController.getRecentTasks(req as AuthenticatedRequest, res))
);

// GET /api/dashboard/daily-summary - Get daily task summary
router.get(
  '/daily-summary',
  validateQuery(z.object({ date: z.coerce.date().optional() })),
  asyncHandler((req, res) => dashboardController.getDailySummary(req as AuthenticatedRequest, res))
);

// GET /api/dashboard/trends - Get task trends over time
router.get(
  '/trends',
  validateQuery(z.object({
    period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
  })),
  asyncHandler((req, res) => dashboardController.getTrends(req as AuthenticatedRequest, res))
);

// GET /api/dashboard/overdue - Get overdue tasks
router.get(
  '/overdue',
  asyncHandler((req, res) => dashboardController.getOverdueTasks(req as AuthenticatedRequest, res))
);

export default router;
