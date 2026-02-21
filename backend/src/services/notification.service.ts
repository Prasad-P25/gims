import { query } from '../config/database';
import { logger } from '../utils/logger';
import { telegramService, isTelegramConfigured } from './telegram.service';

interface DailyStats {
  completed_today: number;
  pending: number;
  in_progress: number;
  total_today: number;
  overdue: number;
}

interface TelegramUser {
  user_id: string;
  name: string;
  telegram_id: number;
  role: string;
  team_id?: string;
}

class NotificationService {
  /**
   * Get daily task statistics
   */
  async getDailyStats(): Promise<DailyStats> {
    const result = await query<DailyStats>(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'completed' AND DATE(updated_at) = CURRENT_DATE) as completed_today,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as total_today,
        COUNT(*) FILTER (WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours') as overdue
      FROM task_registry
      WHERE deleted_at IS NULL`
    );

    const row = result.rows[0];
    return {
      completed_today: parseInt(String(row?.completed_today || '0')),
      pending: parseInt(String(row?.pending || '0')),
      in_progress: parseInt(String(row?.in_progress || '0')),
      total_today: parseInt(String(row?.total_today || '0')),
      overdue: parseInt(String(row?.overdue || '0')),
    };
  }

  /**
   * Get stats for a specific user (their tasks only)
   */
  async getUserStats(userId: string): Promise<DailyStats> {
    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'completed' AND DATE(updated_at) = CURRENT_DATE) as completed_today,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as total_today,
        COUNT(*) FILTER (WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours') as overdue
      FROM task_registry
      WHERE deleted_at IS NULL
        AND (registered_by = $1 OR assigned_to = $1)`,
      [userId]
    );

    const row = result.rows[0];
    return {
      completed_today: parseInt(String(row?.completed_today || '0')),
      pending: parseInt(String(row?.pending || '0')),
      in_progress: parseInt(String(row?.in_progress || '0')),
      total_today: parseInt(String(row?.total_today || '0')),
      overdue: parseInt(String(row?.overdue || '0')),
    };
  }

  /**
   * Get user's pending tasks with details
   */
  async getUserPendingTasks(userId: string): Promise<Array<{ title: string; category: string; priority: string; created_at: string }>> {
    const result = await query(
      `SELECT tr.task_data, tr.priority, tr.created_at,
              c.name_english, c.name_marathi
       FROM task_registry tr
       JOIN categories c ON tr.category_id = c.category_id
       WHERE tr.deleted_at IS NULL
         AND tr.status = 'pending'
         AND (tr.registered_by = $1 OR tr.assigned_to = $1)
       ORDER BY
         CASE tr.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
         tr.created_at ASC
       LIMIT 10`,
      [userId]
    );

    return result.rows.map((r: any) => ({
      title: r.task_data?.title || r.task_data?.description?.slice(0, 40) || 'Untitled',
      category: r.name_marathi || r.name_english,
      priority: r.priority,
      created_at: r.created_at,
    }));
  }

  /**
   * Get user's tasks completed today
   */
  async getUserCompletedToday(userId: string): Promise<Array<{ title: string; category: string }>> {
    const result = await query(
      `SELECT tr.task_data, c.name_english, c.name_marathi
       FROM task_registry tr
       JOIN categories c ON tr.category_id = c.category_id
       WHERE tr.deleted_at IS NULL
         AND tr.status = 'completed'
         AND DATE(tr.updated_at) = CURRENT_DATE
         AND (tr.registered_by = $1 OR tr.assigned_to = $1)
       ORDER BY tr.updated_at DESC
       LIMIT 10`,
      [userId]
    );

    return result.rows.map((r: any) => ({
      title: r.task_data?.title || r.task_data?.description?.slice(0, 40) || 'Untitled',
      category: r.name_marathi || r.name_english,
    }));
  }

  /**
   * Get overdue tasks from yesterday (pending tasks created before today)
   */
  async getUserOverdueTasks(userId: string): Promise<Array<{ title: string; category: string; priority: string; days_old: number }>> {
    const result = await query(
      `SELECT tr.task_data, tr.priority, tr.created_at,
              c.name_english, c.name_marathi,
              EXTRACT(DAY FROM NOW() - tr.created_at)::int as days_old
       FROM task_registry tr
       JOIN categories c ON tr.category_id = c.category_id
       WHERE tr.deleted_at IS NULL
         AND tr.status = 'pending'
         AND tr.created_at < CURRENT_DATE
         AND (tr.registered_by = $1 OR tr.assigned_to = $1)
       ORDER BY tr.created_at ASC
       LIMIT 10`,
      [userId]
    );

    return result.rows.map((r: any) => ({
      title: r.task_data?.title || r.task_data?.description?.slice(0, 40) || 'Untitled',
      category: r.name_marathi || r.name_english,
      priority: r.priority,
      days_old: r.days_old || 1,
    }));
  }

