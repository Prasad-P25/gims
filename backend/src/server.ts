import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { pool, healthCheck as dbHealthCheck, closePool } from './config/database';
import { redis, redisHealthCheck, closeRedis } from './config/redis';

// Import queues to start processors
import { closeQueues } from './queues/message.queue';
import { closeTelegramQueues } from './queues/telegram.queue';

logger.info('Message queues initialized');

const PORT = env.PORT;
const HOST = env.HOST;

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Close HTTP server
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close message queues
      await closeQueues();
      await closeTelegramQueues();

      // Close database connection
      await closePool();

      // Close Redis connection
      await closeRedis();

      logger.info('All connections closed. Exiting...');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);

  // Perform health checks on startup
  Promise.all([dbHealthCheck(), redisHealthCheck()])
    .then(([dbHealthy, redisHealthy]) => {
      if (dbHealthy) {
        logger.info('Database connection: healthy');
      } else {
        logger.warn('Database connection: unhealthy');
      }

      if (redisHealthy) {
        logger.info('Redis connection: healthy');
      } else {
        logger.warn('Redis connection: unhealthy');
      }
    })
    .catch((error) => {
      logger.error('Health check failed:', error);
    });
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default server;
