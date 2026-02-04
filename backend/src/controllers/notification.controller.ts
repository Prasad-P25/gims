import { Response } from 'express';
import { inAppNotificationService } from '../services/inAppNotification.service';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../types';

export class NotificationController {
  /**
   * Get unread notifications for the current user
   */
  async getUnreadNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;
    const notifications = await inAppNotificationService.getUnreadNotifications(userId);
    sendSuccess(res, notifications);
  }

  /**
   * Get all notifications (paginated)
   */
  async getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { notifications, total } = await inAppNotificationService.getNotifications(userId, page, limit);
    sendSuccess(res, {
      notifications,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  /**
   * Get unread count
   */
  async getUnreadCount(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;
    const count = await inAppNotificationService.getUnreadCount(userId);
    sendSuccess(res, { count });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;
    const { id } = req.params;

    const success = await inAppNotificationService.markAsRead(id, userId);
    if (success) {
      sendSuccess(res, { message: 'Notification marked as read' });
    } else {
      sendError(res, 'Notification not found', 404);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;
    const count = await inAppNotificationService.markAllAsRead(userId);
    sendSuccess(res, { message: `${count} notifications marked as read` });
  }
}

export const notificationController = new NotificationController();
