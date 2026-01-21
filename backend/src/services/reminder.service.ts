import { query } from '../config/database';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { Reminder, ReminderCreateInput, ReminderType, User } from '../types';
import { whatsappService } from './whatsapp.service';
import { taskService } from './task.service';
import { geminiService } from './gemini.service';

export class ReminderService {
  /**
   * Create a new reminder
   */
  async createReminder(input: ReminderCreateInput): Promise<Reminder> {
    const sql = `
      INSERT INTO reminders (
        user_id, registry_id, reminder_type,
        scheduled_time, message_template
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await query<Reminder>(sql, [
      input.user_id,
      input.registry_id || null,
      input.reminder_type,
      input.scheduled_time,
      input.message_template || null,
    ]);

    logger.info('Reminder created', { reminderId: result.rows[0].reminder_id });
    return result.rows[0];
  }

  /**
   * Get reminder by ID
   */
  async getReminderById(reminderId: string): Promise<Reminder | null> {
    const sql = 'SELECT * FROM reminders WHERE reminder_id = $1';
    const result = await query<Reminder>(sql, [reminderId]);
    return result.rows[0] || null;
  }

  /**
   * Get pending reminders that are due
   */
  async getPendingReminders(): Promise<Reminder[]> {
    const sql = `
      SELECT r.*, u.phone, u.name, u.preferred_language
      FROM reminders r
      JOIN users u ON r.user_id = u.user_id
      WHERE r.is_sent = false
        AND r.scheduled_time <= NOW()
        AND r.retry_count < 3
      ORDER BY r.scheduled_time ASC
      LIMIT 100
    `;
    const result = await query<Reminder & { phone: string; name: string; preferred_language: string }>(sql);
    return result.rows;
  }

  /**
   * Mark reminder as sent
   */
  async markReminderSent(reminderId: string): Promise<void> {
    const sql = `
      UPDATE reminders
      SET is_sent = true, sent_at = NOW()
      WHERE reminder_id = $1
    `;
    await query(sql, [reminderId]);
    logger.info('Reminder marked as sent', { reminderId });
  }

  /**
   * Mark reminder as failed and increment retry count
   */
  async markReminderFailed(reminderId: string, errorMessage: string): Promise<void> {
    const sql = `
      UPDATE reminders
      SET retry_count = retry_count + 1, error_message = $2
      WHERE reminder_id = $1
    `;
    await query(sql, [reminderId, errorMessage]);
    logger.warn('Reminder failed', { reminderId, errorMessage });
  }

  /**
   * Schedule morning reminders for all active users
   */
  async scheduleMorningReminders(): Promise<number> {
    const [hours, minutes] = env.MORNING_REMINDER_TIME.split(':').map(Number);
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (scheduledTime < new Date()) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    // Get all active users
    const usersResult = await query<User>(
      'SELECT * FROM users WHERE is_active = true AND deleted_at IS NULL'
    );

    let count = 0;
    for (const user of usersResult.rows) {
      // Check if reminder already exists for this user and time
      const existingResult = await query(
        `SELECT 1 FROM reminders
         WHERE user_id = $1 AND reminder_type = 'morning'
         AND DATE(scheduled_time) = DATE($2) AND is_sent = false`,
        [user.user_id, scheduledTime]
      );

      if (existingResult.rows.length === 0) {
        await this.createReminder({
          user_id: user.user_id,
          reminder_type: 'morning',
          scheduled_time: scheduledTime,
        });
        count++;
      }
    }

    logger.info('Morning reminders scheduled', { count, scheduledTime });
    return count;
  }

  /**
   * Schedule evening reminders for all active users
   */
  async scheduleEveningReminders(): Promise<number> {
    const [hours, minutes] = env.EVENING_REMINDER_TIME.split(':').map(Number);
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (scheduledTime < new Date()) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const usersResult = await query<User>(
      'SELECT * FROM users WHERE is_active = true AND deleted_at IS NULL'
    );

    let count = 0;
    for (const user of usersResult.rows) {
      const existingResult = await query(
        `SELECT 1 FROM reminders
         WHERE user_id = $1 AND reminder_type = 'evening'
         AND DATE(scheduled_time) = DATE($2) AND is_sent = false`,
        [user.user_id, scheduledTime]
      );

      if (existingResult.rows.length === 0) {
        await this.createReminder({
          user_id: user.user_id,
          reminder_type: 'evening',
          scheduled_time: scheduledTime,
        });
        count++;
      }
    }

    logger.info('Evening reminders scheduled', { count, scheduledTime });
    return count;
  }

  /**
   * Process and send a reminder
   */
  async processReminder(
    reminder: Reminder & { phone: string; name: string; preferred_language: string }
  ): Promise<boolean> {
    try {
      let message: string;

      switch (reminder.reminder_type) {
        case 'morning':
          message = await this.generateMorningMessage(reminder);
          break;
        case 'evening':
          message = await this.generateEveningMessage(reminder);
          break;
        case 'overdue':
          message = await this.generateOverdueMessage(reminder);
          break;
        case 'custom':
          message = reminder.message_template || 'You have a reminder from GIMS.';
          break;
        default:
          message = 'You have a notification from GIMS.';
      }

      await whatsappService.sendTextMessage(reminder.phone, message);
      await this.markReminderSent(reminder.reminder_id);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.markReminderFailed(reminder.reminder_id, errorMessage);
      return false;
    }
  }

  /**
   * Generate morning reminder message
   */
  private async generateMorningMessage(
    reminder: Reminder & { name: string; preferred_language: string }
  ): Promise<string> {
    const pendingTasks = await taskService.getPendingTasks(reminder.user_id);
    const todayTasks = await taskService.getTodaysTasks(reminder.user_id);

    const language = reminder.preferred_language as 'marathi' | 'hindi' | 'english';

    if (pendingTasks.length === 0 && todayTasks.length === 0) {
      const greetings = {
        marathi: `🌅 सुप्रभात ${reminder.name}!\n\nआज कोणतेही प्रलंबित कार्य नाही. चांगला दिवस जावो!`,
        hindi: `🌅 सुप्रभात ${reminder.name}!\n\nआज कोई लंबित कार्य नहीं है। अच्छा दिन हो!`,
        english: `🌅 Good morning ${reminder.name}!\n\nNo pending tasks today. Have a great day!`,
      };
      return greetings[language] || greetings.marathi;
    }

    // Generate summary using AI
    try {
      const tasks = [...pendingTasks, ...todayTasks].slice(0, 10).map((t) => ({
        category: (t as unknown as { name_marathi?: string }).name_marathi || `Category ${t.category_id}`,
        task_data: t.task_data,
        status: t.status,
        registration_date: t.registration_date.toString(),
      }));

      const summary = await geminiService.generateTaskSummary(tasks, language);

      const headers = {
        marathi: `🌅 सुप्रभात ${reminder.name}!\n\n📋 *आजचा कार्य सारांश:*\n\n`,
        hindi: `🌅 सुप्रभात ${reminder.name}!\n\n📋 *आज का कार्य सारांश:*\n\n`,
        english: `🌅 Good morning ${reminder.name}!\n\n📋 *Today's Task Summary:*\n\n`,
      };

