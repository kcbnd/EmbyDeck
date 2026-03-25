import { Hono } from 'hono';
import fs from 'fs/promises';
import path from 'path';

const logsRoute = new Hono();

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
  context?: any;
  stack?: string;
}

function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

logsRoute.get('/', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '200');
    const level = c.req.query('level');
    
    const dateStr = getLocalDateString();
    const logFile = path.join(LOG_DIR, `app-${dateStr}.log`);
    
    try {
      await fs.access(logFile);
    } catch {
      return c.json({ logs: [], message: '日志文件不存在' });
    }
    
    const content = await fs.readFile(logFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const parsedLogs: LogEntry[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as LogEntry;
        if (level && entry.level !== level) continue;
        parsedLogs.push(entry);
      } catch {
        continue;
      }
    }
    
    const recentLogs = parsedLogs.slice(-limit);
    
    return c.json({ logs: recentLogs, total: lines.length });
  } catch (e: any) {
    console.error('读取日志失败:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

export default logsRoute;
