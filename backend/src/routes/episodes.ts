import { Hono } from 'hono';
import { db } from '../db/client';
import { episodes, watch_progress, user_show_status, shows } from '../db/schema';
import { eq } from 'drizzle-orm';
import { EmbyService } from '../services/emby.service';

const episodesRoute = new Hono();
const embyService = new EmbyService();

// POST /api/episodes/:id/toggle - 标记单集已看/未看
episodesRoute.post('/:id/toggle', async (c) => {
  const id = Number(c.req.param('id'));
  const ep = db.select().from(episodes).where(eq(episodes.id, id)).get();
  if (!ep) return c.json({ error: 'Not found' }, 404);

  const existing = db.select().from(watch_progress)
    .where(eq(watch_progress.episode_id, id)).get();
  const isNowWatched = !(existing?.is_watched);
  const now = new Date().toISOString();

  if (existing) {
    db.update(watch_progress).set({
      is_watched: isNowWatched,
      played_percentage: isNowWatched ? 100 : 0,
      watched_at: isNowWatched ? now : null,
      synced_at: now,
    } as any).where(eq(watch_progress.id, existing.id)).run();
  } else {
    db.insert(watch_progress).values({
      episode_id: id,
      is_watched: isNowWatched,
      played_percentage: isNowWatched ? 100 : 0,
      watched_at: isNowWatched ? now : null,
      synced_at: now,
    } as any).run();
  }

  // 重新统计该剧集所有集的已看数量，更新 user_show_status 进度
  const showId = ep.show_id;
  if (showId) {
    const show = db.select({ total_episodes: shows.total_episodes }).from(shows).where(eq(shows.id, showId)).get();
    const totalEps = show?.total_episodes || 0;

    const allEpIds = db.select({ id: episodes.id }).from(episodes).where(eq(episodes.show_id, showId)).all().map(e => e.id);
    let watchedCount = 0;
    for (const epId of allEpIds) {
      const wp = db.select({ is_watched: watch_progress.is_watched }).from(watch_progress).where(eq(watch_progress.episode_id, epId)).get();
      if (wp?.is_watched) watchedCount++;
    }

    const progressPct = totalEps > 0 ? Math.round((watchedCount / totalEps) * 100) : 0;
    // 进度自动推导状态：0%→想看，1~99%→在看，100%→已看完
    const autoStatus = progressPct === 0 ? 'plan' : progressPct === 100 ? 'watched' : 'watching';
    const statusRow = db.select().from(user_show_status).where(eq(user_show_status.show_id, showId)).get();
    if (statusRow) {
      db.update(user_show_status).set({
        total_watched_episodes: watchedCount,
        progress_pct: progressPct,
        watch_status: autoStatus,
        updated_at: now,
      } as any).where(eq(user_show_status.id, statusRow.id)).run();
    }
    // 同步更新 shows.status
    db.update(shows).set({ status: autoStatus } as any).where(eq(shows.id, showId)).run();
  }

  // 同步回 Emby（手动添加条目的 emby_episode_id 含 manual_ 前缀，跳过）
  if (ep.emby_episode_id && !ep.emby_episode_id.startsWith('manual_')) {
    try {
      if (isNowWatched) {
        await embyService.markEpisodeWatched(ep.emby_episode_id);
      } else {
        await embyService.markEpisodeUnwatched(ep.emby_episode_id);
      }
    } catch (e) {
      console.warn('[Toggle] Emby sync failed:', e);
    }
  }

  return c.json({ success: true, is_watched: isNowWatched });
});

export default episodesRoute;
