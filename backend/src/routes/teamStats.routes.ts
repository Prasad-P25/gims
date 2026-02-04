import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { teamStatsController } from '../controllers/teamStats.controller';
import { AuthenticatedRequest } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/team-stats/dashboard - Get team dashboard stats
router.get(
  '/dashboard',
  asyncHandler((req, res) => teamStatsController.getTeamDashboard(req as AuthenticatedRequest, res))
);

// GET /api/team-stats/members - Get member stats
router.get(
  '/members',
  asyncHandler((req, res) => teamStatsController.getMemberStats(req as AuthenticatedRequest, res))
);

// POST /api/team-stats/bulk-assign - Bulk assign tasks
router.post(
  '/bulk-assign',
  asyncHandler((req, res) => teamStatsController.bulkAssignTasks(req as AuthenticatedRequest, res))
);

// PATCH /api/team-stats/tasks/:id/status - Quick status update
router.patch(
  '/tasks/:id/status',
  asyncHandler((req, res) => teamStatsController.quickStatusUpdate(req as AuthenticatedRequest, res))
);

// PATCH /api/team-stats/tasks/:id/reassign - Reassign task
router.patch(
  '/tasks/:id/reassign',
  asyncHandler((req, res) => teamStatsController.reassignTask(req as AuthenticatedRequest, res))
);

export default router;
