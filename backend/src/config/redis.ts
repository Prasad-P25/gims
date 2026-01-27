import Redis, { RedisOptions } from 'ioredis';
import { env, isDevelopment } from './env';
import { logger } from '../utils/logger';

// Parse Redis URL and add TLS for Upstash
const getRedisOptions = (): RedisOptions => {
  if (env.REDIS_URL) {
    const isUpstash = env.REDIS_URL.includes('upstash.io');
    const url = new URL(env.REDIS_URL.replace('redis://', 'http://').replace('rediss://', 'https://'));

    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      tls: isUpstash ? {} : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
      retryStrategy: (times: number) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    };
  }

  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
};

const redisOptions = getRedisOptions();
export const redis = new Redis(redisOptions);

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('ready', () => {
  logger.info('Redis ready');
});

redis.on('error', (err) => {
  logger.error('Redis error:', err.message);
});

redis.on('close', () => {
  if (isDevelopment) {
    logger.warn('Redis connection closed');
  }
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

// Bull queue connection options - use same parsed options
export const bullRedisConfig = {
  redis: redisOptions,
};
