import winston from 'winston';
import path from 'path';

const logDir = process.env.LOG_FILE ? path.dirname(process.env.LOG_FILE) : './logs';
const logLevel = process.env.LOG_LEVEL || 'info';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    let log = `${timestamp} ${level}: ${message}`;
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Add file transport in non-test environments
if (process.env.NODE_ENV !== 'test') {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: logFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: logFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Stream for Morgan HTTP logger integration
export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};
