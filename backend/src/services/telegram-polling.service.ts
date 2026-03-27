import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { addTelegramMessageJob } from '../queues/telegram.queue';
import { TelegramUpdate, isTelegramConfigured } from './telegram.service';

const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const POLL_TIMEOUT = 30; // long-poll timeout in seconds

let isPolling = false;
let shouldStop = false;
let lastOffset = 0;

async function pollUpdates(): Promise<void> {
  while (!shouldStop) {
    try {
      const response = await axios.get(`${TELEGRAM_API}/getUpdates`, {
        params: {
          offset: lastOffset,
          timeout: POLL_TIMEOUT,
          allowed_updates: ['message', 'callback_query'],
        },
        timeout: (POLL_TIMEOUT + 5) * 1000, // axios timeout slightly longer
      });

      const updates: TelegramUpdate[] = response.data.result || [];

      for (const update of updates) {
        lastOffset = update.update_id + 1;

        if (update.message) {
          logger.info('Telegram poll: message received', {
            chatId: update.message.chat.id,
            from: update.message.from?.username || update.message.from?.first_name,
            type: update.message.text ? 'text' : update.message.voice ? 'voice' : 'other',
          });

          await addTelegramMessageJob({ message: update.message });
        }

        if (update.callback_query) {
          logger.info('Telegram poll: callback received', {
            chatId: update.callback_query.message?.chat.id,
            data: update.callback_query.data,
          });

          await addTelegramMessageJob({
            message: update.callback_query.message,
            callbackQuery: update.callback_query,
          });
        }
      }
    } catch (error: any) {
      if (shouldStop) break;
      logger.error('Telegram polling error', { error: error.message });
      // Wait before retrying on error
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  isPolling = false;
  logger.info('Telegram polling stopped');
}

export async function startTelegramPolling(): Promise<void> {
  if (!isTelegramConfigured()) {
    logger.warn('Telegram bot token not configured, skipping polling');
    return;
  }

  if (isPolling) {
    logger.warn('Telegram polling already running');
    return;
  }

  // Delete any existing webhook so polling works
  try {
    await axios.post(`${TELEGRAM_API}/deleteWebhook`);
    logger.info('Telegram webhook cleared for polling mode');
  } catch (error: any) {
    logger.error('Failed to clear webhook', { error: error.message });
  }

  isPolling = true;
  shouldStop = false;
  logger.info('Telegram polling started');
  pollUpdates(); // fire and forget
}

export async function stopTelegramPolling(): Promise<void> {
  shouldStop = true;
}
