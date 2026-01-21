import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { WhatsAppMessage } from '../types';

interface SendMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

interface MediaUploadResponse {
  id: string;
}

interface MessageTemplate {
  name: string;
  language: { code: string };
  components?: Array<{
    type: string;
    parameters: Array<{
      type: string;
      text?: string;
    }>;
  }>;
}

export class WhatsAppService {
  private client: AxiosInstance;
  private phoneNumberId: string;

  constructor() {
    this.phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    this.client = axios.create({
      baseURL: `${env.WHATSAPP_API_URL}/${this.phoneNumberId}`,
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Send a text message to a WhatsApp number
   */
  async sendTextMessage(to: string, text: string): Promise<string> {
    try {
      const response = await this.client.post<SendMessageResponse>('/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(to),
        type: 'text',
        text: { body: text },
      });

      const messageId = response.data.messages[0]?.id;
      logger.info('Text message sent', { to, messageId });
      return messageId;
    } catch (error) {
      logger.error('Failed to send text message', { to, error });
      throw error;
    }
  }

  /**
   * Send a template message (for notifications, reminders)
   */
  async sendTemplateMessage(
    to: string,
    template: MessageTemplate
  ): Promise<string> {
    try {
      const response = await this.client.post<SendMessageResponse>('/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(to),
        type: 'template',
        template,
      });

      const messageId = response.data.messages[0]?.id;
      logger.info('Template message sent', { to, template: template.name, messageId });
      return messageId;
    } catch (error) {
      logger.error('Failed to send template message', { to, template: template.name, error });
      throw error;
    }
  }

  /**
   * Send an interactive message with buttons
   */
  async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText?: string
  ): Promise<string> {
    try {
      const interactive: Record<string, unknown> = {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map((btn) => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title },
          })),
        },
      };

      if (headerText) {
        interactive.header = { type: 'text', text: headerText };
      }
      if (footerText) {
        interactive.footer = { text: footerText };
      }

      const response = await this.client.post<SendMessageResponse>('/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(to),
        type: 'interactive',
        interactive,
      });

      const messageId = response.data.messages[0]?.id;
      logger.info('Interactive message sent', { to, messageId });
      return messageId;
    } catch (error) {
      logger.error('Failed to send interactive message', { to, error });
      throw error;
    }
  }

  /**
   * Send an interactive list message
   */
  async sendInteractiveList(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    headerText?: string,
    footerText?: string
  ): Promise<string> {
    try {
      const interactive: Record<string, unknown> = {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonText,
          sections,
        },
      };

      if (headerText) {
        interactive.header = { type: 'text', text: headerText };
      }
      if (footerText) {
        interactive.footer = { text: footerText };
      }

      const response = await this.client.post<SendMessageResponse>('/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(to),
        type: 'interactive',
        interactive,
      });

      const messageId = response.data.messages[0]?.id;
      logger.info('List message sent', { to, messageId });
      return messageId;
    } catch (error) {
      logger.error('Failed to send list message', { to, error });
      throw error;
    }
  }

  /**
   * Download media (voice messages, images, etc.)
   */
  async downloadMedia(mediaId: string): Promise<Buffer> {
    try {
      // First, get the media URL
      const mediaInfoResponse = await axios.get(
        `${env.WHATSAPP_API_URL}/${mediaId}`,
        {
          headers: {
            Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          },
        }
      );

      const mediaUrl = mediaInfoResponse.data.url;

      // Then download the actual media
      const mediaResponse = await axios.get(mediaUrl, {
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        },
        responseType: 'arraybuffer',
      });

      logger.info('Media downloaded', { mediaId, size: mediaResponse.data.length });
      return Buffer.from(mediaResponse.data);
    } catch (error) {
      logger.error('Failed to download media', { mediaId, error });
      throw error;
    }
  }

  /**
   * Upload media to WhatsApp
   */
  async uploadMedia(
    fileBuffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer], { type: mimeType }), filename);
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', mimeType);

      const response = await axios.post<MediaUploadResponse>(
        `${env.WHATSAPP_API_URL}/${this.phoneNumberId}/media`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          },
        }
      );

      logger.info('Media uploaded', { mediaId: response.data.id });
      return response.data.id;
    } catch (error) {
      logger.error('Failed to upload media', { filename, error });
      throw error;
    }
  }

  /**
   * Send a document
   */
  async sendDocument(
    to: string,
    mediaId: string,
    filename: string,
    caption?: string
  ): Promise<string> {
    try {
      const response = await this.client.post<SendMessageResponse>('/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(to),
        type: 'document',
        document: {
          id: mediaId,
          filename,
          caption,
        },
      });

      const messageId = response.data.messages[0]?.id;
      logger.info('Document sent', { to, messageId, filename });
      return messageId;
    } catch (error) {
      logger.error('Failed to send document', { to, filename, error });
      throw error;
    }
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.client.post('/messages', {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
      logger.debug('Message marked as read', { messageId });
    } catch (error) {
      logger.error('Failed to mark message as read', { messageId, error });
      // Don't throw - this is not critical
    }
  }

  /**
   * Send category selection menu in Marathi
   */
  async sendCategoryMenu(to: string, categories: Array<{ category_id: number; name_marathi: string }>): Promise<string> {
    const sections = [
      {
        title: 'कार्य श्रेणी निवडा',
        rows: categories.map((cat) => ({
          id: `category_${cat.category_id}`,
          title: cat.name_marathi.substring(0, 24), // WhatsApp limit
        })),
      },
    ];

    return this.sendInteractiveList(
      to,
      'कृपया खालील यादीतून कार्य श्रेणी निवडा:\n\nPlease select a task category from the list below:',
      'श्रेणी पहा',
      sections,
      'GIMS - कार्य नोंदणी',
      'Government Information Management System'
    );
  }

  /**
   * Send task confirmation message
   */
  async sendTaskConfirmation(
    to: string,
    taskDetails: {
      registryId: string;
      category: string;
      summary: string;
      date: string;
    }
  ): Promise<string> {
    const message = `✅ *कार्य नोंदणी यशस्वी!*\n\n` +
      `📋 *नोंदणी क्रमांक:* ${taskDetails.registryId.substring(0, 8)}\n` +
      `📁 *श्रेणी:* ${taskDetails.category}\n` +
      `📅 *दिनांक:* ${taskDetails.date}\n\n` +
      `*तपशील:*\n${taskDetails.summary}\n\n` +
      `---\n` +
      `_Task registered successfully!_`;

    return this.sendTextMessage(to, message);
  }

  /**
   * Format phone number for WhatsApp API (add country code if needed)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');

    // If it's a 10-digit Indian number, add country code
    if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
      return `91${cleaned}`;
    }

    // If already has country code
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return cleaned;
    }

    return cleaned;
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService();
