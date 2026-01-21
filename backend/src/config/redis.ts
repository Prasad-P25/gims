import Redis, { RedisOptions } from 'ioredis';
import { env, isDevelopment } from './env';
import { logger } from '../utils/logger';

const createRedisClient = (): Redis => {
  if (env.REDIS_URL) {
    return new Redis(env.REDIS_URL);
  }

  const options: RedisOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  return new Redis(options);
};

export const redis = createRedisClient();

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('ready', () => {
  if (isDevelopment) {
    logger.debug('Redis ready to accept commands');
  }
});

redis.on('error', (err) => {
  logger.error('Redis error:', err);
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis reconnecting...');
});

export const redisHealthCheck = async (): Promise<boolean> => {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
};

export const closeRedis = async (): Promise<void> => {
  await redis.quit();
  logger.info('Redis connection closed');
};

// Bull queue connection options
export const bullRedisConfig = env.REDIS_URL
  ? { url: env.REDIS_URL }
  : {
      redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
    };
