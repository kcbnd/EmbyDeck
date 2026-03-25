import fs from 'fs';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: any;
  stack?: string;
}

function getLogFileName(): string {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  return path.join(LOG_DIR, `app-${dateStr}.log`);
}

function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function writeLog(entry: LogEntry): void {
  const logFile = getLogFileName();
  const logLine = formatLogEntry(entry) + '\n';
  
  fs.appendFileSync(logFile, logLine, 'utf-8');
  
  if (entry.level === 'error') {
    const errorLogFile = path.join(LOG_DIR, `error-${getLogFileName().split('-').slice(-2).join('-')}`);
    fs.appendFileSync(errorLogFile, logLine, 'utf-8');
  }
  
  const consoleMethod = entry.level === 'error' ? 'error' : 
                        entry.level === 'warn' ? 'warn' : 
                        entry.level === 'debug' ? 'debug' : 'log';
  
  const moduleTag = `[${entry.module}]`;
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
  const stackStr = entry.stack ? `\n${entry.stack}` : '';
  
  console[consoleMethod](`${entry.timestamp} ${entry.level.toUpperCase()}:${moduleTag} ${entry.message}${contextStr}${stackStr}`);
}

function createModuleLogger(moduleName: string) {
  return {
    debug: (message: string, context?: any) => {
      writeLog({
        timestamp: new Date().toISOString(),
        level: 'debug',
        module: moduleName,
        message,
        context,
      });
    },
    info: (message: string, context?: any) => {
      writeLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        module: moduleName,
        message,
        context,
      });
    },
    warn: (message: string, context?: any) => {
      writeLog({
        timestamp: new Date().toISOString(),
        level: 'warn',
        module: moduleName,
        message,
        context,
      });
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
      
      writeLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        module: moduleName,
        message,
        context: errorContext,
        stack: error?.stack,
      });
    },
  };
}

export const EmbyWebhookLogger = createModuleLogger('Emby_Webhook');
export const CronSyncLogger = createModuleLogger('Cron_Sync');
export const TmdbApiLogger = createModuleLogger('TMDB_API');
export const DbEngineLogger = createModuleLogger('DB_Engine');
export const SettingsLogger = createModuleLogger('Settings');
export const ApiLogger = createModuleLogger('API');

export default {
  debug: (module: string, message: string, context?: any) => createModuleLogger(module).debug(message, context),
  info: (module: string, message: string, context?: any) => createModuleLogger(module).info(message, context),
  warn: (module: string, message: string, context?: any) => createModuleLogger(module).warn(message, context),
  error: (module: string, message: string, error?: Error | any, context?: any) => createModuleLogger(module).error(message, error, context),
};
