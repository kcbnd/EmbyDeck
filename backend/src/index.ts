import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { migrate } from './db/migrate';
import showsRoute from './routes/shows';
import episodesRoute from './routes/episodes';
import syncRoute from './routes/sync';
import statsRoute from './routes/stats';
import settingsRoute from './routes/settings';
import logsRoute from './routes/logs';
import webhookRoute from './webhooks/emby.webhook';
import { startScheduler } from './scheduler/cron';
import { ApiLogger } from './utils/logger';

// 初始化数据库
migrate();

const app = new Hono();

// 全局中间件
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// 健康检查
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// API 路由
app.route('/api/shows', showsRoute);
app.route('/api/episodes', episodesRoute);
app.route('/api/sync', syncRoute);
app.route('/api/stats', statsRoute);
app.route('/api/settings', settingsRoute);
app.route('/api/logs', logsRoute);
app.route('/webhooks/emby', webhookRoute);

// 启动定时任务
startScheduler();

const port = Number(process.env.PORT || 3000);
ApiLogger.info(`EmbyFlow backend running on port ${port}`, { port });

serve({ fetch: app.fetch, port });
