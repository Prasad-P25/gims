import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { validateBody, validateParams } from '../middlewares/validate.middleware';
import {
  projectCreateSchema,
  projectUpdateSchema,
  projectTeamAssignSchema,
  uuidSchema,
} from '../utils/validators';
import { asyncHandler } from '../middlewares/error.middleware';
import { projectController } from '../controllers/project.controller';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(authenticate);

// GET /api/projects/mine — projects the current user's team is in (for dropdowns)
router.get(
  '/mine',
  asyncHandler((req, res) => projectController.getMyProjects(req as AuthenticatedRequest, res))
);

// GET /api/projects — list (role-filtered)
router.get(
  '/',
  asyncHandler((req, res) => projectController.listProjects(req as AuthenticatedRequest, res))
);

// POST /api/projects — create
router.post(
  '/',
  validateBody(projectCreateSchema),
  asyncHandler((req, res) => projectController.createProject(req as AuthenticatedRequest, res))
);

// GET /api/projects/:id
router.get(
  '/:id',
  validateParams(z.object({ id: uuidSchema })),
  asyncHandler((req, res) => projectController.getProjectById(req as AuthenticatedRequest, res))
);

// PUT /api/projects/:id
router.put(
  '/:id',
  validateParams(z.object({ id: uuidSchema })),
  validateBody(projectUpdateSchema),
  asyncHandler((req, res) => projectController.updateProject(req as AuthenticatedRequest, res))
);

// DELETE /api/projects/:id
router.delete(
  '/:id',
  validateParams(z.object({ id: uuidSchema })),
  asyncHandler((req, res) => projectController.deleteProject(req as AuthenticatedRequest, res))
);

// GET /api/projects/:id/teams
router.get(
  '/:id/teams',
  validateParams(z.object({ id: uuidSchema })),
  asyncHandler((req, res) => projectController.getProjectTeams(req as AuthenticatedRequest, res))
);

// POST /api/projects/:id/teams — assign team(s)
router.post(
  '/:id/teams',
  validateParams(z.object({ id: uuidSchema })),
  validateBody(projectTeamAssignSchema),
  asyncHandler((req, res) => projectController.assignTeams(req as AuthenticatedRequest, res))
);

// DELETE /api/projects/:id/teams/:teamId — remove team
router.delete(
  '/:id/teams/:teamId',
  validateParams(z.object({ id: uuidSchema, teamId: uuidSchema })),
  asyncHandler((req, res) => projectController.removeTeam(req as AuthenticatedRequest, res))
);

// GET /api/projects/:id/dashboard
router.get(
  '/:id/dashboard',
  validateParams(z.object({ id: uuidSchema })),
  asyncHandler((req, res) => projectController.getDashboard(req as AuthenticatedRequest, res))
);

export default router;
