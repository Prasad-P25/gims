import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('localhost'),

  // Database
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(Number).default('5432'),
  DB_NAME: z.string().default('gims_db'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default(''),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32).optional().default('default-refresh-secret-change-in-production'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // WhatsApp (optional - can use Telegram instead)
  WHATSAPP_API_URL: z.string().url().default('https://graph.facebook.com/v18.0'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_VERIFY_TOKEN: z.string().optional().default(''),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),

  // Gemini AI
  GEMINI_API_KEY: z.string(),
  GEMINI_API_KEY_VOICE: z.string().optional(), // Optional second key for voice/audio processing

  // Telegram Bot
  TELEGRAM_BOT_TOKEN: z.string().optional(),

  // File Storage
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.string().transform(Number).default('10485760'),
  VOICE_MESSAGE_DIR: z.string().default('./uploads/voice'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  LOG_FILE: z.string().default('./logs/app.log'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Reminder Settings
  MORNING_REMINDER_TIME: z.string().default('09:00'),
  EVENING_REMINDER_TIME: z.string().default('18:00'),

  // Notification Settings
  DAILY_NOTIFICATION_HOUR: z.string().transform(Number).default('19'), // 7 PM IST (24-hour format)
});

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => e.path.join('.'));
      console.error('Missing or invalid environment variables:', missingVars);
      throw new Error(`Environment validation failed: ${missingVars.join(', ')}`);
    }
    throw error;
  }
};

export const env = parseEnv();

export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
