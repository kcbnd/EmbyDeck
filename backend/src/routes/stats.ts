import { Hono } from 'hono';
import { db } from '../db/client';
import { shows, user_show_status, watch_progress, episodes, seasons, sync_log } from '../db/schema';
import { eq, desc, and, like, inArray } from 'drizzle-orm';

const statsRoute = new Hono();

// GET /api/stats
statsRoute.get('/', (c) => {
  const qType = c.req.query('type');
  const qYear = c.req.query('year');
  const qGenre = c.req.query('genre');
  const qStatus = c.req.query('status');

  let allShows = db.select().from(shows).all();
  let allStatus = db.select().from(user_show_status).all();

  // 1. 预处理提取所有可用的年份和类型
  const yearsSet = new Set<string>();
  const genresSet = new Set<string>();

  // 提取类型
  for (const s of allShows) {
    if (s.genres) {
      try {
        if (typeof s.genres === 'string') {
          if (s.genres.startsWith('[')) {
            const parsed = JSON.parse(s.genres);
            parsed.forEach((g: any) => genresSet.add(typeof g === 'object' ? g.name : String(g)));
          } else {
            s.genres.split(',').forEach(g => { if (g.trim()) genresSet.add(g.trim()); });
          }
        }
      } catch {}
    }
  }



  // 2. 内存过滤 allShows 和 allStatus
  if (qType) {
    allShows = allShows.filter(s => s.media_type === qType);
  }
  if (qYear) {
    // 先获取该年份有观看记录的剧集 ID
    const yearProgress = db.select({ episode_id: watch_progress.episode_id })
      .from(watch_progress)
      .where(
        and(
          eq(watch_progress.is_watched, true),
          like(watch_progress.watched_at, `${qYear}%`)
        )
      )
      .all();

    const episodeIds = new Set(yearProgress.map(p => p.episode_id));
    const showsWithYearWatch = new Set(
      db.select({ show_id: episodes.show_id })
        .from(episodes)
        .where(inArray(episodes.id, Array.from(episodeIds)))
        .all()
        .map(e => e.show_id)
    );

    allShows = allShows.filter(s => showsWithYearWatch.has(s.id));
  }
  if (qGenre) {
    allShows = allShows.filter(s => s.genres?.includes(qGenre));
  }
  if (qStatus) {
    const matchedStatusIds = new Set(allStatus.filter(st => st.watch_status === qStatus).map(st => st.show_id));
    allShows = allShows.filter(s => {
      const matched = matchedStatusIds.has(s.id);
      // 有的状态可能存储在 shows.status 中 (旧版)
      if (!matched && qStatus === 'plan' && (!s.status || s.status === 'plan')) return true;
      if (!matched && s.status === qStatus) return true;
      return matched;
    });
  }

  const validShowIds = new Set(allShows.map(s => s.id));
  allStatus = allStatus.filter(st => validShowIds.has(st.show_id));

  // 3. 计算基础统计指标
  const totalShows = allShows.length;
  const watchingCount = allStatus.filter(s => s.watch_status === 'watching').length;
  const watchedCount = allStatus.filter(s => s.watch_status === 'watched').length;
  const planCount = allStatus.filter(s => s.watch_status === 'plan').length;

  const totalWatchedEpisodes = allStatus.reduce((sum, s) => sum + (s.total_watched_episodes || 0), 0);
  const totalWatchMinutes = allStatus.reduce((sum, s) => sum + (s.total_watch_minutes || 0), 0);

  const lastSync = db.select().from(sync_log).orderBy(desc(sync_log.id)).limit(1).get();

  // 4. 获取符合条件的所有的 watch_progress 记录
  const allProgressRaw = db.select({
    watched_at: watch_progress.watched_at,
    is_watched: watch_progress.is_watched,
    show_id: episodes.show_id, // 联表拿到 show_id
  })
    .from(watch_progress)
    .leftJoin(episodes, eq(watch_progress.episode_id, episodes.id))
    .where(eq(watch_progress.is_watched, true))
    .all();

  // 提取观看年份
  for (const p of allProgressRaw) {
    if (p.watched_at) {
      const y = p.watched_at.slice(0, 4);
      if (y) yearsSet.add(y);
    }
  }

  const allProgress = allProgressRaw.filter(p => p.show_id && validShowIds.has(p.show_id));

  // 1) 热力图 (按日统计) & 单日最高纪录
  const dailyMap: Record<string, { count: number; showIds: Set<number> }> = {};
  for (const p of allProgress) {
    if (!p.watched_at) continue;
    const date = p.watched_at.slice(0, 10);
    if (!dailyMap[date]) dailyMap[date] = { count: 0, showIds: new Set() };
    dailyMap[date].count++;
    if (p.show_id) dailyMap[date].showIds.add(p.show_id);
  }

  const heatmap = Object.entries(dailyMap).map(([date, data]) => ({ date, count: data.count }));

  let bingeRecord = { date: '', count: 0, showNames: [] as string[] };
  for (const [date, data] of Object.entries(dailyMap)) {
    if (data.count > bingeRecord.count) {
      const names = Array.from(data.showIds).map(id => allShows.find(s => s.id === id)?.title || '');
      bingeRecord = { date, count: data.count, showNames: names.filter(Boolean) };
    }
  }

  // 2) 24小时生物钟
  const timeDistMap: Record<number, number> = {};
  for (let i = 0; i < 24; i++) timeDistMap[i] = 0;
  for (const p of allProgress) {
    if (!p.watched_at) continue;
    const hour = parseInt(p.watched_at.slice(11, 13), 10);
    if (!isNaN(hour)) timeDistMap[hour]++;
  }
  const timeDist = Object.entries(timeDistMap).map(([hour, count]) => ({ hour: parseInt(hour, 10), count }));

  // 3) 内容雷达 (过滤后的 shows 里的 genre)
  const genreMap: Record<string, number> = {};
  for (const s of allShows) {
    if (!s.genres) continue;
    let genresList: string[] = [];
    try {
      if (typeof s.genres === 'string') {
        if (s.genres.startsWith('[')) {
          genresList = JSON.parse(s.genres).map((g: any) => typeof g === 'object' ? g.name : String(g));
        } else {
          genresList = s.genres.split(',').map(x => x.trim()).filter(Boolean);
        }
      }
    } catch {}

    const st = allStatus.find(status => status.show_id === s.id);
    if (st && st.watch_status !== 'plan') {
      for (const genre of genresList) {
        if (!genre) continue;
        genreMap[genre] = (genreMap[genre] || 0) + 1;
      }
    }
  }
  // 如果是过滤单种类型，雷达图需要显示其他关联类型（因为大多剧集有多个类型），所以依然是对当前集合内的剧全景统计。
  const genres = Object.entries(genreMap)
    .sort((a, b) => b[1] - a[1])
    .map(([genre, count]) => ({ genre, count }));

  // 4) 弃剧纪录
  let abandonedCount = 0;
  const now = Date.now();
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  allStatus.filter(s => s.watch_status === 'watching').forEach(s => {
    if (s.updated_at) {
      const updatedTime = new Date(s.updated_at).getTime();
      if (now - updatedTime > NINETY_DAYS_MS) {
        abandonedCount++;
      }
    }
  });

  return c.json({
    totalShows,
    watchingCount,
    watchedCount,
    planCount,
    totalWatchedEpisodes,
    totalWatchMinutes,
    lastSyncAt: lastSync?.finished_at || null,
    
    heatmap,
    timeDist,
    genres,
    milestones: { bingeRecord, abandonedCount },

    // 给前端的筛选项
    filterOptions: {
      years: Array.from(yearsSet).sort((a, b) => b.localeCompare(a)),
      genres: Array.from(genresSet).sort((a, b) => a.localeCompare(b))
    }
  });
});

export default statsRoute;
