import cron from 'node-cron';
import { SyncService } from '../services/sync.service';
import { getSetting } from '../db/settings';

const syncService = new SyncService();

export function startScheduler() {
  const cronExpr = getSetting('SYNC_CRON', '0 */30 * * * *');
  cron.schedule(cronExpr, async () => {
    console.log('[Cron] Auto sync started...');
    try {
      await syncService.syncAll('auto');
    } catch (e: any) {
      console.error('[Cron] Auto sync failed:', e.message);
    }
  });
  console.log(`[Cron] Scheduler started with expression: ${cronExpr}`);
}
