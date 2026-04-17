import { Router } from 'express';
import authRoutes from './auth.routes';
import webhookRoutes from './webhook.routes';
import taskRoutes from './task.routes';
import dashboardRoutes from './dashboard.routes';
import reportRoutes from './report.routes';
import reminderRoutes from './reminder.routes';
import teamRoutes from './team.routes';
import auditRoutes from './audit.routes';
import notificationRoutes from './notification.routes';
import teamStatsRoutes from './teamStats.routes';
import profileRoutes from './profile.routes';
import projectRoutes from './project.routes';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/webhook', webhookRoutes);
router.use('/tasks', taskRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/reminders', reminderRoutes);
router.use('/teams', teamRoutes);
router.use('/audit', auditRoutes);
router.use('/notifications', notificationRoutes);
router.use('/team-stats', teamStatsRoutes);
router.use('/profile', profileRoutes);
router.use('/projects', projectRoutes);

export default router;
