import Bull, { Job } from 'bull';
import path from 'path';
import fs from 'fs';
import { bullRedisConfig } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { whatsappService } from '../services/whatsapp.service';
import { geminiService } from '../services/gemini.service';
import { taskService } from '../services/task.service';
import { WhatsAppMessage } from '../types';

interface MessageJobData {
  message: WhatsAppMessage;
  contact?: {
    profile: { name: string };
    wa_id: string;
  };
}

interface VoiceProcessJobData {
  registryId: string;
  mediaId: string;
  mimeType: string;
  from: string;
}

interface SendMessageJobData {
  to: string;
  text: string;
  type: 'text' | 'template' | 'interactive';
  templateName?: string;
  buttons?: Array<{ id: string; title: string }>;
}

// Create queue with Redis connection
const messageQueue = new Bull<MessageJobData>('message-processing', {
  redis: 'redis' in bullRedisConfig ? bullRedisConfig.redis : undefined,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

const voiceQueue = new Bull<VoiceProcessJobData>('voice-processing', {
  redis: 'redis' in bullRedisConfig ? bullRedisConfig.redis : undefined,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 2000,
    },
  },
});

const sendQueue = new Bull<SendMessageJobData>('send-message', {
  redis: 'redis' in bullRedisConfig ? bullRedisConfig.redis : undefined,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 500,
    },
  },
});

// Process incoming messages
messageQueue.process(async (job: Job<MessageJobData>) => {
  const { message, contact } = job.data;
  logger.info('Processing message', { messageId: message.id, type: message.type });

  try {
    // Mark message as read
    await whatsappService.markAsRead(message.id);

    switch (message.type) {
      case 'text':
        await processTextMessage(message, contact);
        break;
      case 'audio':
        await processAudioMessage(message, contact);
        break;
      case 'interactive':
        await processInteractiveMessage(message, contact);
        break;
      default:
        logger.warn('Unsupported message type', { type: message.type });
        await whatsappService.sendTextMessage(
          message.from,
          'क्षमस्व, हा संदेश प्रकार समर्थित नाही. कृपया मजकूर किंवा व्हॉइस संदेश पाठवा.'
        );
    }

    return { success: true, messageId: message.id };
  } catch (error) {
    logger.error('Failed to process message', { messageId: message.id, error });
    throw error;
  }
});

// Process text messages
async function processTextMessage(
  message: WhatsAppMessage,
  contact?: { profile: { name: string }; wa_id: string }
): Promise<void> {
  const text = message.text?.body || '';
  const from = message.from;

  // Check for commands
  if (text.toLowerCase() === 'hi' || text.toLowerCase() === 'hello' || text === 'नमस्कार') {
    const greeting = await geminiService.generateResponse(
      { userMessage: text, action: 'greeting' },
      'marathi'
    );
    await whatsappService.sendTextMessage(from, greeting);
    return;
  }

  if (text.toLowerCase() === 'menu' || text === 'मेनू') {
    const categories = await taskService.getCategories();
    await whatsappService.sendCategoryMenu(from, categories);
    return;
  }

  if (text.toLowerCase() === 'status' || text === 'स्थिती') {
    const stats = await taskService.getTaskStats();
    const statusMessage = `📊 *कार्य स्थिती:*\n\n` +
      `📋 एकूण: ${stats.total}\n` +
      `⏳ प्रलंबित: ${stats.pending}\n` +
      `🔄 प्रगतीत: ${stats.inProgress}\n` +
      `✅ पूर्ण: ${stats.completed}`;
    await whatsappService.sendTextMessage(from, statusMessage);
    return;
  }

  // Try to extract task from natural language
  const categories = await taskService.getCategories();
  const extracted = await geminiService.extractTaskData(text, categories, 'marathi');

  if (extracted.confidence > 0.7 && extracted.category_id) {
    // Create task
    // Note: In production, you'd look up or create the user first
    const task = await taskService.createTask(
      {
        category_id: extracted.category_id,
        task_data: extracted.task_data,
        input_mode: 'text',
        input_language: 'marathi',
        original_input: text,
        priority: extracted.priority,
      },
      'system-user' // Replace with actual user lookup
    );

    const category = await taskService.getCategoryById(extracted.category_id);
    await whatsappService.sendTaskConfirmation(from, {
      registryId: task.registry_id,
      category: category?.name_marathi || 'Unknown',
      summary: extracted.summary,
      date: new Date().toLocaleDateString('en-IN'),
    });
  } else {
    // Ask for clarification
    const clarification = await geminiService.generateResponse(
      {
        userMessage: text,
        action: 'clarification',
        data: { possibleCategory: extracted.category_id },
      },
      'marathi'
    );
    await whatsappService.sendTextMessage(from, clarification);
  }
}

