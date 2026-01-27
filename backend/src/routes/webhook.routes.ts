import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { webhookController } from '../controllers/webhook.controller';

const router = Router();

// GET /api/webhook/whatsapp - Webhook verification (Meta requirement)
router.get('/whatsapp', (req, res) => webhookController.verifyWebhook(req, res));

// POST /api/webhook/whatsapp - Receive WhatsApp messages
router.post(
  '/whatsapp',
  asyncHandler((req, res) => webhookController.handleWebhook(req, res))
);

// POST /api/webhook/telegram - Receive Telegram messages
router.post(
  '/telegram',
  asyncHandler((req, res) => webhookController.handleTelegramWebhook(req, res))
);

// GET /api/webhook/telegram/setup - Setup Telegram webhook
router.get(
  '/telegram/setup',
  asyncHandler((req, res) => webhookController.setupTelegramWebhook(req, res))
);

// POST /api/webhook/test - Test webhook endpoint (development only)
router.post('/test', (req, res) => webhookController.testWebhook(req, res));

// POST /api/webhook/test-daily-summary - Test daily summary notification (development only)
router.post(
  '/test-daily-summary',
  asyncHandler((req, res) => webhookController.triggerDailySummary(req, res))
);

// GET /api/webhook/schedule-test-notification - Schedule a test notification (development only)
router.get(
  '/schedule-test-notification',
  asyncHandler((req, res) => webhookController.scheduleTestNotification(req, res))
);

export default router;
