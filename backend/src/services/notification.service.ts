import { query } from '../config/database';
import { logger } from '../utils/logger';
import { telegramService, isTelegramConfigured } from './telegram.service';

interface DailyStats {
  completed_today: number;
  pending: number;
  in_progress: number;
  total_today: number;
}

interface AdminUser {
  user_id: string;
  name: string;
  telegram_id: number;
}

class NotificationService {
  /**
   * Get daily task statistics
   */
  async getDailyStats(): Promise<DailyStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get completed today
    const completedResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM task_registry
       WHERE status = 'completed'
       AND DATE(updated_at) = CURRENT_DATE
       AND deleted_at IS NULL`
    );

    // Get pending tasks
    const pendingResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM task_registry
       WHERE status = 'pending'
       AND deleted_at IS NULL`
    );

    // Get in-progress tasks
    const inProgressResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM task_registry
       WHERE status = 'in_progress'
       AND deleted_at IS NULL`
    );

    // Get total tasks created today
    const totalTodayResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM task_registry
       WHERE DATE(created_at) = CURRENT_DATE
       AND deleted_at IS NULL`
    );

    return {
      completed_today: parseInt(completedResult.rows[0]?.count || '0'),
      pending: parseInt(pendingResult.rows[0]?.count || '0'),
      in_progress: parseInt(inProgressResult.rows[0]?.count || '0'),
      total_today: parseInt(totalTodayResult.rows[0]?.count || '0'),
    };
  }

  /**
   * Get all admin users with Telegram linked
   */
  async getAdminsWithTelegram(): Promise<AdminUser[]> {
    const result = await query<AdminUser>(
      `SELECT user_id, name, telegram_id
       FROM users
       WHERE role = 'admin'
       AND telegram_id IS NOT NULL
       AND is_active = true
       AND deleted_at IS NULL`
    );

    return result.rows;
  }

  /**
   * Format daily summary message
   */
  formatDailySummary(stats: DailyStats): string {
    const date = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
<b>Daily Task Summary</b>
<b>दैनिक कार्य सारांश</b>

<b>Date:</b> ${date}

<b>Today's Activity:</b>
• Tasks Created: ${stats.total_today}
• Tasks Completed: ${stats.completed_today}

<b>Current Status:</b>
• Pending: ${stats.pending}
• In Progress: ${stats.in_progress}

<b>Total Remaining:</b> ${stats.pending + stats.in_progress}
    `.trim();
  }

  /**
   * Send daily summary to all admins
   */
  async sendDailySummaryToAdmins(): Promise<{ sent: number; failed: number }> {
    if (!isTelegramConfigured()) {
      logger.warn('Telegram not configured, skipping daily summary');
      return { sent: 0, failed: 0 };
    }

    const stats = await this.getDailyStats();
    const admins = await this.getAdminsWithTelegram();

    if (admins.length === 0) {
      logger.info('No admins with Telegram linked, skipping daily summary');
      return { sent: 0, failed: 0 };
    }

    const message = this.formatDailySummary(stats);
    let sent = 0;
    let failed = 0;

    for (const admin of admins) {
      try {
        await telegramService.sendMessage(admin.telegram_id, message);
        logger.info('Daily summary sent to admin', {
          adminId: admin.user_id,
          name: admin.name
        });
        sent++;
      } catch (error: any) {
        logger.error('Failed to send daily summary to admin', {
          adminId: admin.user_id,
          name: admin.name,
          error: error.message,
        });
        failed++;
      }
    }

    logger.info('Daily summary notifications completed', { sent, failed, total: admins.length });
    return { sent, failed };
  }
}

export const notificationService = new NotificationService();
