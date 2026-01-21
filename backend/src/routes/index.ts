import { Router } from 'express';
import authRoutes from './auth.routes';
import webhookRoutes from './webhook.routes';
import taskRoutes from './task.routes';
import dashboardRoutes from './dashboard.routes';
import reportRoutes from './report.routes';
import reminderRoutes from './reminder.routes';

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

export default router;
