import { query } from '../config/database';
import { logger } from '../utils/logger';
import { telegramService } from './telegram.service';

export interface Notification {
  notification_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  registry_id?: string;
  triggered_by?: string;
  triggered_by_name?: string;
  is_read: boolean;
  read_at?: Date;
  telegram_sent: boolean;
  created_at: Date;
}

export interface CreateNotificationInput {
  user_id: string;
  type: 'task_assigned' | 'status_changed' | 'task_completed' | 'task_reassigned';
  title: string;
  message: string;
  registry_id?: string;
  triggered_by?: string;
}

class InAppNotificationService {
  /**
   * Create a notification and optionally send via Telegram
   */
  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const sql = `
      INSERT INTO notifications (user_id, type, title, message, registry_id, triggered_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await query<Notification>(sql, [
      input.user_id,
      input.type,
      input.title,
      input.message,
      input.registry_id || null,
      input.triggered_by || null,
    ]);

    const notification = result.rows[0];
    logger.info('Notification created', { notificationId: notification.notification_id, userId: input.user_id, type: input.type });

    // Try to send via Telegram
    await this.sendTelegramNotification(notification);

    return notification;
  }

  /**
   * Send notification via Telegram if user has linked account
   */
  private async sendTelegramNotification(notification: Notification): Promise<void> {
    try {
      // Get user's telegram_id
      const userResult = await query<{ telegram_id: number | null }>(
        'SELECT telegram_id FROM users WHERE user_id = $1',
        [notification.user_id]
      );

      const telegramId = userResult.rows[0]?.telegram_id;
      if (!telegramId) {
        logger.debug('User has no telegram_id, skipping Telegram notification', { userId: notification.user_id });
        return;
      }

      // Format message for Telegram
      const telegramMessage = `${notification.title}\n\n${notification.message}`;

      // Send via Telegram
      await telegramService.sendMessage(telegramId, telegramMessage);

      // Mark as sent
      await query(
        'UPDATE notifications SET telegram_sent = true, telegram_sent_at = NOW() WHERE notification_id = $1',
        [notification.notification_id]
      );

      logger.info('Telegram notification sent', { notificationId: notification.notification_id, telegramId });
    } catch (error: any) {
      logger.error('Failed to send Telegram notification', {
        notificationId: notification.notification_id,
        error: error.message
      });
    }
  }

  /**
   * Get unread notifications for a user
   */
  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    const sql = `
      SELECT n.*, u.name as triggered_by_name
      FROM notifications n
      LEFT JOIN users u ON n.triggered_by = u.user_id
      WHERE n.user_id = $1 AND n.is_read = false
      ORDER BY n.created_at DESC
      LIMIT 20
    `;
    const result = await query<Notification>(sql, [userId]);
    return result.rows;
  }

  /**
   * Get all notifications for a user (paginated)
   */
  async getNotifications(userId: string, page: number = 1, limit: number = 20): Promise<{ notifications: Notification[]; total: number }> {
    const offset = (page - 1) * limit;

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const sql = `
      SELECT n.*, u.name as triggered_by_name
      FROM notifications n
      LEFT JOIN users u ON n.triggered_by = u.user_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await query<Notification>(sql, [userId, limit, offset]);

    return { notifications: result.rows, total };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await query(
      'UPDATE notifications SET is_read = true, read_at = NOW() WHERE notification_id = $1 AND user_id = $2 RETURNING notification_id',
      [notificationId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await query(
      'UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false RETURNING notification_id',
      [userId]
    );
    return result.rows.length;
  }

  // ============== Task-specific notification helpers ==============

  /**
   * Notify user when a task is assigned to them
   */
  async notifyTaskAssigned(
    assignedToUserId: string,
    taskTitle: string,
    assignedByUserId: string,
    assignedByName: string,
    registryId: string
  ): Promise<void> {
    await this.createNotification({
      user_id: assignedToUserId,
      type: 'task_assigned',
      title: '📋 New Task Assigned',
      message: `${assignedByName} assigned a task to you:\n"${taskTitle}"`,
      registry_id: registryId,
      triggered_by: assignedByUserId,
    });
  }

  /**
   * Notify when task status changes
   */
  async notifyStatusChanged(
    notifyUserId: string,
    taskTitle: string,
    newStatus: string,
    changedByUserId: string,
    changedByName: string,
    registryId: string
  ): Promise<void> {
    const statusEmoji = newStatus === 'completed' ? '✅' : newStatus === 'in_progress' ? '🔄' : '⏳';
    const statusLabel = newStatus.replace('_', ' ');

    await this.createNotification({
      user_id: notifyUserId,
      type: newStatus === 'completed' ? 'task_completed' : 'status_changed',
      title: `${statusEmoji} Task Status Updated`,
      message: `${changedByName} changed task status to "${statusLabel}":\n"${taskTitle}"`,
      registry_id: registryId,
      triggered_by: changedByUserId,
    });
  }

  /**
   * Notify when task is reassigned to a different user
   */
  async notifyTaskReassigned(
    newAssigneeUserId: string,
    taskTitle: string,
    reassignedByUserId: string,
    reassignedByName: string,
    registryId: string
  ): Promise<void> {
    await this.createNotification({
      user_id: newAssigneeUserId,
      type: 'task_reassigned',
      title: '📋 Task Reassigned to You',
      message: `${reassignedByName} reassigned a task to you:\n"${taskTitle}"`,
      registry_id: registryId,
      triggered_by: reassignedByUserId,
    });
  }
}

export const inAppNotificationService = new InAppNotificationService();
