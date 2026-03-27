import Bull, { Job } from 'bull';
import { bullRedisConfig } from '../config/redis';
import { logger } from '../utils/logger';
import { reminderService } from '../services/reminder.service';
import { Reminder } from '../types';

interface ReminderJobData {
  type: 'process-pending' | 'schedule-daily' | 'cleanup';
}

interface ProcessReminderJobData {
  reminderId: string;
}

// Create queues
const reminderScheduleQueue = new Bull<ReminderJobData>('reminder-schedule', {
  redis: 'redis' in bullRedisConfig ? bullRedisConfig.redis : undefined,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 10,
  },
});

const reminderProcessQueue = new Bull<ProcessReminderJobData>('reminder-process', {
  redis: 'redis' in bullRedisConfig ? bullRedisConfig.redis : undefined,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

// Schedule recurring jobs
export const initializeReminderSchedules = async (): Promise<void> => {
  // Process pending reminders every 15 minutes
  await reminderScheduleQueue.add(
    { type: 'process-pending' },
    {
      repeat: { cron: '*/15 * * * *' }, // Every 15 minutes
      jobId: 'process-pending-reminders',
    }
  );

  // Schedule daily reminders at midnight
  await reminderScheduleQueue.add(
    { type: 'schedule-daily' },
    {
      repeat: { cron: '0 0 * * *' }, // Midnight
      jobId: 'schedule-daily-reminders',
    }
  );

  // Cleanup old reminders weekly
  await reminderScheduleQueue.add(
    { type: 'cleanup' },
    {
      repeat: { cron: '0 2 * * 0' }, // 2 AM on Sundays
      jobId: 'cleanup-old-reminders',
    }
  );

  logger.info('Reminder schedules initialized');
};

// Process schedule queue
reminderScheduleQueue.process(async (job: Job<ReminderJobData>) => {
  const { type } = job.data;
  logger.debug('Processing reminder schedule job', { type });

  switch (type) {
    case 'process-pending':
      await processPendingReminders();
      break;
    case 'schedule-daily':
      await scheduleDailyReminders();
      break;
    case 'cleanup':
      await cleanupReminders();
      break;
  }

  return { success: true, type };
});

// Process individual reminders
reminderProcessQueue.process(async (job: Job<ProcessReminderJobData>) => {
  const { reminderId } = job.data;
  logger.debug('Processing individual reminder', { reminderId });

  const reminder = await reminderService.getReminderById(reminderId);
  if (!reminder) {
    logger.warn('Reminder not found', { reminderId });
    return { success: false, reason: 'not_found' };
  }

  // Get user info
  const reminderWithUser = (await reminderService.getPendingReminders())
    .find(r => r.reminder_id === reminderId);

  if (!reminderWithUser) {
    logger.warn('Reminder already processed or user not found', { reminderId });
    return { success: false, reason: 'already_processed' };
  }

  const success = await reminderService.processReminder(
    reminderWithUser as Reminder & { phone: string; name: string; preferred_language: string }
  );

  return { success, reminderId };
});

// Helper functions
async function processPendingReminders(): Promise<void> {
  try {
    const pendingReminders = await reminderService.getPendingReminders();
    logger.debug('Found pending reminders', { count: pendingReminders.length });

    for (const reminder of pendingReminders) {
      await reminderProcessQueue.add(
        { reminderId: reminder.reminder_id },
        { priority: reminder.reminder_type === 'overdue' ? 1 : 2 }
      );
    }
  } catch (error) {
    logger.error('Failed to process pending reminders', { error });
    throw error;
  }
}

async function scheduleDailyReminders(): Promise<void> {
  try {
    const morningCount = await reminderService.scheduleMorningReminders();
    const eveningCount = await reminderService.scheduleEveningReminders();
    logger.info('Daily reminders scheduled', { morning: morningCount, evening: eveningCount });
  } catch (error) {
    logger.error('Failed to schedule daily reminders', { error });
    throw error;
  }
}

async function cleanupReminders(): Promise<void> {
  try {
    const deletedCount = await reminderService.cleanupOldReminders(30);
    logger.info('Old reminders cleaned up', { deletedCount });
  } catch (error) {
    logger.error('Failed to cleanup reminders', { error });
    throw error;
  }
}

// Event handlers
reminderScheduleQueue.on('failed', (job, err) => {
  logger.error(`Reminder schedule job ${job.id} failed`, { error: err.message });
});

reminderProcessQueue.on('failed', (job, err) => {
  logger.error(`Reminder process job ${job.id} failed`, { error: err.message });
});

// Export
export { reminderScheduleQueue, reminderProcessQueue };

export const closeReminderQueues = async () => {
  await reminderScheduleQueue.close();
  await reminderProcessQueue.close();
  logger.info('Reminder queues closed');
};
