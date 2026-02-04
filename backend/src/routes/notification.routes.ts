import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { asyncHandler } from '../middlewares/error.middleware';
import { notificationController } from '../controllers/notification.controller';
import { AuthenticatedRequest } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/notifications - Get all notifications (paginated)
router.get(
  '/',
  asyncHandler((req, res) => notificationController.getNotifications(req as AuthenticatedRequest, res))
);

// GET /api/notifications/unread - Get unread notifications
router.get(
  '/unread',
  asyncHandler((req, res) => notificationController.getUnreadNotifications(req as AuthenticatedRequest, res))
);

// GET /api/notifications/count - Get unread count
router.get(
  '/count',
  asyncHandler((req, res) => notificationController.getUnreadCount(req as AuthenticatedRequest, res))
);

// POST /api/notifications/read-all - Mark all as read
router.post(
  '/read-all',
  asyncHandler((req, res) => notificationController.markAllAsRead(req as AuthenticatedRequest, res))
);

// POST /api/notifications/:id/read - Mark single notification as read
router.post(
  '/:id/read',
  asyncHandler((req, res) => notificationController.markAsRead(req as AuthenticatedRequest, res))
);

export default router;
