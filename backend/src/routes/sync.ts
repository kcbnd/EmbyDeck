import { Hono } from 'hono';
import { db } from '../db/client';
import { sync_log } from '../db/schema';
import { desc, eq } from 'drizzle-orm';
import { SyncService } from '../services/sync.service';

const syncRoute = new Hono();
const syncService = new SyncService();

let isSyncing = false;

// POST /api/sync/manual
syncRoute.post('/manual', async (c) => {
  if (isSyncing) {
    return c.json({ error: 'Sync already in progress' }, 409);
  }
  isSyncing = true;
  // 异步执行，不阻塞响应
  syncService.syncAll('manual').finally(() => { isSyncing = false; });
  return c.json({ success: true, message: 'Sync started' });
});

// GET /api/sync/status
syncRoute.get('/status', (c) => {
  const latest = db.select().from(sync_log)
    .orderBy(desc(sync_log.id)).limit(1).get();
  return c.json({ syncing: isSyncing, latest: latest || null });
});

export default syncRoute;
