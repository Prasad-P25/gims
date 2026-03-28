import Bull, { Job } from 'bull';
import path from 'path';
import fs from 'fs';
import { bullRedisConfig, redis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { query } from '../config/database';
import { telegramService, TelegramMessage, TelegramCallbackQuery } from '../services/telegram.service';
import { geminiService } from '../services/gemini.service';
import { taskService } from '../services/task.service';
import { notificationService } from '../services/notification.service';
import { triggerNotification } from './notification.queue';

// Helper function to get user by telegram ID
async function getUserIdByTelegramId(telegramId: number): Promise<string | null> {
  // First, try to find user by telegram_id
  const telegramUser = await query(
    'SELECT user_id, name FROM users WHERE telegram_id = $1 AND deleted_at IS NULL AND is_active = true',
    [telegramId]
  );

  if (telegramUser.rows[0]) {
    logger.info('Found user by telegram_id', { telegramId, userId: telegramUser.rows[0].user_id, name: telegramUser.rows[0].name });
    return telegramUser.rows[0].user_id;
  }

  // No linked user found
  logger.info('No user found for telegram_id', { telegramId });
  return null;
}

// Helper function to link telegram account to user
async function linkTelegramToUser(telegramId: number, phone: string): Promise<{ success: boolean; userName?: string; error?: string }> {
  // Find user by phone
  const userResult = await query(
    'SELECT user_id, name, telegram_id FROM users WHERE phone = $1 AND deleted_at IS NULL AND is_active = true',
    [phone]
  );

  if (!userResult.rows[0]) {
    return { success: false, error: 'Phone number not found in system' };
  }

  const user = userResult.rows[0];

  // Check if already linked to another telegram account
  if (user.telegram_id && user.telegram_id !== telegramId) {
    return { success: false, error: 'This phone is already linked to another Telegram account' };
  }

  // Check if this telegram_id is already linked to another user
  const existingLink = await query(
    'SELECT user_id, name FROM users WHERE telegram_id = $1 AND user_id != $2',
    [telegramId, user.user_id]
  );

  if (existingLink.rows[0]) {
    return { success: false, error: `This Telegram account is already linked to ${existingLink.rows[0].name}` };
  }

  // Link the account
  await query(
    'UPDATE users SET telegram_id = $1, updated_at = NOW() WHERE user_id = $2',
    [telegramId, user.user_id]
  );

  logger.info('Telegram account linked', { telegramId, userId: user.user_id, userName: user.name });
  return { success: true, userName: user.name };
}

// Temp storage for assign flow (maps chatId to selected taskId)
const assignPendingTask = new Map<number, string>();

interface TelegramMessageJobData {
  message?: TelegramMessage;
  callbackQuery?: TelegramCallbackQuery;
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
  const { message, callbackQuery } = job.data;

  // Handle callback query (button clicks)
  if (callbackQuery) {
    logger.info('Processing callback query', {
      jobId: job.id,
      callbackId: callbackQuery.id,
      data: callbackQuery.data,
    });

    try {
      await processCallbackQuery(callbackQuery);
      return { success: true, callbackId: callbackQuery.id };
    } catch (error: any) {
      logger.error('Failed to process callback query', {
        callbackId: callbackQuery.id,
        error: error.message,
      });
      throw error;
    }
  }

  // Handle regular message
  if (!message) {
    logger.warn('No message or callback query in job data');
    return { success: false };
  }

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

// Process callback queries (button clicks)
async function processCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data || '';
  const fromId = callbackQuery.from.id;

  if (!chatId) {
    logger.error('No chat ID in callback query');
    return;
  }

  // Acknowledge the callback
  await telegramService.answerCallbackQuery(callbackQuery.id, 'Processing...');

  // Check if user is linked
  const userId = await getUserIdByTelegramId(fromId);
  if (!userId) {
    await telegramService.sendMessage(
      chatId,
      `🔗 <b>Account not linked</b>\n\nतुमचे खाते जोडलेले नाही.\n\nPlease link your Telegram account first using:\n<code>/link YOUR_PHONE_NUMBER</code>`
    );
    return;
  }

  // Handle task selection (show status options)
  if (data.startsWith('task_select_')) {
    const registryId = data.replace('task_select_', '');
    logger.info('Task selected for status update', { registryId, chatId, userId });

    // Verify task belongs to user (created by OR assigned to) and is from last 24 hours
    const taskResult = await query(
      `SELECT tr.registry_id, tr.status, tr.priority, tr.task_data,
              c.name_english, c.name_marathi
       FROM task_registry tr
       JOIN categories c ON tr.category_id = c.category_id
       WHERE tr.registry_id = $1
         AND (tr.registered_by = $2 OR tr.assigned_to = $2)
         AND tr.deleted_at IS NULL
         AND tr.created_at >= NOW() - INTERVAL '24 hours'`,
      [registryId, userId]
    );

    if (taskResult.rows.length === 0) {
      await telegramService.sendMessage(
        chatId,
        `❌ <b>Task not found</b>\n\nकार्य सापडले नाही.\n\nThis task may have been deleted or is older than 24 hours.`
      );
      return;
    }

    const task = taskResult.rows[0];
    const title = task.task_data?.title || task.task_data?.description?.slice(0, 30) || 'Untitled';
    const currentStatus = task.status;

    // Show status options
    const statusMessage = `📝 <b>Update Task Status</b>\n\nकार्य स्थिती अपडेट करा\n\n<b>Task:</b> ${title}\n<b>Category:</b> ${task.name_marathi || task.name_english}\n<b>Current Status:</b> ${currentStatus}\n\nSelect new status:\nनवीन स्थिती निवडा:`;

    const statusButtons = [
      [
        { text: currentStatus === 'pending' ? '⏳ Pending ✓' : '⏳ Pending', callback_data: `status_${registryId}_pending` },
      ],
      [
        { text: currentStatus === 'in_progress' ? '🔄 In Progress ✓' : '🔄 In Progress', callback_data: `status_${registryId}_in_progress` },
      ],
      [
        { text: currentStatus === 'completed' ? '✅ Completed ✓' : '✅ Completed', callback_data: `status_${registryId}_completed` },
      ],
      [
        { text: '❌ Cancel', callback_data: 'cancel_status_update' },
      ],
    ];

    await telegramService.sendMessageWithButtons(chatId, statusMessage, statusButtons);
    return;
  }

  // Handle status update
  if (data.startsWith('status_')) {
    const parts = data.split('_');
    // Format: status_<registry_id>_<status>
    // registry_id is UUID so may contain dashes, status is last part
    const status = parts[parts.length - 1];
    const registryId = parts.slice(1, -1).join('_');

    logger.info('Status update requested', { registryId, status, chatId, userId });

    // Validate status
    if (!['pending', 'in_progress', 'completed'].includes(status)) {
      await telegramService.sendMessage(chatId, '❌ Invalid status selected.');
      return;
    }

    // Verify task belongs to user (created by OR assigned to) and is from last 24 hours
    const taskCheck = await query(
      `SELECT registry_id, status, task_data
       FROM task_registry
       WHERE registry_id = $1
         AND (registered_by = $2 OR assigned_to = $2)
         AND deleted_at IS NULL
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [registryId, userId]
    );

    if (taskCheck.rows.length === 0) {
      await telegramService.sendMessage(
        chatId,
        `❌ <b>Cannot update task</b>\n\nकार्य अपडेट करता येत नाही.\n\nThis task may not belong to you or is older than 24 hours.`
      );
      return;
    }

    const currentStatus = taskCheck.rows[0].status;

    // Check if status is same
    if (currentStatus === status) {
      await telegramService.sendMessage(
        chatId,
        `ℹ️ Task is already <b>${status}</b>.\n\nकार्य आधीपासून <b>${status}</b> आहे.`
      );
      return;
    }

    // Update the status
    await query(
      `UPDATE task_registry
       SET status = $1, updated_at = NOW()
       WHERE registry_id = $2`,
      [status, registryId]
    );

    const title = taskCheck.rows[0].task_data?.title || taskCheck.rows[0].task_data?.description?.slice(0, 30) || 'Task';
    const statusEmoji = status === 'completed' ? '✅' : status === 'in_progress' ? '🔄' : '⏳';

    await telegramService.sendMessage(
      chatId,
      `${statusEmoji} <b>Status Updated!</b>\n\nस्थिती अपडेट केली!\n\n<b>Task:</b> ${title}\n<b>New Status:</b> ${status}\n\nUse /mytasks to see all your tasks.`
    );

    logger.info('Task status updated via Telegram', { registryId, oldStatus: currentStatus, newStatus: status, userId });
    return;
  }

  // Handle test notification buttons (super admin)
  if (data.startsWith('test_notif_')) {
    const notifType = data.replace('test_notif_', '');
    // Verify super admin
    const testUserResult = await query('SELECT role FROM users WHERE user_id = $1', [userId]);
    if (testUserResult.rows[0]?.role !== 'super_admin') {
      await telegramService.sendMessage(chatId, '❌ Only super admin can test reminders.');
      return;
    }

    const notifTypeMap: Record<string, 'overdue-alert' | 'morning-update' | 'evening-update' | 'daily-summary'> = {
      overdue: 'overdue-alert',
      morning: 'morning-update',
      evening: 'evening-update',
      daily: 'daily-summary',
    };

    const mappedType = notifTypeMap[notifType];
    if (mappedType) {
      await triggerNotification(mappedType);
      await telegramService.sendMessage(
        chatId,
        `🧪 <b>${notifType}</b> reminder triggered! Sending to all eligible users...`
      );
    }
    return;
  }

  // Handle cancel
  if (data === 'cancel_status_update' || data === 'cancel_assign') {
    await telegramService.sendMessage(
      chatId,
      `❌ Action cancelled.\n\nकृती रद्द केली.`
    );
    return;
  }

  // Handle assign - step 1: task selected, store it and show team members
  if (data.startsWith('assign_task_')) {
    const registryId = data.replace('assign_task_', '');
    logger.info('Task selected for assignment', { registryId, chatId, userId });

    // Store selected task for this chat
    assignPendingTask.set(chatId, registryId);

    // Get user's role and team
    const userResult = await query(
      'SELECT role, team_id FROM users WHERE user_id = $1',
      [userId]
    );
    const userRole = userResult.rows[0]?.role;
    const userTeamId = userResult.rows[0]?.team_id;

    // Get team members to assign to
    let membersResult;
    if (userRole === 'super_admin') {
      membersResult = await query(
        `SELECT user_id, name, phone FROM users
         WHERE role IN ('admin', 'member') AND is_active = true AND deleted_at IS NULL
         ORDER BY name LIMIT 15`
      );
    } else if (userRole === 'admin' && userTeamId) {
      membersResult = await query(
        `SELECT user_id, name, phone FROM users
         WHERE team_id = $1 AND role = 'member' AND is_active = true AND deleted_at IS NULL AND user_id != $2
         ORDER BY name LIMIT 15`,
        [userTeamId, userId]
      );
    } else {
      await telegramService.sendMessage(chatId, '❌ You cannot assign tasks.');
      return;
    }

    if (membersResult.rows.length === 0) {
      assignPendingTask.delete(chatId);
      await telegramService.sendMessage(
        chatId,
        `❌ <b>No team members found</b>\n\nटीम सदस्य सापडले नाहीत.\n\nAdd members to your team first via the web dashboard.`
      );
      return;
    }

    // Use short index-based callback data to stay under 64 byte limit
    const memberButtons = membersResult.rows.map((m: any, i: number) => ([{
      text: `👤 ${m.name}`,
      callback_data: `asgn_${m.user_id.slice(0, 8)}_${m.user_id}`,
    }]));
    memberButtons.push([{ text: '❌ Cancel', callback_data: 'cancel_assign' }]);

    await telegramService.sendMessageWithButtons(
      chatId,
      `👥 <b>Select team member to assign:</b>\n\nकार्य नियुक्त करण्यासाठी सदस्य निवडा:`,
      memberButtons
    );
    return;
  }

  // Handle assign - step 2: member selected, do the assignment
  if (data.startsWith('asgn_')) {
    const memberUserId = data.split('_').slice(2).join('_');
    const registryId = assignPendingTask.get(chatId);

    if (!registryId) {
      await telegramService.sendMessage(chatId, '❌ Session expired. Please use /assign again.');
      return;
    }

    // Clean up
    assignPendingTask.delete(chatId);

    logger.info('Assigning task', { registryId, memberUserId, chatId, userId });

    // Update the task
    await query(
      'UPDATE task_registry SET assigned_to = $1, updated_at = NOW() WHERE registry_id = $2',
      [memberUserId, registryId]
    );

    // Get task and member info
    const taskInfo = await query(
      `SELECT tr.task_data, c.name_marathi, c.name_english
       FROM task_registry tr JOIN categories c ON tr.category_id = c.category_id
       WHERE tr.registry_id = $1`,
      [registryId]
    );
    const memberInfo = await query(
      'SELECT name, telegram_id FROM users WHERE user_id = $1',
      [memberUserId]
    );

    const taskTitle = taskInfo.rows[0]?.task_data?.title || 'Task';
    const memberName = memberInfo.rows[0]?.name || 'Unknown';
    const memberTelegramId = memberInfo.rows[0]?.telegram_id;

    // Confirm to admin
    await telegramService.sendMessage(
      chatId,
      `✅ <b>Task Assigned!</b>\n\nकार्य नियुक्त केले!\n\n<b>Task:</b> ${taskTitle}\n<b>Assigned to:</b> ${memberName}\n<b>Category:</b> ${taskInfo.rows[0]?.name_marathi || taskInfo.rows[0]?.name_english}`
    );

    // Notify the member via Telegram if they have telegram linked
    if (memberTelegramId) {
      try {
        await telegramService.sendMessage(
          memberTelegramId,
          `📌 <b>New Task Assigned to You!</b>\n\nतुम्हाला नवीन कार्य नियुक्त केले!\n\n<b>Task:</b> ${taskTitle}\n<b>Category:</b> ${taskInfo.rows[0]?.name_marathi || taskInfo.rows[0]?.name_english}\n\nUse /mytasks to view and update status.`
        );
      } catch (e) {
        logger.warn('Could not notify member via Telegram', { memberUserId, error: e });
      }
    }

    return;
  }

  // Handle category selection
  if (data.startsWith('category_')) {
    const categoryId = parseInt(data.replace('category_', ''), 10);
    logger.info('Category selected', { categoryId, chatId });

    // Get the original message text (if available from context)
    // For now, create a simple task with the selected category
    const category = await taskService.getCategoryById(categoryId);

    if (!category) {
      await telegramService.sendMessage(chatId, '❌ Invalid category selected.');
      return;
    }

    // Retrieve the user's original message (stored when category menu was shown)
    const pendingTextKey = `telegram:pending_text:${chatId}`;
    const originalText = await redis.get(pendingTextKey);
    if (originalText) {
      await redis.del(pendingTextKey);
    }

    const taskTitle = originalText?.slice(0, 100) || category.name_marathi || category.name_english;
    const taskDescription = originalText || 'Task created via category selection';

    // Create task with the selected category
    const task = await taskService.createTask(
      {
        category_id: categoryId,
        task_data: {
          title: taskTitle,
          description: taskDescription,
        },
        input_mode: 'text',
        input_source: 'telegram',
        original_input: originalText || undefined,
        priority: 'medium',
      },
      userId
    );

    await telegramService.sendTaskConfirmation(chatId, {
      registryId: task.registry_id,
      category: category.name_marathi || category.name_english,
      summary: taskTitle,
      date: new Date().toLocaleDateString('en-IN'),
    });
  }
}

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

  // Check if user is linked
  const userId = await getUserIdByTelegramId(message.from.id);
  if (!userId) {
    await telegramService.sendMessage(
      chatId,
      `🔗 <b>Account not linked</b>\n\nतुमचे खाते जोडलेले नाही.\n\nPlease link your Telegram account first using:\n<code>/link YOUR_PHONE_NUMBER</code>\n\nउदाहरण: <code>/link 9876543210</code>`
    );
    return;
  }

  // Try to extract task from natural language
  const categories = await taskService.getCategories();
  const extracted = await geminiService.extractTaskData(text, categories, 'marathi');

  if (extracted.confidence > 0.7 && extracted.category_id) {
    // Create task
    const task = await taskService.createTask(
      {
        category_id: extracted.category_id,
        task_data: extracted.task_data,
        input_mode: 'text',
        input_source: 'telegram',
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
    // Low confidence - store original text for when user picks a category
    await redis.set(`telegram:pending_text:${chatId}`, text, 'EX', 3600);
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

  // Check if user is linked first
  const userId = await getUserIdByTelegramId(message.from.id);
  if (!userId) {
    await telegramService.sendMessage(
      chatId,
      `🔗 <b>Account not linked</b>\n\nतुमचे खाते जोडलेले नाही.\n\nPlease link your Telegram account first using:\n<code>/link YOUR_PHONE_NUMBER</code>\n\nउदाहरण: <code>/link 9876543210</code>`
    );
    return;
  }

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
      // Create task (userId already fetched and validated above)
      const task = await taskService.createTask(
        {
          category_id: extracted.category_id,
          task_data: extracted.task_data,
          input_mode: 'voice',
          input_source: 'telegram',
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

<b>Account:</b>
/link [phone] - Link your Telegram to GIMS account
/whoami - Show your linked account info

<b>Tasks:</b>
/mytasks - View & update your tasks (last 24 hours)
/assign - Assign a task to team member (admin)
/status - Show full task overview with details
/today - Show today's tasks
/pending - Show all pending tasks
/menu - Show category menu
/summary - Daily task summary (admin only)
/testreminder - Test a reminder now (super admin)

<b>How to use:</b>
1. First link your account: <code>/link 9876543210</code>
2. Send a text message describing your task
3. Or send a voice message in Marathi/Hindi/English
4. The bot will automatically categorize and register your task
5. Use /mytasks to update task status

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

      let todayMessage = `<b>📅 Today's Tasks</b>\n`;
      todayMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
      const completedToday = todayTasks.filter((t: any) => t.status === 'completed').length;
      todayMessage += `📝 Registered: ${todayTasks.length} | ✅ Completed: ${completedToday}\n\n`;

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

    case '/link':
      const phoneArg = text.split(' ')[1];
      if (!phoneArg) {
        await telegramService.sendMessage(
          chatId,
          `🔗 <b>Link your account</b>\n\nखाते जोडा\n\nUsage: <code>/link YOUR_PHONE_NUMBER</code>\n\nExample: <code>/link 9876543210</code>\n\nUse the phone number registered in GIMS system.`
        );
        break;
      }

      // Clean phone number (remove spaces, dashes, +91 prefix)
      const cleanPhone = phoneArg.replace(/[\s\-\+]/g, '').replace(/^91/, '');

      if (!/^\d{10}$/.test(cleanPhone)) {
        await telegramService.sendMessage(
          chatId,
          `❌ <b>Invalid phone number</b>\n\nकृपया 10 अंकी फोन नंबर द्या.\n\nPlease provide a valid 10-digit phone number.\n\nExample: <code>/link 9876543210</code>`
        );
        break;
      }

      const linkResult = await linkTelegramToUser(message.from.id, cleanPhone);

      if (linkResult.success) {
        await telegramService.sendMessage(
          chatId,
          `✅ <b>Account linked successfully!</b>\n\nखाते यशस्वीरित्या जोडले!\n\nWelcome, <b>${linkResult.userName}</b>!\n\nYou can now:\n• Send text messages to create tasks\n• Send voice messages in Marathi/Hindi/English\n• Use /status to check tasks\n\nआता तुम्ही कार्ये नोंदवू शकता!`
        );
      } else {
        await telegramService.sendMessage(
          chatId,
          `❌ <b>Link failed</b>\n\nजोडणी अयशस्वी\n\n${linkResult.error}\n\nPlease contact admin if you need help.`
        );
      }
      break;

    case '/whoami':
      const currentUserId = await getUserIdByTelegramId(message.from.id);
      if (currentUserId) {
        const userInfo = await query(
          'SELECT name, phone, role FROM users WHERE user_id = $1',
          [currentUserId]
        );
        if (userInfo.rows[0]) {
          await telegramService.sendMessage(
            chatId,
            `👤 <b>Your Account</b>\n\n<b>Name:</b> ${userInfo.rows[0].name}\n<b>Phone:</b> ${userInfo.rows[0].phone}\n<b>Role:</b> ${userInfo.rows[0].role}\n<b>Telegram ID:</b> <code>${message.from.id}</code>`
          );
        }
      } else {
        await telegramService.sendMessage(
          chatId,
          `❌ <b>Account not linked</b>\n\nतुमचे खाते जोडलेले नाही.\n\nUse <code>/link YOUR_PHONE</code> to link your account.`
        );
      }
      break;

    case '/mytasks':
      // Show user's tasks from last 24 hours with update options
      const myTasksUserId = await getUserIdByTelegramId(message.from.id);
      if (!myTasksUserId) {
        await telegramService.sendMessage(
          chatId,
          `❌ <b>Account not linked</b>\n\nतुमचे खाते जोडलेले नाही.\n\nUse <code>/link YOUR_PHONE</code> to link your account.`
        );
        break;
      }

      // Get tasks from last 24 hours for this user (created by OR assigned to)
      const myTasksResult = await query(
        `SELECT tr.registry_id, tr.status, tr.priority, tr.task_data, tr.created_at,
                tr.registered_by, tr.assigned_to,
                c.name_english, c.name_marathi
         FROM task_registry tr
         JOIN categories c ON tr.category_id = c.category_id
         WHERE (tr.registered_by = $1 OR tr.assigned_to = $1)
           AND tr.deleted_at IS NULL
           AND tr.created_at >= NOW() - INTERVAL '24 hours'
         ORDER BY tr.created_at DESC
         LIMIT 10`,
        [myTasksUserId]
      );

      if (myTasksResult.rows.length === 0) {
        await telegramService.sendMessage(
          chatId,
          `📋 <b>No tasks in last 24 hours</b>\n\nगेल्या 24 तासांत कोणतेही कार्य नाही.\n\nSend a message to create a new task!`
        );
        break;
      }

      // Create task list message with buttons
      let myTasksMessage = `📋 <b>Your Tasks (Last 24 Hours)</b>\n\nतुमची कार्ये (गेल्या 24 तास)\n\nClick on a task to update its status:\n━━━━━━━━━━━━━━━━━━━━\n\n`;

      const taskButtons: Array<{ text: string; callback_data: string }[]> = [];

      myTasksResult.rows.forEach((task: any, index: number) => {
        const title = task.task_data?.title || task.task_data?.description?.slice(0, 25) || 'Untitled';
        const statusIcon = task.status === 'completed' ? '✅' : task.status === 'in_progress' ? '🔄' : '⏳';
        const priorityIcon = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';

        myTasksMessage += `${index + 1}. ${statusIcon} ${priorityIcon} <b>${title}</b>\n`;
        myTasksMessage += `   └ ${task.name_marathi || task.name_english}\n`;
        myTasksMessage += `   └ Status: ${task.status}\n\n`;

        // Add button for each task
        taskButtons.push([{
          text: `${index + 1}. ${statusIcon} ${title.slice(0, 20)}${title.length > 20 ? '...' : ''}`,
          callback_data: `task_select_${task.registry_id}`,
        }]);
      });

      await telegramService.sendMessageWithButtons(chatId, myTasksMessage, taskButtons);
      break;

    case '/assign':
      // Admin assigns task to team member
      const assignUserId = await getUserIdByTelegramId(message.from.id);
      if (!assignUserId) {
        await telegramService.sendMessage(
          chatId,
          `❌ <b>Account not linked</b>\n\nUse <code>/link YOUR_PHONE</code> to link your account.`
        );
        break;
      }

      // Check role
      const assignUserRole = await query(
        'SELECT role, team_id FROM users WHERE user_id = $1',
        [assignUserId]
      );
      if (!['admin', 'super_admin'].includes(assignUserRole.rows[0]?.role)) {
        await telegramService.sendMessage(
          chatId,
          `❌ <b>Access denied</b>\n\nOnly admins can assign tasks.\n\nफक्त प्रशासक कार्ये नियुक्त करू शकतात.`
        );
        break;
      }

      // Get recent unassigned tasks (last 7 days)
      const assignTeamId = assignUserRole.rows[0]?.team_id;
      let unassignedQuery: string;
      let unassignedParams: unknown[];

      if (assignUserRole.rows[0]?.role === 'super_admin') {
        unassignedQuery = `
          SELECT tr.registry_id, tr.task_data, tr.priority, c.name_marathi, c.name_english
          FROM task_registry tr
          JOIN categories c ON tr.category_id = c.category_id
          WHERE tr.assigned_to IS NULL
            AND tr.status IN ('pending', 'in_progress')
            AND tr.deleted_at IS NULL
            AND tr.created_at >= NOW() - INTERVAL '7 days'
          ORDER BY tr.created_at DESC LIMIT 10`;
        unassignedParams = [];
      } else {
        unassignedQuery = `
          SELECT tr.registry_id, tr.task_data, tr.priority, c.name_marathi, c.name_english
          FROM task_registry tr
          JOIN categories c ON tr.category_id = c.category_id
          WHERE tr.assigned_to IS NULL
            AND tr.status IN ('pending', 'in_progress')
            AND tr.deleted_at IS NULL
            AND tr.created_at >= NOW() - INTERVAL '7 days'
            AND tr.registered_by IN (SELECT user_id FROM users WHERE team_id = $1 AND deleted_at IS NULL)
          ORDER BY tr.created_at DESC LIMIT 10`;
        unassignedParams = [assignTeamId];
      }

      const unassignedTasks = await query(unassignedQuery, unassignedParams);

      if (unassignedTasks.rows.length === 0) {
        await telegramService.sendMessage(
          chatId,
          `✅ <b>No unassigned tasks</b>\n\nसर्व कार्ये आधीच नियुक्त आहेत.\n\nAll tasks from the last 7 days are already assigned.`
        );
        break;
      }

      let assignMsg = `📋 <b>Select task to assign:</b>\n\nनियुक्त करण्यासाठी कार्य निवडा:\n━━━━━━━━━━━━━━━━━━━━\n\n`;
      const assignButtons: Array<{ text: string; callback_data: string }[]> = [];

      unassignedTasks.rows.forEach((task: any, i: number) => {
        const title = task.task_data?.title || task.task_data?.description?.slice(0, 25) || 'Untitled';
        const priorityIcon = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
        assignMsg += `${i + 1}. ${priorityIcon} <b>${title}</b>\n   └ ${task.name_marathi || task.name_english}\n\n`;
        assignButtons.push([{
          text: `${i + 1}. ${priorityIcon} ${title.slice(0, 25)}`,
          callback_data: `assign_task_${task.registry_id}`,
        }]);
      });

      assignButtons.push([{ text: '❌ Cancel', callback_data: 'cancel_assign' }]);
      await telegramService.sendMessageWithButtons(chatId, assignMsg, assignButtons);
      break;

    case '/summary':
      // Check if user is linked and is admin
      const summaryUserId = await getUserIdByTelegramId(message.from.id);
      if (!summaryUserId) {
        await telegramService.sendMessage(
          chatId,
          `❌ <b>Account not linked</b>\n\nतुमचे खाते जोडलेले नाही.\n\nUse <code>/link YOUR_PHONE</code> to link your account.`
        );
        break;
      }

      const userRoleCheck = await query(
        'SELECT role FROM users WHERE user_id = $1',
        [summaryUserId]
      );

      if (userRoleCheck.rows[0]?.role !== 'admin' && userRoleCheck.rows[0]?.role !== 'super_admin') {
        await telegramService.sendMessage(
          chatId,
          `❌ <b>Access denied</b>\n\nOnly admins can view the daily summary.\n\nफक्त प्रशासक दैनिक सारांश पाहू शकतात.`
        );
        break;
      }

      // Get and send the daily summary
      const dailyStats = await notificationService.getDailyStats();
      const summaryMessage = notificationService.formatDailySummary(dailyStats);
      await telegramService.sendMessage(chatId, summaryMessage);
      break;

    case '/testreminder':
      // Super admin only — trigger a specific reminder for testing
      const testUserId = await getUserIdByTelegramId(message.from.id);
      if (!testUserId) {
        await telegramService.sendMessage(chatId, '❌ Account not linked. Use /link first.');
        break;
      }

      const testRoleCheck = await query('SELECT role FROM users WHERE user_id = $1', [testUserId]);
      if (testRoleCheck.rows[0]?.role !== 'super_admin') {
        await telegramService.sendMessage(chatId, '❌ Only super admin can test reminders.');
        break;
      }

      const testArg = text.split(' ')[1]?.toLowerCase();
      const validTypes = ['overdue', 'morning', 'evening', 'daily'] as const;

      if (!testArg || !validTypes.includes(testArg as any)) {
        await telegramService.sendMessageWithButtons(
          chatId,
          `🧪 <b>Test Reminder</b>\n\nSelect which reminder to trigger now:\n\n` +
          `• <b>overdue</b> — 9 AM overdue alert\n` +
          `• <b>morning</b> — 10 AM morning update\n` +
          `• <b>evening</b> — 6 PM evening update\n` +
          `• <b>daily</b> — 7 PM admin daily report\n\n` +
          `Or type: <code>/testreminder morning</code>`,
          [
            [{ text: '⚠️ 9AM Overdue', callback_data: 'test_notif_overdue' }],
            [{ text: '🌅 10AM Morning', callback_data: 'test_notif_morning' }],
            [{ text: '🌆 6PM Evening', callback_data: 'test_notif_evening' }],
            [{ text: '📊 7PM Daily', callback_data: 'test_notif_daily' }],
          ]
        );
        break;
      }

      const typeMap: Record<string, 'overdue-alert' | 'morning-update' | 'evening-update' | 'daily-summary'> = {
        overdue: 'overdue-alert',
        morning: 'morning-update',
        evening: 'evening-update',
        daily: 'daily-summary',
      };

      await triggerNotification(typeMap[testArg]);
      await telegramService.sendMessage(
        chatId,
        `🧪 <b>${testArg}</b> reminder triggered! It will be sent to all eligible users shortly.`
      );
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
