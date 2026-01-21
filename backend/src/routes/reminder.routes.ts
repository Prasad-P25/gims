import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.middleware';
import { reminderCreateSchema, reminderUpdateSchema, uuidSchema, paginationSchema } from '../utils/validators';
import { asyncHandler } from '../middlewares/error.middleware';
import { reminderController } from '../controllers/reminder.controller';
import { AuthenticatedRequest } from '../types';
import { z } from 'zod';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// GET /api/reminders/status/pending - Get pending reminders (before :id route)
router.get(
  '/status/pending',
  asyncHandler((req, res) => reminderController.getPendingReminders(req as AuthenticatedRequest, res))
);

// POST /api/reminders/schedule-daily - Schedule daily reminders (admin only)
router.post(
  '/schedule-daily',
  authorize('admin'),
  asyncHandler((req, res) => reminderController.scheduleDailyReminders(req as AuthenticatedRequest, res))
);

// GET /api/reminders - Get all reminders
router.get(
  '/',
  validateQuery(paginationSchema.merge(z.object({
    type: z.enum(['morning', 'evening', 'overdue', 'custom']).optional(),
    is_sent: z.coerce.boolean().optional(),
  }))),
  asyncHandler((req, res) => reminderController.getReminders(req as AuthenticatedRequest, res))
);

// GET /api/reminders/:id - Get single reminder
router.get(
  '/:id',
  validateParams(z.object({ id: uuidSchema })),
  asyncHandler((req, res) => reminderController.getReminderById(req as AuthenticatedRequest, res))
);

// POST /api/reminders - Create new reminder
router.post(
  '/',
  validateBody(reminderCreateSchema),
  asyncHandler((req, res) => reminderController.createReminder(req as AuthenticatedRequest, res))
);

// PUT /api/reminders/:id - Update reminder
router.put(
  '/:id',
  validateParams(z.object({ id: uuidSchema })),
  validateBody(reminderUpdateSchema),
  asyncHandler((req, res) => reminderController.updateReminder(req as AuthenticatedRequest, res))
);

// DELETE /api/reminders/:id - Delete reminder
router.delete(
  '/:id',
  validateParams(z.object({ id: uuidSchema })),
  asyncHandler((req, res) => reminderController.deleteReminder(req as AuthenticatedRequest, res))
);

// POST /api/reminders/:id/send - Manually trigger reminder (admin only)
router.post(
  '/:id/send',
  authorize('admin'),
  validateParams(z.object({ id: uuidSchema })),
  asyncHandler((req, res) => reminderController.sendReminder(req as AuthenticatedRequest, res))
);

export default router;
