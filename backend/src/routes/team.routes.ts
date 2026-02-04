import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validateBody, validateParams } from '../middlewares/validate.middleware';
import { teamCreateSchema, teamUpdateSchema, uuidSchema } from '../utils/validators';
import { asyncHandler } from '../middlewares/error.middleware';
import { teamController } from '../controllers/team.controller';
import { AuthenticatedRequest } from '../types';
import { z } from 'zod';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// GET /api/teams - Get all teams (super_admin only)
router.get(
  '/',
  asyncHandler((req, res) => teamController.getAllTeams(req as AuthenticatedRequest, res))
);

// GET /api/teams/unassigned-users - Get users without a team
router.get(
  '/unassigned-users',
  asyncHandler((req, res) => teamController.getUnassignedUsers(req as AuthenticatedRequest, res))
);

// GET /api/teams/my-team - Get current user's team
router.get(
  '/my-team',
  asyncHandler((req, res) => teamController.getMyTeam(req as AuthenticatedRequest, res))
);

// GET /api/teams/:id - Get team by ID
router.get(
  '/:id',
  validateParams(z.object({ id: uuidSchema })),
  asyncHandler((req, res) => teamController.getTeamById(req as AuthenticatedRequest, res))
);

// POST /api/teams - Create new team (super_admin only)
router.post(
  '/',
  validateBody(teamCreateSchema),
  asyncHandler((req, res) => teamController.createTeam(req as AuthenticatedRequest, res))
);

// PUT /api/teams/:id - Update team (super_admin only)
router.put(
  '/:id',
  validateParams(z.object({ id: uuidSchema })),
  validateBody(teamUpdateSchema),
  asyncHandler((req, res) => teamController.updateTeam(req as AuthenticatedRequest, res))
);

// DELETE /api/teams/:id - Delete team (super_admin only)
router.delete(
  '/:id',
  validateParams(z.object({ id: uuidSchema })),
  asyncHandler((req, res) => teamController.deleteTeam(req as AuthenticatedRequest, res))
);

// GET /api/teams/:id/members - Get team members
router.get(
  '/:id/members',
  validateParams(z.object({ id: uuidSchema })),
  asyncHandler((req, res) => teamController.getTeamMembers(req as AuthenticatedRequest, res))
);

// POST /api/teams/:id/members - Add user to team
router.post(
  '/:id/members',
  validateParams(z.object({ id: uuidSchema })),
  validateBody(z.object({
    user_id: uuidSchema,
    role: z.enum(['admin', 'member']).default('member'),
  })),
  asyncHandler((req, res) => teamController.addUserToTeam(req as AuthenticatedRequest, res))
);

// DELETE /api/teams/:id/members/:userId - Remove user from team
router.delete(
  '/:id/members/:userId',
  validateParams(z.object({ id: uuidSchema, userId: uuidSchema })),
  asyncHandler((req, res) => teamController.removeUserFromTeam(req as AuthenticatedRequest, res))
);

export default router;
