import { Router } from 'express';
import { validateBody } from '../middlewares/validate.middleware';
import { loginSchema, refreshTokenSchema, userCreateSchema } from '../utils/validators';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { authController } from '../controllers/auth.controller';
import { AuthenticatedRequest } from '../types';

const router = Router();

// POST /api/auth/login - User login
router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler((req, res) => authController.login(req, res))
);

// POST /api/auth/refresh - Refresh access token
router.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  asyncHandler((req, res) => authController.refreshToken(req, res))
);

// POST /api/auth/logout - User logout
router.post(
  '/logout',
  authenticate,
  asyncHandler((req, res) => authController.logout(req as AuthenticatedRequest, res))
);

// POST /api/auth/register - Register new user (admin and super_admin)
router.post(
  '/register',
  authenticate,
  authorize('admin', 'super_admin'),
  validateBody(userCreateSchema),
  asyncHandler((req, res) => authController.register(req as AuthenticatedRequest, res))
);

// GET /api/auth/me - Get current user profile
router.get(
  '/me',
  authenticate,
  asyncHandler((req, res) => authController.getProfile(req as AuthenticatedRequest, res))
);

// PUT /api/auth/me - Update current user profile
router.put(
  '/me',
  authenticate,
  asyncHandler((req, res) => authController.updateProfile(req as AuthenticatedRequest, res))
);

// POST /api/auth/change-password - Change password
router.post(
  '/change-password',
  authenticate,
  asyncHandler((req, res) => authController.changePassword(req as AuthenticatedRequest, res))
);

// GET /api/auth/users - Get all users (admin and super_admin)
router.get(
  '/users',
  authenticate,
  authorize('admin', 'super_admin'),
  asyncHandler((req, res) => authController.getUsers(req as AuthenticatedRequest, res))
);

// PATCH /api/auth/users/:userId/toggle-status - Toggle user active status (admin and super_admin)
router.patch(
  '/users/:userId/toggle-status',
  authenticate,
  authorize('admin', 'super_admin'),
  asyncHandler((req, res) => authController.toggleUserStatus(req as AuthenticatedRequest, res))
);

// PUT /api/auth/users/:userId - Update user details (admin and super_admin)
router.put(
  '/users/:userId',
  authenticate,
  authorize('admin', 'super_admin'),
  asyncHandler((req, res) => authController.updateUser(req as AuthenticatedRequest, res))
);

export default router;
