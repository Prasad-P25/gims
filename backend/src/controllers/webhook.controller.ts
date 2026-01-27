import { Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { addMessageJob } from '../queues/message.queue';
import { addTelegramMessageJob } from '../queues/telegram.queue';
import { telegramService, TelegramUpdate } from '../services/telegram.service';
import { notificationService } from '../services/notification.service';
import { scheduleTestNotification } from '../queues/notification.queue';
import { WhatsAppWebhookPayload } from '../types';

export class WebhookController {
  /**
   * WhatsApp webhook verification (GET request from Meta)
   */
  verifyWebhook(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    logger.info('WhatsApp webhook verification', { mode, hasToken: !!token });

    if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
      logger.info('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      logger.warn('Webhook verification failed');
      res.sendStatus(403);
    }
  }

  /**
   * Handle incoming WhatsApp webhook (POST)
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    // Always respond 200 immediately
    res.sendStatus(200);

    const payload = req.body as WhatsAppWebhookPayload;

    if (payload.object !== 'whatsapp_business_account') {
      logger.debug('Ignoring non-WhatsApp webhook', { object: payload.object });
      return;
    }

    // Process each entry
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;

        // Handle incoming messages
        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            logger.info('Incoming message', {
              from: message.from,
              type: message.type,
              id: message.id,
            });

            // Queue for async processing
            await addMessageJob({
              message,
              contact: value.contacts?.[0],
            });
          }
        }

        // Handle status updates (delivery receipts)
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            logger.debug('Message status update', {
              messageId: status.id,
              status: status.status,
              recipient: status.recipient_id,
            });

            // TODO: Update message status in database if tracking delivery
          }
        }
      }
    }
  }

  /**
   * Test webhook endpoint (development only)
   */
  testWebhook(req: Request, res: Response): void {
    if (env.NODE_ENV === 'production') {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    logger.info('Test webhook received', { body: req.body });
    res.json({ received: true, body: req.body });
  }

  /**
   * Handle incoming Telegram webhook (POST)
   */
  async handleTelegramWebhook(req: Request, res: Response): Promise<void> {
    // Always respond 200 immediately
    res.sendStatus(200);

    const update = req.body as TelegramUpdate;

    logger.info('Telegram webhook received', { updateId: update.update_id });

    // Handle message updates
    if (update.message) {
      logger.info('Telegram message received', {
        chatId: update.message.chat.id,
        from: update.message.from?.username || update.message.from?.first_name,
        type: update.message.text ? 'text' : update.message.voice ? 'voice' : 'other',
      });

      // Queue for async processing
      await addTelegramMessageJob({
        message: update.message,
      });
    }

    // Handle callback query (button clicks)
    if (update.callback_query) {
      logger.info('Telegram callback received', {
        chatId: update.callback_query.message?.chat.id,
        data: update.callback_query.data,
        from: update.callback_query.from?.username || update.callback_query.from?.first_name,
      });

      // Queue for async processing
      await addTelegramMessageJob({
        message: update.callback_query.message,
        callbackQuery: update.callback_query,
      });
    }
  }

  /**
   * Setup Telegram webhook
   */
  async setupTelegramWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhookUrl = req.query.url as string;

      if (!webhookUrl) {
        // Return current webhook info
        const info = await telegramService.getWebhookInfo();
        res.json({
          message: 'Current webhook info',
          info,
          setup_url: 'Add ?url=YOUR_WEBHOOK_URL to set webhook',
        });
        return;
      }

      // Set webhook
      const fullUrl = `${webhookUrl}/api/webhook/telegram`;
      const success = await telegramService.setWebhook(fullUrl);

      if (success) {
        res.json({
          message: 'Webhook set successfully',
          webhook_url: fullUrl,
        });
      } else {
        res.status(500).json({ error: 'Failed to set webhook' });
      }
    } catch (error: any) {
      logger.error('Failed to setup Telegram webhook', { error });
      res.status(500).json({ error: error.message });
    }
  }
  /**
   * Trigger daily summary notification (for testing)
   */
  async triggerDailySummary(req: Request, res: Response): Promise<void> {
    if (env.NODE_ENV === 'production') {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    try {
      logger.info('Manually triggering daily summary notification');
      const result = await notificationService.sendDailySummaryToAdmins();
      res.json({
        message: 'Daily summary sent',
        ...result,
      });
    } catch (error: any) {
      logger.error('Failed to trigger daily summary', { error });
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Schedule a test notification after X minutes (for testing)
   */
  async scheduleTestNotification(req: Request, res: Response): Promise<void> {
    if (env.NODE_ENV === 'production') {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    try {
      const minutes = parseInt(req.query.minutes as string) || 2;
      logger.info(`Scheduling test notification in ${minutes} minutes`);

      await scheduleTestNotification(minutes);

      const triggerTime = new Date(Date.now() + minutes * 60000);
      res.json({
        message: `Notification scheduled`,
        triggerIn: `${minutes} minutes`,
        triggerAt: triggerTime.toLocaleTimeString('en-IN'),
      });
    } catch (error: any) {
      logger.error('Failed to schedule test notification', { error });
      res.status(500).json({ error: error.message });
    }
  }
}

export const webhookController = new WebhookController();