      return (headers[language] || headers.marathi) + summary;
    } catch {
      // Fallback to simple message
      const simple = {
        marathi: `🌅 सुप्रभात ${reminder.name}!\n\n📋 तुमच्याकडे ${pendingTasks.length} प्रलंबित कार्ये आहेत.`,
        hindi: `🌅 सुप्रभात ${reminder.name}!\n\n📋 आपके पास ${pendingTasks.length} लंबित कार्य हैं।`,
        english: `🌅 Good morning ${reminder.name}!\n\n📋 You have ${pendingTasks.length} pending tasks.`,
      };
      return simple[language] || simple.marathi;
    }
  }

  /**
   * Generate evening reminder message
   */
  private async generateEveningMessage(
    reminder: Reminder & { name: string; preferred_language: string }
  ): Promise<string> {
    const todayTasks = await taskService.getTodaysTasks(reminder.user_id);
    const stats = await taskService.getTaskStats();

    const language = reminder.preferred_language as 'marathi' | 'hindi' | 'english';

    const completedToday = todayTasks.filter((t) => t.status === 'completed').length;
    const pendingToday = todayTasks.filter((t) => t.status === 'pending').length;

    const messages = {
      marathi: `🌆 शुभ संध्याकाळ ${reminder.name}!\n\n📊 *आजचा अहवाल:*\n• एकूण नोंदणी: ${todayTasks.length}\n• पूर्ण: ${completedToday}\n• प्रलंबित: ${pendingToday}\n\nउद्याची तयारी करा! 🙏`,
      hindi: `🌆 शुभ संध्या ${reminder.name}!\n\n📊 *आज की रिपोर्ट:*\n• कुल पंजीकरण: ${todayTasks.length}\n• पूर्ण: ${completedToday}\n• लंबित: ${pendingToday}\n\nकल की तैयारी करें! 🙏`,
      english: `🌆 Good evening ${reminder.name}!\n\n📊 *Today's Report:*\n• Total Registered: ${todayTasks.length}\n• Completed: ${completedToday}\n• Pending: ${pendingToday}\n\nPrepare for tomorrow! 🙏`,
    };

    return messages[language] || messages.marathi;
  }

  /**
   * Generate overdue reminder message
   */
  private async generateOverdueMessage(
    reminder: Reminder & { name: string; preferred_language: string }
  ): Promise<string> {
    const language = reminder.preferred_language as 'marathi' | 'hindi' | 'english';

    // Get the specific task if registry_id is provided
    let taskInfo = '';
    if (reminder.registry_id) {
      const task = await taskService.getTaskWithCategory(reminder.registry_id);
      if (task) {
        taskInfo = `\n📋 ${task.category.name_marathi}`;
      }
    }

    const messages = {
      marathi: `⚠️ ${reminder.name}, तुमच्याकडे थकीत कार्य आहे!${taskInfo}\n\nकृपया लवकरात लवकर पूर्ण करा.`,
      hindi: `⚠️ ${reminder.name}, आपके पास बकाया कार्य है!${taskInfo}\n\nकृपया जल्द से जल्द पूरा करें।`,
      english: `⚠️ ${reminder.name}, you have an overdue task!${taskInfo}\n\nPlease complete it as soon as possible.`,
    };

    return messages[language] || messages.marathi;
  }

  /**
   * Delete old sent reminders (cleanup)
   */
  async cleanupOldReminders(daysToKeep: number = 30): Promise<number> {
    const sql = `
      DELETE FROM reminders
      WHERE is_sent = true AND sent_at < NOW() - INTERVAL '${daysToKeep} days'
      RETURNING reminder_id
    `;
    const result = await query(sql);
    logger.info('Old reminders cleaned up', { count: result.rowCount });
    return result.rowCount || 0;
  }

  /**
   * Get user's reminders
   */
  async getUserReminders(
    userId: string,
    filters?: { type?: ReminderType; isSent?: boolean }
  ): Promise<Reminder[]> {
    let sql = 'SELECT * FROM reminders WHERE user_id = $1';
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (filters?.type) {
      sql += ` AND reminder_type = $${paramIndex++}`;
      params.push(filters.type);
    }

    if (filters?.isSent !== undefined) {
      sql += ` AND is_sent = $${paramIndex++}`;
      params.push(filters.isSent);
    }

    sql += ' ORDER BY scheduled_time DESC';

    const result = await query<Reminder>(sql, params);
    return result.rows;
  }

  /**
   * Cancel a reminder
   */
  async cancelReminder(reminderId: string): Promise<boolean> {
    const sql = `
      DELETE FROM reminders
      WHERE reminder_id = $1 AND is_sent = false
      RETURNING reminder_id
    `;
    const result = await query(sql, [reminderId]);
    return (result.rowCount || 0) > 0;
  }
}

// Export singleton instance
export const reminderService = new ReminderService();
