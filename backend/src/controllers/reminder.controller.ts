import { Response } from 'express';
import { reminderService } from '../services/reminder.service';
import { sendSuccess, sendCreated, sendNoContent, sendNotFound } from '../utils/response';
import { AuthenticatedRequest, ReminderType } from '../types';

export class ReminderController {
  /**
   * Get all reminders for current user
   */
  async getReminders(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.user_id;
    const type = req.query.type as ReminderType | undefined;
    const isSent = req.query.is_sent !== undefined
      ? req.query.is_sent === 'true'
      : undefined;

    const reminders = await reminderService.getUserReminders(userId, { type, isSent });
    sendSuccess(res, reminders);
  }

  /**
   * Get single reminder
   */
  async getReminderById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const reminder = await reminderService.getReminderById(id);

    if (!reminder) {
      sendNotFound(res, 'Reminder not found');
      return;
    }

    sendSuccess(res, reminder);
  }

  /**
   * Create new reminder
   */
  async createReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
    const reminder = await reminderService.createReminder({
      user_id: req.body.user_id || req.user!.user_id,
      registry_id: req.body.registry_id,
      reminder_type: req.body.reminder_type,
      scheduled_time: new Date(req.body.scheduled_time),
      message_template: req.body.message_template,
    });

    sendCreated(res, reminder, 'Reminder created successfully');
  }

  /**
   * Update reminder (limited fields)
   */
  async updateReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
    // For now, just recreate - can implement proper update later
    const { id } = req.params;
    const existing = await reminderService.getReminderById(id);

    if (!existing) {
      sendNotFound(res, 'Reminder not found');
      return;
    }

    // Can only update if not sent
    if (existing.is_sent) {
      sendSuccess(res, existing, 'Reminder already sent, cannot update');
      return;
    }

    // Delete old and create new
    await reminderService.cancelReminder(id);

    const newReminder = await reminderService.createReminder({
      user_id: req.body.user_id || existing.user_id,
      registry_id: req.body.registry_id || existing.registry_id,
      reminder_type: req.body.reminder_type || existing.reminder_type,
      scheduled_time: req.body.scheduled_time
        ? new Date(req.body.scheduled_time)
        : existing.scheduled_time,
      message_template: req.body.message_template || existing.message_template,
    });

    sendSuccess(res, newReminder, 'Reminder updated successfully');
  }

  /**
   * Delete/cancel reminder
   */
  async deleteReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const cancelled = await reminderService.cancelReminder(id);

    if (!cancelled) {
      sendNotFound(res, 'Reminder not found or already sent');
      return;
    }

    sendNoContent(res);
  }

  /**
   * Manually send a reminder (admin only)
   */
  async sendReminder(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;

    const pendingReminders = await reminderService.getPendingReminders();
    const reminder = pendingReminders.find((r) => r.reminder_id === id);

    if (!reminder) {
      sendNotFound(res, 'Reminder not found or already sent');
      return;
    }

    const success = await reminderService.processReminder(
      reminder as typeof reminder & { phone: string; name: string; preferred_language: string }
    );

    if (success) {
      sendSuccess(res, null, 'Reminder sent successfully');
    } else {
      sendSuccess(res, null, 'Failed to send reminder');
    }
  }

  /**
   * Get pending reminders (for dashboard)
   */
  async getPendingReminders(req: AuthenticatedRequest, res: Response): Promise<void> {
    const reminders = await reminderService.getUserReminders(req.user!.user_id, {
      isSent: false,
    });

    sendSuccess(res, {
      reminders,
      count: reminders.length,
    });
  }

  /**
   * Schedule daily reminders (admin only)
   */
  async scheduleDailyReminders(req: AuthenticatedRequest, res: Response): Promise<void> {
    const morningCount = await reminderService.scheduleMorningReminders();
    const eveningCount = await reminderService.scheduleEveningReminders();

    sendSuccess(res, {
      scheduled: morningCount + eveningCount,
      morning: morningCount,
      evening: eveningCount,
    }, 'Daily reminders scheduled');
  }
}

export const reminderController = new ReminderController();
