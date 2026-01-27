import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Check if Telegram is configured
export const isTelegramConfigured = (): boolean => {
  return !!TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN.length > 10;
};

export interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  date: number;
  text?: string;
  voice?: {
    file_id: string;
    file_unique_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
  };
  audio?: {
    file_id: string;
    file_unique_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
  };
}

export interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

class TelegramService {
  /**
   * Send a text message to a chat
   */
  async sendMessage(chatId: number, text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<void> {
    if (!isTelegramConfigured()) {
      logger.error('Cannot send message - Telegram bot token not configured');
      throw new Error('Telegram bot token not configured');
    }

    try {
      logger.info('Sending Telegram message', { chatId, textLength: text.length });
      const response = await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      });

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }

      logger.info('Telegram message sent successfully', { chatId, messageId: response.data.result?.message_id });
    } catch (error: any) {
      logger.error('Failed to send Telegram message', {
        chatId,
        error: error.message,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Send a message with inline keyboard buttons
   */
  async sendMessageWithButtons(
    chatId: number,
    text: string,
    buttons: Array<{ text: string; callback_data: string }[]>
  ): Promise<void> {
    try {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: buttons,
        },
      });
    } catch (error: any) {
      logger.error('Failed to send Telegram message with buttons', { chatId, error: error.message });
      throw error;
    }
  }

  /**
   * Get file path from Telegram servers
   */
  async getFilePath(fileId: string): Promise<string> {
    try {
      logger.info('Getting file path from Telegram', { fileId });
      const response = await axios.get(`${TELEGRAM_API}/getFile`, {
        params: { file_id: fileId },
      });

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }

      logger.info('Got file path', { filePath: response.data.result.file_path });
      return response.data.result.file_path;
    } catch (error: any) {
      logger.error('Failed to get file path', { fileId, error: error.message, response: error.response?.data });
      throw error;
    }
  }

  /**
   * Download a file from Telegram servers
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    try {
      if (!isTelegramConfigured()) {
        throw new Error('Telegram bot token not configured');
      }

      const filePath = await this.getFilePath(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;

      logger.info('Downloading file from Telegram', { fileUrl: fileUrl.replace(TELEGRAM_BOT_TOKEN, '***') });

      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
      });

      const buffer = Buffer.from(response.data);
      logger.info('File downloaded successfully', { size: buffer.length });

      return buffer;
    } catch (error: any) {
      logger.error('Failed to download file', {
        fileId,
        error: error.message,
        code: error.code,
        response: error.response?.status
      });
      throw error;
    }
  }

  /**
   * Set webhook URL for receiving updates
   */
  async setWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const response = await axios.post(`${TELEGRAM_API}/setWebhook`, {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
      });
      logger.info('Telegram webhook set', { webhookUrl, result: response.data });
      return response.data.ok;
    } catch (error: any) {
      logger.error('Failed to set webhook', { webhookUrl, error: error.message });
      throw error;
    }
  }

  /**
   * Delete webhook (for switching to polling mode)
   */
  async deleteWebhook(): Promise<boolean> {
    try {
      const response = await axios.post(`${TELEGRAM_API}/deleteWebhook`);
      logger.info('Telegram webhook deleted');
      return response.data.ok;
    } catch (error: any) {
      logger.error('Failed to delete webhook', { error: error.message });
      throw error;
    }
  }

  /**
   * Get webhook info
   */
  async getWebhookInfo(): Promise<any> {
    try {
      const response = await axios.get(`${TELEGRAM_API}/getWebhookInfo`);
      return response.data.result;
    } catch (error: any) {
      logger.error('Failed to get webhook info', { error: error.message });
      throw error;
    }
  }

  /**
   * Send "typing" action to show the bot is processing
   */
  async sendTypingAction(chatId: number): Promise<void> {
    try {
      await axios.post(`${TELEGRAM_API}/sendChatAction`, {
        chat_id: chatId,
        action: 'typing',
      });
    } catch (error: any) {
      // Ignore errors for typing action
      logger.debug('Failed to send typing action', { error: error.message });
    }
  }

  /**
   * Send task confirmation message
   */
  async sendTaskConfirmation(
    chatId: number,
    taskData: {
      registryId: string;
      category: string;
      summary: string;
      date: string;
      dueDate?: string;
    }
  ): Promise<void> {
    const message = `
<b>Task Registered Successfully!</b>

<b>ID:</b> <code>${taskData.registryId}</code>
<b>Category:</b> ${taskData.category}
<b>Summary:</b> ${taskData.summary}
<b>Date:</b> ${taskData.date}
${taskData.dueDate ? `<b>Due Date:</b> ${taskData.dueDate}` : ''}

Type <b>/status</b> to see all task statistics.
Type <b>/today</b> to see today's tasks.
    `.trim();

    await this.sendMessage(chatId, message);
  }

  /**
   * Send category menu as inline buttons
   */
  async sendCategoryMenu(
    chatId: number,
    categories: Array<{ category_id: number; name_english: string; name_marathi: string }>
  ): Promise<void> {
    const buttons = categories.map((cat) => ([
      {
        text: `${cat.name_marathi} (${cat.name_english})`,
        callback_data: `category_${cat.category_id}`,
      },
    ]));

    await this.sendMessageWithButtons(
      chatId,
      '<b>Select a category:</b>\nश्रेणी निवडा:',
      buttons
    );
  }

  /**
   * Answer a callback query (acknowledge button click)
   */
  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    try {
      await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: text || '',
      });
    } catch (error: any) {
      logger.error('Failed to answer callback query', { error: error.message });
    }
  }
}

export const telegramService = new TelegramService();
