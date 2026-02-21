import Bull, { Job } from 'bull';
import { bullRedisConfig } from '../config/redis';
import { logger } from '../utils/logger';
import { notificationService } from '../services/notification.service';

type NotificationType = 'overdue-alert' | 'morning-update' | 'evening-update' | 'daily-summary';

interface NotificationJobData {
  type: NotificationType;
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
 * Convert IST hour:minute to UTC cron expression
 * IST = UTC + 5:30
 */
function istToCronUTC(istHour: number, istMinute: number = 0): string {
  let totalMinutes = istHour * 60 + istMinute;
  totalMinutes -= 330; // Subtract 5h 30m
  if (totalMinutes < 0) totalMinutes += 1440;
  const utcHour = Math.floor(totalMinutes / 60);
  const utcMinute = totalMinutes % 60;
  return `${utcMinute} ${utcHour} * * *`;
}

/**
 * Schedule all notification timers
 *
 * Times (IST):
 *  9:00 AM — Overdue alert (tasks pending from previous days)
 * 10:00 AM — Morning update (pending tasks, what to focus on)
 *  6:00 PM — Evening update (what you did today, pending highlights)
 *  7:00 PM — Daily report to admins/managers
 */
export const initializeNotificationSchedules = async (): Promise<void> => {
  // Remove existing repeatable jobs to avoid duplicates
  const existingJobs = await notificationQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await notificationQueue.removeRepeatableByKey(job.key);
  }

  // Check for test mode
  const testMinutes = process.env.TEST_NOTIFICATION_MINUTES;

  if (testMinutes) {
    // Test mode: schedule all notifications X minutes from now
    const delay = parseInt(testMinutes) * 60 * 1000;
    const types: NotificationType[] = ['overdue-alert', 'morning-update', 'evening-update', 'daily-summary'];
    for (const type of types) {
      await notificationQueue.add(
        { type },
        { delay, jobId: `test-${type}-${Date.now()}` }
      );
    }
    logger.info(`TEST MODE: All notifications scheduled in ${testMinutes} minutes`);
    return;
  }

  // 9:00 AM IST — Overdue alerts
  const overdueCron = istToCronUTC(9, 0);
  await notificationQueue.add(
    { type: 'overdue-alert' },
    { repeat: { cron: overdueCron }, jobId: 'overdue-alert' }
  );

  // 10:00 AM IST — Morning update
  const morningCron = istToCronUTC(10, 0);
  await notificationQueue.add(
    { type: 'morning-update' },
    { repeat: { cron: morningCron }, jobId: 'morning-update' }
  );

  // 6:00 PM IST — Evening update
  const eveningCron = istToCronUTC(18, 0);
  await notificationQueue.add(
    { type: 'evening-update' },
    { repeat: { cron: eveningCron }, jobId: 'evening-update' }
  );

  // 7:00 PM IST — Daily summary to admins
  const dailyCron = istToCronUTC(19, 0);
  await notificationQueue.add(
    { type: 'daily-summary' },
    { repeat: { cron: dailyCron }, jobId: 'daily-summary' }
  );

  logger.info('Notification schedules initialized:');
  logger.info(`  9:00 AM IST — Overdue alerts     (cron: ${overdueCron})`);
  logger.info(`  10:00 AM IST — Morning update     (cron: ${morningCron})`);
  logger.info(`  6:00 PM IST — Evening update      (cron: ${eveningCron})`);
  logger.info(`  7:00 PM IST — Daily summary       (cron: ${dailyCron})`);
};

// Process notification queue
notificationQueue.process(async (job: Job<NotificationJobData>) => {
  const { type } = job.data;
  logger.info('Processing notification job', { type });

  switch (type) {
    case 'overdue-alert':
      return { success: true, type, ...await notificationService.sendOverdueAlerts() };
    case 'morning-update':
      return { success: true, type, ...await notificationService.sendMorningUpdate() };
    case 'evening-update':
      return { success: true, type, ...await notificationService.sendEveningUpdate() };
    case 'daily-summary':
      return { success: true, type, ...await notificationService.sendDailySummaryToAdmins() };
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
 * Trigger a specific notification type immediately (for testing via /testreminder)
 */
export const triggerNotification = async (type: NotificationType) => {
  return notificationQueue.add(
    { type },
    { jobId: `manual-${type}-${Date.now()}` }
  );
};