  /**
   * Get all users with Telegram linked
   */
  async getUsersWithTelegram(): Promise<TelegramUser[]> {
    const result = await query<TelegramUser>(
      `SELECT user_id, name, telegram_id, role, team_id
       FROM users
       WHERE telegram_id IS NOT NULL
         AND is_active = true
         AND deleted_at IS NULL`
    );
    return result.rows;
  }

  /**
   * Get admin/super_admin users with Telegram linked
   */
  async getAdminsWithTelegram(): Promise<TelegramUser[]> {
    const result = await query<TelegramUser>(
      `SELECT user_id, name, telegram_id, role, team_id
       FROM users
       WHERE role IN ('admin', 'super_admin')
         AND telegram_id IS NOT NULL
         AND is_active = true
         AND deleted_at IS NULL`
    );
    return result.rows;
  }

  // ──────────────────────────────────────────────
  // MESSAGE FORMATTERS
  // ──────────────────────────────────────────────

  /**
   * Format 10 AM morning update message
   * Shows: pending tasks, in-progress, what to focus on today
   */
  formatMorningUpdate(stats: DailyStats, pendingTasks: Array<{ title: string; category: string; priority: string }>): string {
    const date = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    let msg = `🌅 <b>Good Morning! Task Update</b>\n`;
    msg += `<b>सुप्रभात! कार्य अपडेट</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📅 ${date}\n\n`;

    msg += `<b>Your Tasks:</b>\n`;
    msg += `• ⏳ Pending: ${stats.pending}\n`;
    msg += `• 🔄 In Progress: ${stats.in_progress}\n`;

    if (pendingTasks.length > 0) {
      msg += `\n<b>⚡ Focus Today:</b>\n`;
      pendingTasks.slice(0, 5).forEach((t, i) => {
        const p = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
        msg += `${i + 1}. ${p} ${t.title}\n   └ ${t.category}\n`;
      });
      if (pendingTasks.length > 5) {
        msg += `\n   ...and ${pendingTasks.length - 5} more\n`;
      }
    } else {
      msg += `\n✅ No pending tasks! Great job!\n`;
    }

    msg += `\nUse /mytasks to update status.`;
    return msg;
  }

  /**
   * Format 6 PM evening update message
   * Shows: what was done today, pending highlights
   */
  formatEveningUpdate(
    stats: DailyStats,
    completedToday: Array<{ title: string; category: string }>,
    pendingTasks: Array<{ title: string; category: string; priority: string }>
  ): string {
    const date = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    let msg = `🌆 <b>Evening Report</b>\n`;
    msg += `<b>संध्याकाळचा अहवाल</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📅 ${date}\n\n`;

    msg += `<b>📊 Today's Progress:</b>\n`;
    msg += `• Tasks Created: ${stats.total_today}\n`;
    msg += `• ✅ Completed: ${stats.completed_today}\n`;
    msg += `• ⏳ Still Pending: ${stats.pending}\n`;
    msg += `• 🔄 In Progress: ${stats.in_progress}\n`;

    if (completedToday.length > 0) {
      msg += `\n<b>✅ Completed Today:</b>\n`;
      completedToday.slice(0, 5).forEach((t, i) => {
        msg += `${i + 1}. ${t.title}\n`;
      });
    }

    if (pendingTasks.length > 0) {
      const highPriority = pendingTasks.filter(t => t.priority === 'high');
      if (highPriority.length > 0) {
        msg += `\n<b>🔴 High Priority Pending:</b>\n`;
        highPriority.slice(0, 3).forEach((t, i) => {
          msg += `${i + 1}. ${t.title}\n   └ ${t.category}\n`;
        });
      }
    }

    msg += `\nPrepare for tomorrow! 🙏`;
    return msg;
  }

