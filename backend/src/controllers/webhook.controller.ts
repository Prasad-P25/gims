import { Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { addMessageJob } from '../queues/message.queue';
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
}

export const webhookController = new WebhookController();
