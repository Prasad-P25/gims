import Bull, { Job } from 'bull';
import path from 'path';
import fs from 'fs';
import { bullRedisConfig } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { query } from '../config/database';
import { telegramService, TelegramMessage } from '../services/telegram.service';
import { geminiService } from '../services/gemini.service';
import { taskService } from '../services/task.service';

// Helper function to get user by telegram ID or return default admin
async function getUserIdByTelegramId(telegramId: number): Promise<string> {
  // For now, return admin user - can be extended to map telegram users to system users
  const adminResult = await query(
    'SELECT user_id FROM users WHERE phone = $1 AND deleted_at IS NULL',
    ['9999999999']
  );

  if (adminResult.rows[0]) {
    return adminResult.rows[0].user_id;
  }

  // Fallback - get any active user
  const anyUser = await query(
    'SELECT user_id FROM users WHERE is_active = true AND deleted_at IS NULL LIMIT 1'
  );

  return anyUser.rows[0]?.user_id || '';
}

interface TelegramMessageJobData {
  message: TelegramMessage;
}

interface TelegramVoiceJobData {
  chatId: number;
  fileId: string;
  mimeType: string;
  userId: number;
}

// Create queues with Redis connection
const telegramMessageQueue = new Bull<TelegramMessageJobData>('telegram-message-processing', {
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

const telegramVoiceQueue = new Bull<TelegramVoiceJobData>('telegram-voice-processing', {
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

// Log when queue is ready
telegramMessageQueue.on('ready', () => {
  logger.info('Telegram message queue is ready');
});

telegramMessageQueue.on('error', (error) => {
  logger.error('Telegram message queue error', { error: error.message });
});

// Process incoming Telegram messages
telegramMessageQueue.process(async (job: Job<TelegramMessageJobData>) => {
  const { message } = job.data;
  const chatId = message.chat.id;

  logger.info('Processing Telegram message from queue', {
    jobId: job.id,
    messageId: message.message_id,
    chatId,
    text: message.text?.substring(0, 50),
    hasVoice: !!message.voice,
  });

  try {
    // Send typing action
    await telegramService.sendTypingAction(chatId);
    logger.debug('Typing action sent');

    if (message.voice || message.audio) {
      // Handle voice/audio message
      logger.info('Processing voice message');
      await processVoiceMessage(message);
    } else if (message.text) {
      // Handle text message
      logger.info('Processing text message', { text: message.text });
      await processTextMessage(message);
    } else {
      logger.warn('Unknown message type', { message });
      await telegramService.sendMessage(
        chatId,
        'Sorry, I only understand text and voice messages.\n\nक्षमस्व, मला फक्त मजकूर आणि व्हॉइस संदेश समजतात.'
      );
    }

    logger.info('Telegram message processed successfully', { messageId: message.message_id });
    return { success: true, messageId: message.message_id };
  } catch (error: any) {
    logger.error('Failed to process Telegram message', {
      messageId: message.message_id,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
});

logger.info('Telegram queue processor registered');

// Process text messages
async function processTextMessage(message: TelegramMessage): Promise<void> {
  const text = message.text || '';
  const chatId = message.chat.id;

  // Check for commands
  if (text.startsWith('/')) {
    await handleCommand(message);
    return;
  }

  // Check for greetings
  const greetings = ['hi', 'hello', 'hey', 'नमस्कार', 'नमस्ते', 'हाय'];
  if (greetings.some((g) => text.toLowerCase().includes(g))) {
    const greeting = `
<b>Welcome to GIMS Task Bot!</b>

<b>GIMS कार्य बॉट मध्ये आपले स्वागत!</b>

You can:
• Send a text message to create a task
• Send a voice message in Marathi/Hindi/English
• Use /status to see task statistics
• Use /today to see today's tasks
• Use /menu to see categories

तुम्ही:
• कार्य तयार करण्यासाठी मजकूर संदेश पाठवा
• मराठी/हिंदी/इंग्रजीमध्ये व्हॉइस संदेश पाठवा
• /status वापरून कार्य आकडेवारी पहा
• /today वापरून आजची कार्ये पहा
    `.trim();
    await telegramService.sendMessage(chatId, greeting);
    return;
  }

  // Check if message is too short or unclear
  if (text.length < 5) {
    await telegramService.sendMessage(
      chatId,
      `❓ <b>Message too short</b>\n\nPlease provide more details about the task.\n\nकृपया कार्याबद्दल अधिक माहिती द्या.\n\n<b>Example:</b> "उद्या सकाळी पाईप दुरुस्ती करायची आहे"`
    );
    return;
  }

  // Try to extract task from natural language
  const categories = await taskService.getCategories();
  const extracted = await geminiService.extractTaskData(text, categories, 'marathi');

  if (extracted.confidence > 0.7 && extracted.category_id) {
    // Create task
    const userId = await getUserIdByTelegramId(message.from.id);
    const task = await taskService.createTask(
      {
        category_id: extracted.category_id,
        task_data: extracted.task_data,
        input_mode: 'text',
        input_language: 'marathi',
        original_input: text,
        priority: extracted.priority,
      },
      userId
    );

    const category = await taskService.getCategoryById(extracted.category_id);
    await telegramService.sendTaskConfirmation(chatId, {
      registryId: task.registry_id,
      category: category?.name_marathi || category?.name_english || 'Unknown',
      summary: extracted.summary,
      date: new Date().toLocaleDateString('en-IN'),
      dueDate: extracted.task_data.due_date as string | undefined,
    });
  } else if (extracted.confidence > 0.4) {
    // Low confidence - ask for clarification with category menu
    await telegramService.sendMessage(
      chatId,
      `🤔 <b>I understood partially...</b>\n\n"${text}"\n\nPlease select a category or provide more details:\n\nकृपया श्रेणी निवडा किंवा अधिक माहिती द्या:`
    );
    const cats = await taskService.getCategories();
    await telegramService.sendCategoryMenu(chatId, cats);
  } else {
    // Very low confidence - couldn't understand at all
    await telegramService.sendMessage(
      chatId,
      `❓ <b>I couldn't understand your message</b>\n\nमला तुमचा संदेश समजला नाही.\n\nPlease try again with a clear task description.\nकृपया स्पष्ट कार्य वर्णनासह पुन्हा प्रयत्न करा.\n\n<b>Examples:</b>\n• "उद्या सकाळी पाईप दुरुस्ती करायची आहे"\n• "Road repair needed at Main Street"\n• "कल सुबह बिजली का काम करना है"\n\nOr use /menu to select a category manually.`
    );
  }
}

// Process voice messages
async function processVoiceMessage(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const fileId = message.voice?.file_id || message.audio?.file_id;
  const mimeType = message.voice?.mime_type || message.audio?.mime_type || 'audio/ogg';
  const duration = message.voice?.duration || message.audio?.duration || 0;
  const fileSize = message.voice?.file_size || message.audio?.file_size || 0;

  logger.info('Processing voice message', { chatId, fileId, mimeType, duration, fileSize });

  if (!fileId) {
    logger.error('No file ID in voice message', { message });
    await telegramService.sendMessage(chatId, 'Could not process voice message. No audio file found.');
    return;
  }

  // Acknowledge receipt
  await telegramService.sendMessage(
    chatId,
    '🎤 Voice message received. Processing...\n\nव्हॉइस संदेश प्राप्त झाला. प्रक्रिया सुरू आहे...'
  );

  try {
    // Download audio
    const audioBuffer = await telegramService.downloadFile(fileId);

    // Check if audio is too short (less than 1KB usually means empty or too short)
    if (audioBuffer.length < 1000) {
      await telegramService.sendMessage(
        chatId,
        `🎤 <b>Voice message too short</b>\n\nव्हॉइस संदेश खूप लहान आहे.\n\nPlease record a longer message with clear task details.\nकृपया स्पष्ट कार्य तपशीलांसह मोठा संदेश रेकॉर्ड करा.`
      );
      return;
    }

    // Save to disk
    const voiceDir = env.VOICE_MESSAGE_DIR;
    if (!fs.existsSync(voiceDir)) {
      fs.mkdirSync(voiceDir, { recursive: true });
    }
    const fileName = `telegram_voice_${Date.now()}.ogg`;
    const filePath = path.join(voiceDir, fileName);
    fs.writeFileSync(filePath, audioBuffer);

    // Transcribe
    const transcription = await geminiService.transcribeAudio(audioBuffer, mimeType);

    // Check if transcription is unclear or empty
    if (!transcription.text || transcription.text.trim().length < 5) {
      await telegramService.sendMessage(
        chatId,
        `🎤 <b>Could not understand the voice message</b>\n\nव्हॉइस संदेश समजला नाही.\n\nPlease try again:\n• Speak clearly and slowly\n• Reduce background noise\n• Hold the phone closer\n\nकृपया पुन्हा प्रयत्न करा:\n• स्पष्ट आणि हळू बोला\n• पार्श्वभूमी आवाज कमी करा`
      );
      return;
    }

    // Check transcription confidence
    if (transcription.confidence < 0.5) {
      await telegramService.sendMessage(
        chatId,
        `🎤 <b>Voice was not clear</b>\n\nव्हॉइस स्पष्ट नव्हता.\n\n📝 I heard: "${transcription.text}"\n\nIf this is incorrect, please record again more clearly.\nजर हे चुकीचे असेल तर कृपया अधिक स्पष्टपणे पुन्हा रेकॉर्ड करा.\n\nOr type your task as text instead.`
      );
      return;
    }

    // Extract task data
    const categories = await taskService.getCategories();
    const extracted = await geminiService.extractTaskData(
      transcription.text,
      categories,
      transcription.language
    );

    if (extracted.confidence > 0.6 && extracted.category_id) {
      // Create task
      const userId = await getUserIdByTelegramId(message.from.id);
      const task = await taskService.createTask(
        {
          category_id: extracted.category_id,
          task_data: extracted.task_data,
          input_mode: 'voice',
          input_language: transcription.language,
          transcription: transcription.text,
          priority: extracted.priority,
        },
        userId
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

      // First send transcription
      await telegramService.sendMessage(
        chatId,
        `📝 <b>Transcription:</b>\n${transcription.text}`
      );

      // Then send confirmation
      await telegramService.sendTaskConfirmation(chatId, {
        registryId: task.registry_id,
        category: category?.name_marathi || category?.name_english || 'Unknown',
        summary: extracted.summary,
        date: new Date().toLocaleDateString('en-IN'),
        dueDate: extracted.task_data.due_date as string | undefined,
      });
    } else if (extracted.confidence > 0.3) {
      // Partial understanding - show transcription and ask for category
      await telegramService.sendMessage(
        chatId,
        `📝 <b>Transcription:</b>\n${transcription.text}\n\n🤔 I understood partially. Please select a category:\n\nमला अंशतः समजले. कृपया श्रेणी निवडा:`
      );
      const cats = await taskService.getCategories();
      await telegramService.sendCategoryMenu(chatId, cats);
    } else {
      // Could not extract task - ask to repeat
      await telegramService.sendMessage(
        chatId,
        `📝 <b>Transcription:</b>\n${transcription.text}\n\n❓ <b>Could not identify a task</b>\n\nकार्य ओळखता आले नाही.\n\nPlease try again with a clearer task description, like:\n• "उद्या सकाळी पाईप दुरुस्ती करायची आहे"\n• "Tomorrow morning road repair work"\n\nOr use /menu to select a category first.`
      );
    }
  } catch (error: any) {
    logger.error('Voice processing failed', { chatId, error });
    await telegramService.sendMessage(
      chatId,
      `❌ <b>Voice processing failed</b>\n\nव्हॉइस प्रक्रिया अयशस्वी.\n\nPlease try again or send a text message instead.\nकृपया पुन्हा प्रयत्न करा किंवा मजकूर संदेश पाठवा.`
    );
  }
}

// Handle bot commands
async function handleCommand(message: TelegramMessage): Promise<void> {
  const text = message.text || '';
  const chatId = message.chat.id;
  const command = text.split(' ')[0].toLowerCase();

  switch (command) {
    case '/start':
    case '/help':
      const helpText = `
<b>GIMS Task Bot Commands:</b>

/start - Start the bot
/help - Show this help message
/status - Show full task overview with details
/today - Show today's tasks
/pending - Show all pending tasks
/menu - Show category menu

<b>How to use:</b>
• Send a text message describing your task
• Send a voice message in Marathi, Hindi, or English
• The bot will automatically categorize and register your task

<b>Example messages:</b>
• "उद्या सकाळी पाईप दुरुस्ती करायची आहे"
• "Road repair needed at Main Street tomorrow"
• "कल सुबह बिजली का काम करना है"
      `.trim();
      await telegramService.sendMessage(chatId, helpText);
      break;

    case '/status':
      const summary = await taskService.getAllTasksSummary();
      const stats = await taskService.getTaskStats();

      let statusMessage = `<b>📊 Task Status Overview</b>\n\n`;
      statusMessage += `📋 Total: ${stats.total} | ⏳ Pending: ${stats.pending} | 🔄 In Progress: ${stats.inProgress} | ✅ Completed: ${stats.completed}\n`;

      // Pending tasks
      if (summary.pending.length > 0) {
        statusMessage += `\n<b>⏳ Pending Tasks:</b>\n`;
        summary.pending.forEach((task: any, i: number) => {
          const title = task.task_data?.title || task.task_data?.description?.slice(0, 30) || 'Untitled';
          const priority = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
          statusMessage += `${i + 1}. ${priority} ${title}\n   └ ${task.name_marathi || task.name_english}\n`;
        });
      }

      // In Progress tasks
      if (summary.inProgress.length > 0) {
        statusMessage += `\n<b>🔄 In Progress:</b>\n`;
        summary.inProgress.forEach((task: any, i: number) => {
          const title = task.task_data?.title || task.task_data?.description?.slice(0, 30) || 'Untitled';
          statusMessage += `${i + 1}. ${title}\n   └ ${task.name_marathi || task.name_english}\n`;
        });
      }

      // Recently completed
      if (summary.completed.length > 0) {
        statusMessage += `\n<b>✅ Recently Completed:</b>\n`;
        summary.completed.slice(0, 3).forEach((task: any, i: number) => {
          const title = task.task_data?.title || task.task_data?.description?.slice(0, 30) || 'Untitled';
          statusMessage += `${i + 1}. ${title}\n`;
        });
      }

      if (stats.pending === 0 && stats.inProgress === 0) {
        statusMessage += `\n🎉 All caught up! No pending tasks.`;
      }

      await telegramService.sendMessage(chatId, statusMessage);
      break;

    case '/today':
      const todayTasks = await taskService.getTodayTasks();
      const todayStats = await taskService.getTaskStats();

      let todayMessage = `<b>📅 Today's Tasks</b>\n`;
      todayMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
      todayMessage += `📝 Registered: ${todayTasks.length} | ✅ Completed: ${todayStats.completedToday || 0}\n\n`;

      if (todayTasks.length > 0) {
        todayTasks.forEach((task: any, i: number) => {
          const title = task.task_data?.title || task.task_data?.description?.slice(0, 30) || 'Untitled';
          const statusIcon = task.status === 'completed' ? '✅' : task.status === 'in_progress' ? '🔄' : '⏳';
          const priority = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
          todayMessage += `${statusIcon} ${priority} <b>${title}</b>\n`;
          todayMessage += `   └ ${task.name_marathi || task.name_english}\n`;
          if (task.task_data?.due_date) {
            todayMessage += `   └ 📆 Due: ${task.task_data.due_date}\n`;
          }
          todayMessage += `\n`;
        });
      } else {
        todayMessage += `No tasks registered today.\n\nसंदेश पाठवा नवीन कार्य नोंदणीसाठी!\nSend a message to register a new task!`;
      }

      await telegramService.sendMessage(chatId, todayMessage);
      break;

    case '/pending':
      const pendingTasks = await taskService.getPendingTasks();

      if (pendingTasks.length === 0) {
        await telegramService.sendMessage(
          chatId,
          `✅ <b>No pending tasks!</b>\n\nकोणतेही प्रलंबित कार्य नाही!\n\nAll tasks are either completed or in progress.`
        );
        break;
      }

      let pendingMessage = `<b>⏳ All Pending Tasks (${pendingTasks.length})</b>\n`;
      pendingMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`;

      pendingTasks.forEach((task: any, i: number) => {
        const title = task.task_data?.title || task.task_data?.description?.slice(0, 40) || 'Untitled';
        const priority = task.priority === 'high' ? '🔴 HIGH' : task.priority === 'medium' ? '🟡 MED' : '🟢 LOW';
        const category = task.name_marathi || task.name_english || 'General';
        const dueDate = task.task_data?.due_date ? `📆 ${task.task_data.due_date}` : '';

        pendingMessage += `<b>${i + 1}. ${title}</b>\n`;
        pendingMessage += `   ${priority} | ${category}\n`;
        if (dueDate) pendingMessage += `   ${dueDate}\n`;
        if (task.task_data?.location) pendingMessage += `   📍 ${task.task_data.location}\n`;
        pendingMessage += `\n`;
      });

      await telegramService.sendMessage(chatId, pendingMessage);
      break;

    case '/menu':
      const categories = await taskService.getCategories();
      await telegramService.sendCategoryMenu(chatId, categories);
      break;

    default:
      await telegramService.sendMessage(
        chatId,
        'Unknown command. Type /help to see available commands.'
      );
  }
}

// Queue event handlers
[telegramMessageQueue, telegramVoiceQueue].forEach((queue) => {
  queue.on('failed', (job, err) => {
    logger.error(`Telegram job ${job.id} failed`, { queue: queue.name, error: err.message });
  });

  queue.on('completed', (job) => {
    logger.debug(`Telegram job ${job.id} completed`, { queue: queue.name });
  });
});

// Export queues and helper functions
export { telegramMessageQueue, telegramVoiceQueue };

export const addTelegramMessageJob = (data: TelegramMessageJobData) =>
  telegramMessageQueue.add(data);

export const closeTelegramQueues = async () => {
  await telegramMessageQueue.close();
  await telegramVoiceQueue.close();
  logger.info('Telegram queues closed');
};
