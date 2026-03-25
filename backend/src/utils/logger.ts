import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const localTimestamp = winston.format((info) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  info.timestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  return info;
});

const jsonFormat = winston.format.combine(
  localTimestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  localTimestamp(),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, module, message, context }) => {
    const moduleTag = module ? `[${module}]` : '';
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `${timestamp} ${level}:${moduleTag} ${message}${contextStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  transports: [
    new DailyRotateFile({
      filename: path.join(LOG_DIR, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: jsonFormat,
    }),
    new DailyRotateFile({
      filename: path.join(LOG_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
      format: jsonFormat,
    }),
  ],
  exitOnError: false,
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

export const createModuleLogger = (moduleName: string) => {
  return {
    debug: (message: string, context?: any) => {
      logger.debug(message, { module: moduleName, context });
    },
    info: (message: string, context?: any) => {
      logger.info(message, { module: moduleName, context });
    },
    warn: (message: string, context?: any) => {
      logger.warn(message, { module: moduleName, context });
    },
    error: (message: string, error?: Error | any, context?: any) => {
      const errorContext: any = { ...context };
      
      if (error) {
        errorContext.error = {
          message: error.message,
          name: error.name,
          stack: error.stack,
        };
      }
      
      logger.error(message, { module: moduleName, context: errorContext });
    },
  };
};

export const EmbyWebhookLogger = createModuleLogger('Emby_Webhook');
export const CronSyncLogger = createModuleLogger('Cron_Sync');
export const TmdbApiLogger = createModuleLogger('TMDB_API');
export const DbEngineLogger = createModuleLogger('DB_Engine');
export const SettingsLogger = createModuleLogger('Settings');
export const ApiLogger = createModuleLogger('API');

export default logger;
