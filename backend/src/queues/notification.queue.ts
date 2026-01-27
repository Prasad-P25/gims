import Bull, { Job } from 'bull';
import { bullRedisConfig } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { notificationService } from '../services/notification.service';

interface NotificationJobData {
  type: 'daily-summary';
}

// Create queue
const notificationQueue = new Bull<NotificationJobData>('notification', {
  redis: 'redis' in bullRedisConfig ? bullRedisConfig.redis : undefined,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 10,
  },
});

/**
 * Initialize notification schedules
 * Daily summary at 8 PM IST (14:30 UTC since IST is UTC+5:30)
 *
 * For testing: Set TEST_NOTIFICATION_MINUTES env var to trigger X minutes from now
 */
export const initializeNotificationSchedules = async (): Promise<void> => {
  // Remove existing repeatable jobs to avoid duplicates
  const existingJobs = await notificationQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await notificationQueue.removeRepeatableByKey(job.key);
  }

  // Check if we're in test mode (trigger in X minutes)
  const testMinutes = process.env.TEST_NOTIFICATION_MINUTES;

  if (testMinutes) {
    const now = new Date();
    const triggerTime = new Date(now.getTime() + parseInt(testMinutes) * 60000);
    const minute = triggerTime.getMinutes();
    const hour = triggerTime.getHours();

    await notificationQueue.add(
      { type: 'daily-summary' },
      {
        repeat: { cron: `${minute} ${hour} * * *` },
        jobId: 'daily-summary-notification',
      }
    );

    logger.info(`TEST MODE: Notification scheduled for ${hour}:${minute.toString().padStart(2, '0')} (in ${testMinutes} minutes)`);
  } else {
    // Convert IST hour to UTC (IST = UTC + 5:30)
    const istHour = env.DAILY_NOTIFICATION_HOUR;
    const istMinutes = istHour * 60; // IST time in minutes from midnight
    let utcMinutes = istMinutes - 330; // Subtract 5:30 (330 minutes)
    if (utcMinutes < 0) utcMinutes += 1440; // Wrap around if negative
    const utcHour = Math.floor(utcMinutes / 60);
    const utcMinute = utcMinutes % 60;

    await notificationQueue.add(
      { type: 'daily-summary' },
      {
        repeat: { cron: `${utcMinute} ${utcHour} * * *` },
        jobId: 'daily-summary-notification',
      }
    );

    logger.info(`Notification schedules initialized (Daily summary at ${istHour}:00 IST / ${utcHour}:${utcMinute.toString().padStart(2, '0')} UTC)`);
  }
};

// Process notification queue
notificationQueue.process(async (job: Job<NotificationJobData>) => {
  const { type } = job.data;
  logger.info('Processing notification job', { type });

  switch (type) {
    case 'daily-summary':
      const result = await notificationService.sendDailySummaryToAdmins();
      return { success: true, ...result };
    default:
      logger.warn('Unknown notification job type', { type });
      return { success: false, reason: 'unknown_type' };
  }
});

// Event handlers
notificationQueue.on('completed', (job, result) => {
  logger.info('Notification job completed', { jobId: job.id, result });
});

notificationQueue.on('failed', (job, err) => {
  logger.error(`Notification job ${job.id} failed`, { error: err.message });
});

// Export
export { notificationQueue };

export const closeNotificationQueue = async () => {
  await notificationQueue.close();
  logger.info('Notification queue closed');
};

/**
 * Manually trigger daily summary (for testing)
 */
export const triggerDailySummary = async () => {
  return notificationQueue.add({ type: 'daily-summary' });
};

/**
 * Schedule a test notification after X minutes
 */
export const scheduleTestNotification = async (minutes: number) => {
  const delay = minutes * 60 * 1000; // Convert to milliseconds
  return notificationQueue.add(
    { type: 'daily-summary' },
    { delay, jobId: `test-notification-${Date.now()}` }
  );
};