// Process audio/voice messages
async function processAudioMessage(
  message: WhatsAppMessage,
  contact?: { profile: { name: string }; wa_id: string }
): Promise<void> {
  const from = message.from;
  const audioId = message.audio?.id;
  const mimeType = message.audio?.mime_type || 'audio/ogg';

  if (!audioId) {
    await whatsappService.sendTextMessage(from, 'व्हॉइस संदेश प्राप्त करण्यात त्रुटी.');
    return;
  }

  // Acknowledge receipt
  await whatsappService.sendTextMessage(
    from,
    '🎤 व्हॉइस संदेश प्राप्त झाला. प्रक्रिया सुरू आहे...'
  );

  // Add to voice processing queue
  await voiceQueue.add({
    registryId: '', // Will be created after processing
    mediaId: audioId,
    mimeType,
    from,
  });
}

// Process interactive messages (button clicks, list selections)
async function processInteractiveMessage(
  message: WhatsAppMessage,
  contact?: { profile: { name: string }; wa_id: string }
): Promise<void> {
  // TODO: Handle interactive responses (category selection, confirmations)
  logger.info('Interactive message received', { message });
}

// Process voice messages
voiceQueue.process(async (job: Job<VoiceProcessJobData>) => {
  const { mediaId, mimeType, from } = job.data;

  try {
    // Download audio
    const audioBuffer = await whatsappService.downloadMedia(mediaId);

    // Save to disk
    const voiceDir = env.VOICE_MESSAGE_DIR;
    if (!fs.existsSync(voiceDir)) {
      fs.mkdirSync(voiceDir, { recursive: true });
    }
    const fileName = `voice_${Date.now()}.ogg`;
    const filePath = path.join(voiceDir, fileName);
    fs.writeFileSync(filePath, audioBuffer);

    // Transcribe
    const transcription = await geminiService.transcribeAudio(audioBuffer, mimeType);

    // Extract task data
    const categories = await taskService.getCategories();
    const extracted = await geminiService.extractTaskData(
      transcription.text,
      categories,
      transcription.language
    );

    if (extracted.confidence > 0.6 && extracted.category_id) {
      // Create task
      const task = await taskService.createTask(
        {
          category_id: extracted.category_id,
          task_data: extracted.task_data,
          input_mode: 'voice',
          input_language: transcription.language,
          transcription: transcription.text,
          priority: extracted.priority,
        },
        'system-user' // Replace with actual user lookup
      );

      // Save voice message record
      await taskService.saveVoiceMessage(task.registry_id, {
        audioFilePath: filePath,
        fileSizeBytes: audioBuffer.length,
        detectedLanguage: transcription.language,
        transcription: transcription.text,
        confidenceScore: transcription.confidence,
      });

      // Send confirmation
      const category = await taskService.getCategoryById(extracted.category_id);
      await whatsappService.sendTaskConfirmation(from, {
        registryId: task.registry_id,
        category: category?.name_marathi || 'Unknown',
        summary: extracted.summary,
        date: new Date().toLocaleDateString('en-IN'),
      });
    } else {
      // Send transcription and ask for clarification
      await whatsappService.sendTextMessage(
        from,
        `📝 *ट्रान्सक्रिप्शन:*\n${transcription.text}\n\n` +
          `कृपया श्रेणी निवडा किंवा अधिक माहिती द्या:`
      );
      const categories_list = await taskService.getCategories();
      await whatsappService.sendCategoryMenu(from, categories_list);
    }

    return { success: true };
  } catch (error) {
    logger.error('Voice processing failed', { mediaId, error });
    await whatsappService.sendTextMessage(
      from,
      '❌ व्हॉइस संदेश प्रक्रियेत त्रुटी. कृपया पुन्हा प्रयत्न करा.'
    );
    throw error;
  }
});

// Process outgoing messages
sendQueue.process(async (job: Job<SendMessageJobData>) => {
  const { to, text, type } = job.data;

  try {
    if (type === 'text') {
      await whatsappService.sendTextMessage(to, text);
    }
    return { success: true };
  } catch (error) {
    logger.error('Failed to send message', { to, error });
    throw error;
  }
});

// Queue event handlers
[messageQueue, voiceQueue, sendQueue].forEach((queue) => {
  queue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed`, { queue: queue.name, error: err.message });
  });

  queue.on('completed', (job, result) => {
    logger.debug(`Job ${job.id} completed`, { queue: queue.name });
  });
});

// Export queues and helper functions
export { messageQueue, voiceQueue, sendQueue };

export const addMessageJob = (data: MessageJobData) => messageQueue.add(data);
export const addVoiceJob = (data: VoiceProcessJobData) => voiceQueue.add(data);
export const addSendJob = (data: SendMessageJobData) => sendQueue.add(data);

export const closeQueues = async () => {
  await messageQueue.close();
  await voiceQueue.close();
  await sendQueue.close();
  logger.info('All queues closed');
};
