import Bull, { Job } from 'bull';
import path from 'path';
import fs from 'fs';
import { bullRedisConfig, redis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { query } from '../config/database';
import { whatsappService } from '../services/whatsapp.service';
import { geminiService } from '../services/gemini.service';
import { taskService } from '../services/task.service';
import { projectService } from '../services/project.service';
import { WhatsAppMessage } from '../types';

// Helper function to get user by phone or return default admin
async function getUserIdByPhone(phone: string): Promise<string> {
  // First try to find user by phone
  const userResult = await query(
    'SELECT user_id FROM users WHERE phone = $1 AND deleted_at IS NULL',
    [phone.replace(/^91/, '')] // Remove country code for lookup
  );

  if (userResult.rows[0]) {
    return userResult.rows[0].user_id;
  }

  // If not found, return admin user (9999999999)
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

interface MessageJobData {
  message: WhatsAppMessage;
  contact?: {
    profile: { name: string };
    wa_id: string;
  };
}

// Fetch projects visible to this user for picker UX (active/on_hold only, capped at 10 for WhatsApp list rows).
async function getProjectsForWhatsAppUser(
  userId: string
): Promise<Array<{ project_id: string; name_english: string; name_marathi: string | null; status: string }>> {
  const r = await query<{ team_id: string | null; role: string }>(
    'SELECT team_id, role FROM users WHERE user_id = $1',
    [userId]
  );
  const teamId = r.rows[0]?.team_id;
  const role = r.rows[0]?.role;

  if (role === 'super_admin') {
    const all = await projectService.listProjects({ user_id: userId, role: 'super_admin' }, 'active');
    return all.slice(0, 10).map((p) => ({
      project_id: p.project_id,
      name_english: p.name_english,
      name_marathi: p.name_marathi ?? null,
      status: p.status,
    }));
  }
  if (!teamId) return [];
  const mine = await projectService.getMyProjects(teamId);
  return mine
    .filter((p) => p.status === 'active' || p.status === 'on_hold')
    .slice(0, 10)
    .map((p) => ({
      project_id: p.project_id,
      name_english: p.name_english,
      name_marathi: p.name_marathi ?? null,
      status: p.status,
    }));
}

// Send a WhatsApp interactive list of projects. Row IDs get a prefix so the reply handler can dispatch.
async function sendProjectPickerWhatsApp(
  to: string,
  projects: Array<{ project_id: string; name_english: string; name_marathi: string | null }>,
  idPrefix: 'setproj' | 'projpick',
  bodyText: string,
  headerText: string
): Promise<void> {
  const rows = projects.map((p) => ({
    id: `${idPrefix}_${p.project_id}`,
    title: (p.name_marathi || p.name_english).slice(0, 24),
    description: p.name_english.slice(0, 72),
  }));
  rows.push({
    id: `${idPrefix}_none`,
    title: idPrefix === 'setproj' ? 'Clear active' : 'Skip',
    description: idPrefix === 'setproj' ? 'Remove sticky project' : 'Save without project',
  });

  await whatsappService.sendInteractiveList(
    to,
    bodyText,
    'Select',
    [{ title: 'Projects', rows }],
    headerText
  );
}

// After task creation, if resolution is ambiguous, stash registry_id + prompt user to pick.
async function maybePromptProjectPickWhatsApp(
  from: string,
  registryId: string,
  resolution?: { reason?: string; candidates?: Array<{ project_id: string; name_english: string; name_marathi?: string | null }> }
): Promise<void> {
  if (!resolution || resolution.reason !== 'ambiguous') return;
  const candidates = resolution.candidates || [];
  if (candidates.length === 0) return;

  await redis.set(`whatsapp:proj_pick:${from}`, registryId, 'EX', 600);

  await sendProjectPickerWhatsApp(
    from,
    candidates.map((c) => ({
      project_id: c.project_id,
      name_english: c.name_english,
      name_marathi: c.name_marathi ?? null,
    })),
    'projpick',
    'Your team is part of multiple projects. Which project is this task for?\n\nतुमची टीम अनेक प्रकल्पांचा भाग आहे. हे कार्य कोणत्या प्रकल्पासाठी आहे?',
    'Select Project'
  );
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

  // "project" / "प्रकल्प" — set sticky active project via interactive list
  if (text.toLowerCase() === 'project' || text === 'प्रकल्प') {
    const userId = await getUserIdByPhone(from);
    if (!userId) {
      await whatsappService.sendTextMessage(from, '❌ Your phone is not linked to a GIMS account.');
      return;
    }
    const projects = await getProjectsForWhatsAppUser(userId);
    if (projects.length === 0) {
      await whatsappService.sendTextMessage(
        from,
        '📁 No projects available for you yet.\n\nतुमच्यासाठी कोणतेही प्रकल्प उपलब्ध नाहीत.'
      );
      return;
    }
    await sendProjectPickerWhatsApp(
      from,
      projects,
      'setproj',
      'Set your active project. New tasks you register will auto-tag to it.\n\nसक्रिय प्रकल्प निवडा. नवीन कार्ये त्याच्याशी स्वयंचलितपणे जोडली जातील.',
      'Active Project'
    );
    return;
  }

  // Try to extract task from natural language
  const categories = await taskService.getCategories();
  const extracted = await geminiService.extractTaskData(text, categories, 'marathi');

  if (extracted.confidence > 0.7 && extracted.category_id) {
    // Create task with actual user lookup
    const userId = await getUserIdByPhone(from);
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
    await whatsappService.sendTaskConfirmation(from, {
      registryId: task.registry_id,
      category: category?.name_marathi || 'Unknown',
      summary: extracted.summary,
      date: new Date().toLocaleDateString('en-IN'),
    });
    await maybePromptProjectPickWhatsApp(from, task.registry_id, task._projectResolution);
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
  const from = message.from;
  const replyId =
    message.interactive?.list_reply?.id ||
    message.interactive?.button_reply?.id ||
    '';

  logger.info('Interactive message received', { from, replyId, type: message.interactive?.type });

  if (!replyId) return;

  // "Set sticky active project" flow — from typing `project`
  if (replyId.startsWith('setproj_')) {
    const target = replyId.slice('setproj_'.length);
    const userId = await getUserIdByPhone(from);
    if (!userId) {
      await whatsappService.sendTextMessage(from, '❌ Phone not linked to a GIMS account.');
      return;
    }

    if (target === 'none') {
      await query('UPDATE users SET active_project_id = NULL, updated_at = NOW() WHERE user_id = $1', [userId]);
      await whatsappService.sendTextMessage(from, '✅ Active project cleared.\n\nसक्रिय प्रकल्प रद्द केला.');
      return;
    }

    const userRow = await query<{ team_id: string | null; role: string }>(
      'SELECT team_id, role FROM users WHERE user_id = $1',
      [userId]
    );
    if (userRow.rows[0]?.role !== 'super_admin') {
      const teamId = userRow.rows[0]?.team_id;
      if (!teamId || !(await projectService.isTeamInProject(target, teamId))) {
        await whatsappService.sendTextMessage(from, '❌ Your team is not assigned to that project.');
        return;
      }
    }

    const projRow = await query<{ name_english: string; name_marathi: string | null }>(
      'SELECT name_english, name_marathi FROM projects WHERE project_id = $1 AND deleted_at IS NULL',
      [target]
    );
    if (projRow.rows.length === 0) {
      await whatsappService.sendTextMessage(from, '❌ That project no longer exists.');
      return;
    }

    await query('UPDATE users SET active_project_id = $1, updated_at = NOW() WHERE user_id = $2', [target, userId]);
    const pname = projRow.rows[0].name_marathi || projRow.rows[0].name_english;
    await whatsappService.sendTextMessage(
      from,
      `✅ Active project set: *${pname}*\n\nसक्रिय प्रकल्प सेट केला.\n\nNew tasks will auto-tag to this project until you change it by typing \`project\`.`
    );
    return;
  }

  // "Which project is this task for?" ambiguous fallback
  if (replyId.startsWith('projpick_')) {
    const target = replyId.slice('projpick_'.length);
    const userId = await getUserIdByPhone(from);
    if (!userId) {
      await whatsappService.sendTextMessage(from, '❌ Phone not linked.');
      return;
    }

    const pickKey = `whatsapp:proj_pick:${from}`;
    const registryId = await redis.get(pickKey);
    if (!registryId) {
      await whatsappService.sendTextMessage(
        from,
        '⌛ That prompt expired. Type `project` to set your active project; new tasks will then auto-tag.'
      );
      return;
    }

    if (target === 'none') {
      await redis.del(pickKey);
      await whatsappService.sendTextMessage(from, '👍 Task saved without a project.\n\nकार्य प्रकल्पाशिवाय जतन केले.');
      return;
    }

    const taskRow = await query<{ project_id: string | null }>(
      `SELECT project_id FROM task_registry
       WHERE registry_id = $1 AND deleted_at IS NULL
         AND (registered_by = $2 OR assigned_to = $2)`,
      [registryId, userId]
    );
    if (taskRow.rows.length === 0) {
      await redis.del(pickKey);
      await whatsappService.sendTextMessage(from, '❌ That task is no longer available.');
      return;
    }
    if (taskRow.rows[0].project_id) {
      await redis.del(pickKey);
      await whatsappService.sendTextMessage(from, 'ℹ️ That task already has a project set.');
      return;
    }

    const userRow = await query<{ team_id: string | null; role: string }>(
      'SELECT team_id, role FROM users WHERE user_id = $1',
      [userId]
    );
    if (userRow.rows[0]?.role !== 'super_admin') {
      const teamId = userRow.rows[0]?.team_id;
      if (!teamId || !(await projectService.isTeamInProject(target, teamId))) {
        await redis.del(pickKey);
        await whatsappService.sendTextMessage(from, '❌ You do not have access to that project.');
        return;
      }
    }

    const projRow = await query<{ name_english: string; name_marathi: string | null }>(
      'SELECT name_english, name_marathi FROM projects WHERE project_id = $1 AND deleted_at IS NULL',
      [target]
    );
    if (projRow.rows.length === 0) {
      await redis.del(pickKey);
      await whatsappService.sendTextMessage(from, '❌ That project no longer exists.');
      return;
    }

    await query('UPDATE task_registry SET project_id = $1, updated_at = NOW() WHERE registry_id = $2', [target, registryId]);
    await query('UPDATE users SET active_project_id = $1, updated_at = NOW() WHERE user_id = $2', [target, userId]);
    await redis.del(pickKey);

    const pname = projRow.rows[0].name_marathi || projRow.rows[0].name_english;
    await whatsappService.sendTextMessage(
      from,
      `✅ Tagged to: *${pname}*\n\nकार्य प्रकल्पाशी जोडले.\n\nFuture tasks will auto-tag to this project.`
    );
    return;
  }

  logger.info('Unhandled interactive reply', { replyId });
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
      // Create task with actual user lookup
      const userId = await getUserIdByPhone(from);
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
      await whatsappService.sendTaskConfirmation(from, {
        registryId: task.registry_id,
        category: category?.name_marathi || 'Unknown',
        summary: extracted.summary,
        date: new Date().toLocaleDateString('en-IN'),
      });
      await maybePromptProjectPickWhatsApp(from, task.registry_id, task._projectResolution);
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
