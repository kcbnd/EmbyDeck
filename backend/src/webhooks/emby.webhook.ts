import { Hono } from 'hono';
import { db } from '../db/client';
import { shows, seasons, episodes, watch_progress, user_show_status } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const webhookRoute = new Hono();

webhookRoute.post('/', async (c) => {
  try {
    let payload: any = null;
    const contentType = c.req.header('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const dataStr = formData.get('data') as string;
      if (dataStr) payload = JSON.parse(dataStr);
    } else {
      const text = await c.req.text();
      if (text) payload = JSON.parse(text);
    }

    if (!payload) return c.json({ received: false, error: 'Empty payload' }, 400);

    const event: string = payload.Event || '';
    const item = payload.Item;
    const session = payload.Session;
    const playbackInfo = payload.PlaybackInfo;

    if (item?.Type !== 'Episode' || !event.startsWith('playback.')) {
      return c.json({ received: true, ignored: true });
    }

    const seriesId: string = item.SeriesId;
    const embyEpId: string = item.Id;
    const now = new Date().toISOString();

    // 1. 确保 show 存在
    let show = db.select().from(shows).where(eq(shows.emby_id, seriesId)).get();
    if (!show) {
      const result = db.insert(shows).values({
        emby_id: seriesId,
        title: item.SeriesName || '未知剧集',
        created_at: now,
        updated_at: now,
      } as any).run();
      const newId = result.lastInsertRowid as number;
      show = db.select().from(shows).where(eq(shows.id, newId)).get() as any;
    }
    if (!show) return c.json({ received: true, error: 'Cannot create show' });

    // 2. 确保 season 存在
    const seasonNum = item.ParentIndexNumber || 1;
    let season = db.select().from(seasons)
      .where(and(eq(seasons.show_id, show.id), eq(seasons.season_number, seasonNum))).get();
    if (!season) {
      const result = db.insert(seasons).values({
        show_id: show.id,
        season_number: seasonNum,
        name: item.SeasonName || `第 ${seasonNum} 季`,
      } as any).run();
      const sid = result.lastInsertRowid as number;
      season = db.select().from(seasons).where(eq(seasons.id, sid)).get() as any;
    }

    // 3. 确保 episode 存在
    let episode = db.select().from(episodes).where(eq(episodes.emby_episode_id, embyEpId)).get();
    if (!episode) {
      const result = db.insert(episodes).values({
        show_id: show.id,
        season_id: season?.id,
        emby_episode_id: embyEpId,
        season_number: seasonNum,
        episode_number: item.IndexNumber || 1,
        title: item.Name || `第 ${item.IndexNumber} 集`,
        overview: item.Overview || null,
      } as any).run();
      const eid = result.lastInsertRowid as number;
      episode = db.select().from(episodes).where(eq(episodes.id, eid)).get() as any;
    }
    if (!episode) return c.json({ received: true, error: 'Cannot create episode' });

    // 4. 更新播放进度
    const sessionId = session?.Id || 'webhook-session';
    const positionTicks = playbackInfo?.PositionTicks || item.PlaybackPositionTicks || 0;
    const runTimeTicks = item.RunTimeTicks || 1;
    let pct = Math.min(100, (positionTicks / runTimeTicks) * 100);
    if (item.Played) pct = 100;
    const isWatched = pct >= 90 || item.Played === true;

    const existingProgress = db.select().from(watch_progress)
      .where(eq(watch_progress.episode_id, episode.id)).get();

    const progressPayload: any = {
      episode_id: episode.id,
      emby_play_session_id: sessionId,
      played_percentage: pct,
      position_ticks: positionTicks,
      is_watched: isWatched,
      watched_at: isWatched ? now : null,
      synced_at: now,
    };

    if (existingProgress) {
      db.update(watch_progress).set(progressPayload).where(eq(watch_progress.id, existingProgress.id)).run();
    } else {
      db.insert(watch_progress).values(progressPayload as any).run();
    }

    // 5. 更新 user_show_status
    if (isWatched) {
      const allEps = db.select({ id: episodes.id }).from(episodes)
        .where(eq(episodes.show_id, show.id)).all();
      const watchedEps = db.select({ ep_id: watch_progress.episode_id })
        .from(watch_progress)
        .where(eq(watch_progress.is_watched, true)).all();
      const watchedSet = new Set(watchedEps.map(w => w.ep_id));
      const totalWatched = allEps.filter(e => watchedSet.has(e.id)).length;
      const total = allEps.length;
      let watchStatus = 'plan';
      if (totalWatched > 0 && totalWatched < total) watchStatus = 'watching';
      else if (total > 0 && totalWatched >= total) watchStatus = 'watched';

      const existingStatus = db.select().from(user_show_status)
        .where(eq(user_show_status.show_id, show.id)).get();
      const statusPayload: any = {
        show_id: show.id,
        watch_status: watchStatus,
        current_season: seasonNum,
        current_episode: item.IndexNumber || 1,
        total_watched_episodes: totalWatched,
        progress_pct: total > 0 ? Math.round((totalWatched / total) * 100) : 0,
        last_watched_at: now,
        updated_at: now,
      };
      if (existingStatus) {
        db.update(user_show_status).set(statusPayload).where(eq(user_show_status.id, existingStatus.id)).run();
      } else {
        statusPayload.created_at = now;
        db.insert(user_show_status).values(statusPayload as any).run();
      }
      db.update(shows).set({ status: watchStatus } as any).where(eq(shows.id, show.id)).run();
    }

    console.log(`[Webhook] ${item.SeriesName} S${seasonNum}E${item.IndexNumber} - ${pct.toFixed(1)}%`);
    return c.json({ received: true, success: true });
  } catch (e: any) {
    console.error('[Webhook] Error:', e.message);
    return c.json({ received: false, error: e.message }, 500);
  }
});

export default webhookRoute;