  /**
   * Format 7 PM daily report for admins
   */
  formatDailySummary(stats: DailyStats): string {
    const date = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
<b>📊 Daily Task Summary</b>
<b>दैनिक कार्य सारांश</b>
━━━━━━━━━━━━━━━━━━━━

<b>Date:</b> ${date}

<b>Today's Activity:</b>
• Tasks Created: ${stats.total_today}
• Tasks Completed: ${stats.completed_today}

<b>Current Status:</b>
• ⏳ Pending: ${stats.pending}
• 🔄 In Progress: ${stats.in_progress}
• ⚠️ Overdue (24h+): ${stats.overdue}

<b>Total Remaining:</b> ${stats.pending + stats.in_progress}
    `.trim();
  }

  /**
   * Format 9 AM overdue alert
   */
  formatOverdueAlert(overdueTasks: Array<{ title: string; category: string; priority: string; days_old: number }>): string {
    let msg = `⚠️ <b>Overdue Task Alert</b>\n`;
    msg += `<b>थकीत कार्य सूचना</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (overdueTasks.length === 0) {
      msg += `✅ No overdue tasks! All caught up.\n`;
      msg += `कोणतेही थकीत कार्य नाही!`;
      return msg;
    }

    msg += `You have <b>${overdueTasks.length}</b> overdue task(s):\n\n`;

    overdueTasks.forEach((t, i) => {
      const p = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
      msg += `${i + 1}. ${p} <b>${t.title}</b>\n`;
      msg += `   └ ${t.category}\n`;
      msg += `   └ ⏰ ${t.days_old} day(s) old\n\n`;
    });

    msg += `कृपया लवकरात लवकर पूर्ण करा.\nPlease complete these as soon as possible.\n\nUse /mytasks to update status.`;
    return msg;
  }

  // ──────────────────────────────────────────────
  // SEND METHODS
  // ──────────────────────────────────────────────

  /**
   * 10 AM — Morning update to all users with Telegram
   */
  async sendMorningUpdate(): Promise<{ sent: number; failed: number }> {
    if (!isTelegramConfigured()) {
      logger.warn('Telegram not configured, skipping morning update');
      return { sent: 0, failed: 0 };
    }

    const users = await this.getUsersWithTelegram();
    let sent = 0, failed = 0;

    for (const user of users) {
      try {
        const stats = await this.getUserStats(user.user_id);
        const pendingTasks = await this.getUserPendingTasks(user.user_id);
        const message = this.formatMorningUpdate(stats, pendingTasks);
        await telegramService.sendMessage(user.telegram_id, message);
        sent++;
      } catch (error: any) {
        logger.error('Failed to send morning update', { userId: user.user_id, error: error.message });
        failed++;
      }
    }

    logger.info('Morning update completed', { sent, failed });
    return { sent, failed };
  }

  /**
   * 6 PM — Evening update to all users with Telegram
   */
  async sendEveningUpdate(): Promise<{ sent: number; failed: number }> {
    if (!isTelegramConfigured()) {
      logger.warn('Telegram not configured, skipping evening update');
      return { sent: 0, failed: 0 };
    }

    const users = await this.getUsersWithTelegram();
    let sent = 0, failed = 0;

    for (const user of users) {
      try {
        const stats = await this.getUserStats(user.user_id);
        const completedToday = await this.getUserCompletedToday(user.user_id);
        const pendingTasks = await this.getUserPendingTasks(user.user_id);
        const message = this.formatEveningUpdate(stats, completedToday, pendingTasks);
        await telegramService.sendMessage(user.telegram_id, message);
        sent++;
      } catch (error: any) {
        logger.error('Failed to send evening update', { userId: user.user_id, error: error.message });
        failed++;
      }
    }

    logger.info('Evening update completed', { sent, failed });
    return { sent, failed };
  }

  /**
   * 7 PM — Daily report to admins only
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
    let sent = 0, failed = 0;

    for (const admin of admins) {
      try {
        await telegramService.sendMessage(admin.telegram_id, message);
        sent++;
      } catch (error: any) {
        logger.error('Failed to send daily summary', { userId: admin.user_id, error: error.message });
        failed++;
      }
    }

    logger.info('Daily summary completed', { sent, failed });
    return { sent, failed };
  }

  /**
   * 9 AM — Overdue alert to all users
   */
  async sendOverdueAlerts(): Promise<{ sent: number; failed: number }> {
    if (!isTelegramConfigured()) {
      logger.warn('Telegram not configured, skipping overdue alerts');
      return { sent: 0, failed: 0 };
    }

    const users = await this.getUsersWithTelegram();
    let sent = 0, failed = 0;

    for (const user of users) {
      try {
        const overdueTasks = await this.getUserOverdueTasks(user.user_id);
        // Only send if user actually has overdue tasks
        if (overdueTasks.length > 0) {
          const message = this.formatOverdueAlert(overdueTasks);
          await telegramService.sendMessage(user.telegram_id, message);
          sent++;
        }
      } catch (error: any) {
        logger.error('Failed to send overdue alert', { userId: user.user_id, error: error.message });
        failed++;
      }
    }

    logger.info('Overdue alerts completed', { sent, failed });
    return { sent, failed };
  }
}

export const notificationService = new NotificationService();
