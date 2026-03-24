import { Hono } from 'hono';
import { db } from '../db/client';
import { shows, user_show_status, seasons, episodes, watch_progress } from '../db/schema';
import { eq, inArray, desc, and, like } from 'drizzle-orm';
import { searchTmdbShowsList, searchTmdbMoviesList, fetchTmdbShow, fetchTmdbMovie, tmdbAxios } from '../services/tmdb.service';

const showsRoute = new Hono();

// GET /api/shows/search?q=关键词&type=all|tv|movie
showsRoute.get('/search', async (c) => {
  const q = c.req.query('q');
  const type = c.req.query('type') || 'all';
  if (!q) return c.json([]);
  
  let tmdbResults: any[] = [];
  if (type === 'tv') {
    tmdbResults = await searchTmdbShowsList(q);
  } else if (type === 'movie') {
    tmdbResults = await searchTmdbMoviesList(q);
  } else {
    const [tvs, movies] = await Promise.all([searchTmdbShowsList(q), searchTmdbMoviesList(q)]);
    tmdbResults = [...tvs, ...movies].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  }
  
  let existingSet = new Set<string>();
  if (tmdbResults.length > 0) {
    const existingShows = db.select({ tmdb_id: shows.tmdb_id })
      .from(shows)
      .where(inArray(shows.tmdb_id, tmdbResults.map((r: any) => String(r.id))))
      .all();
    existingSet = new Set(existingShows.map(s => String(s.tmdb_id)));
  }
  
  const formatted = tmdbResults.map((r: any) => ({
    tmdb_id: r.id,
    title: r.name,
    original_name: r.original_name,
    poster_path: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
    first_air_date: r.first_air_date,
    vote_average: r.vote_average,
    overview: r.overview,
    media_type: r.media_type || 'tv',
    already_added: existingSet.has(String(r.id))
  }));
  
  return c.json(formatted);
});

// POST /api/shows/add
showsRoute.post('/add', async (c) => {
  const body = await c.req.json();
  const tmdb_id = body.tmdb_id;
  const media_type = body.media_type || 'tv';
  if (!tmdb_id) return c.json({ error: 'Missing tmdb_id' }, 400);
  
  const existing = db.select().from(shows).where(eq(shows.tmdb_id, String(tmdb_id))).get();
  if (existing) return c.json({ error: 'Already added' }, 400);

  const detail = media_type === 'movie' ? await fetchTmdbMovie(String(tmdb_id)) : await fetchTmdbShow(String(tmdb_id));
  if (!detail) return c.json({ error: 'Failed to fetch TMDB details' }, 500);

  const title = detail.name || detail.title || detail.original_name || detail.original_title;
  const original_title = detail.original_name || detail.original_title;
  const first_air_date = detail.first_air_date || detail.release_date;

  const newShowId = db.insert(shows).values({
    emby_id: `manual_tmdb_${tmdb_id}`,
    tmdb_id: String(tmdb_id),
    title: title,
    title_original: original_title,
    poster_path: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
    backdrop_path: detail.backdrop_path ? `https://image.tmdb.org/t/p/w1280${detail.backdrop_path}` : null,
    overview: detail.overview,
    status: media_type === 'movie' ? 'plan' : 'plan',
    total_seasons: detail.number_of_seasons || null,
    total_episodes: detail.number_of_episodes || null,
    vote_average: detail.vote_average || 0,
    genres: JSON.stringify(detail.genres || []),
    first_air_date: first_air_date,
    media_type: media_type,
    runtime: detail.runtime || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any).returning({ id: shows.id }).get().id;

  db.insert(user_show_status).values({
    show_id: newShowId,
    watch_status: 'plan',
    current_season: media_type === 'movie' ? null : 1,
    current_episode: media_type === 'movie' ? null : 0,
    progress_pct: 0,
    total_watched_episodes: 0,
    total_watch_minutes: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as any).run();

  if (media_type === 'tv') {
    const seasonList = detail.seasons || [];
    console.log('[Add Show] 开始获取分集，tmdb_id:', tmdb_id, '季数:', seasonList.length);
    for (const s of seasonList) {
    if (s.season_number === 0) continue; 
    const newSeasonId = db.insert(seasons).values({
      show_id: newShowId,
      season_number: s.season_number,
      name: s.name,
      poster_path: s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : null,
      episode_count: s.episode_count,
      air_date: s.air_date
    } as any).returning({ id: seasons.id }).get().id;

    try {
      const seasonRes = await tmdbAxios().get(`/tv/${tmdb_id}/season/${s.season_number}`);
      const eps = seasonRes.data.episodes || [];
          console.log('[Add Show] 季', s.season_number, '写入分集数量:', eps.length);
          for (const ep of eps) {
        db.insert(episodes).values({
          show_id: newShowId,
          season_id: newSeasonId,
          emby_episode_id: `manual_tmdb_${tmdb_id}_s${s.season_number}e${ep.episode_number}`,
          season_number: s.season_number,
          episode_number: ep.episode_number,
          title: ep.name,
          overview: ep.overview,
          runtime_minutes: ep.runtime || 45,
          air_date: ep.air_date
        } as any).run();
      }
    } catch(e) { }
  }
  }

  const completeShow = db.select().from(shows).where(eq(shows.id, newShowId)).get();
  return c.json(completeShow);
});

// GET /api/shows - 所有剧集 + 追剧状态
showsRoute.get('/', (c) => {
  const qType = c.req.query('type');
  const qYear = c.req.query('year');
  const qGenre = c.req.query('genre');
  const qStatus = c.req.query('status');

  let allShows = db.select({
    id: shows.id,
    emby_id: shows.emby_id,
    tmdb_id: shows.tmdb_id,
    title: shows.title,
    title_original: shows.title_original,
    poster_path: shows.poster_path,
    backdrop_path: shows.backdrop_path,
    overview: shows.overview,
    status: shows.status,
    total_seasons: shows.total_seasons,
    total_episodes: shows.total_episodes,
    vote_average: shows.vote_average,
    genres: shows.genres,
    first_air_date: shows.first_air_date,
    media_type: shows.media_type,
    watch_status: user_show_status.watch_status,
    current_season: user_show_status.current_season,
    current_episode: user_show_status.current_episode,
    progress_pct: user_show_status.progress_pct,
    total_watched_episodes: user_show_status.total_watched_episodes,
    total_watch_minutes: user_show_status.total_watch_minutes,
    last_watched_at: user_show_status.last_watched_at,
    is_favorite: user_show_status.is_favorite,
  }).from(shows)
    .leftJoin(user_show_status, eq(shows.id, user_show_status.show_id))
    .all();

  // 筛选逻辑
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
    allShows = allShows.filter(s => {
      const sStatus = s.status || s.watch_status || 'plan';
      return sStatus === qStatus;
    });
  }

  return c.json(allShows);
});

// GET /api/shows/:id - 剧集详情 + 所有季集
showsRoute.get('/:id', (c) => {
  const id = Number(c.req.param('id'));
  const show = db.select().from(shows).where(eq(shows.id, id)).get();
  if (!show) return c.json({ error: 'Not found' }, 404);

  const status = db.select().from(user_show_status).where(eq(user_show_status.show_id, id)).get();
  const seasonList = db.select().from(seasons).where(eq(seasons.show_id, id)).all();
  const seasonIds = seasonList.map(s => s.id);

  let epList: any[] = [];
  if (seasonIds.length > 0) {
    epList = db.select({
      id: episodes.id,
      season_id: episodes.season_id,
      season_number: episodes.season_number,
      episode_number: episodes.episode_number,
      title: episodes.title,
      overview: episodes.overview,
      runtime_minutes: episodes.runtime_minutes,
      emby_episode_id: episodes.emby_episode_id,
      is_watched: watch_progress.is_watched,
      played_percentage: watch_progress.played_percentage,
      watched_at: watch_progress.watched_at,
    }).from(episodes)
      .leftJoin(watch_progress, eq(episodes.id, watch_progress.episode_id))
      .where(inArray(episodes.season_id, seasonIds))
      .all();
  }

  const enrichedSeasons = seasonList.map(s => ({
    ...s,
    episodes: epList
      .filter(e => e.season_id === s.id)
      .sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0)),
  }));

  console.log('[Show Detail] id:', id, 'seasons:', seasonList.length, 'episodes:', epList.length);
  return c.json({ ...show, user_status: status || null, seasons: enrichedSeasons, episodes: epList });
});

// PATCH /api/shows/:id/status - 手动修改追剧状态
showsRoute.patch('/:id/status', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const { watch_status, progress_pct } = body;
  if (!['plan', 'watching', 'watched'].includes(watch_status)) {
    return c.json({ error: 'Invalid status' }, 400);
  }
  const now = new Date().toISOString();
  db.update(shows).set({ status: watch_status } as any).where(eq(shows.id, id)).run();
  const existing = db.select().from(user_show_status).where(eq(user_show_status.show_id, id)).get();
  const updatePayload: any = { watch_status, updated_at: now };
  if (progress_pct !== undefined) updatePayload.progress_pct = progress_pct;
  if (existing) {
    db.update(user_show_status).set(updatePayload).where(eq(user_show_status.id, existing.id)).run();
  } else {
    db.insert(user_show_status).values({ show_id: id, watch_status, progress_pct: progress_pct ?? 0, created_at: now, updated_at: now } as any).run();
  }
  return c.json({ success: true });
});

// POST /api/shows/:id/mark-all-watched - 一键全部标记已看/取消已看
showsRoute.post('/:id/mark-all-watched', async (c) => {
  const id = Number(c.req.param('id'));
  const now = new Date().toISOString();
  let watched = true;
  let seasonId: number | undefined;
  try { 
    const body = await c.req.json(); 
    if (body.watched === false) watched = false; 
    if (body.season_id) seasonId = Number(body.season_id);
  } catch {}

  const allEpsData = db.select({ id: episodes.id, season_id: episodes.season_id }).from(episodes).where(eq(episodes.show_id, id)).all();
  const targetEps = seasonId ? allEpsData.filter(e => e.season_id === seasonId) : allEpsData;

  for (const ep of targetEps) {
    const wpRow = db.select().from(watch_progress).where(eq(watch_progress.episode_id, ep.id)).get();
    if (wpRow) {
      db.update(watch_progress).set({
        is_watched: watched,
        played_percentage: watched ? 100 : 0,
        watched_at: watched ? now : null,
        synced_at: now,
      } as any).where(eq(watch_progress.id, wpRow.id)).run();
    } else if (watched) {
      // 取消时不需要创建新记录
      db.insert(watch_progress).values({ episode_id: ep.id, is_watched: true, played_percentage: 100, watched_at: now, synced_at: now } as any).run();
    }
  }

  // 重新计算整个剧集的进度 (可能只变更了一季，需要全量统计)
  let watchedCount = 0;
  for (const ep of allEpsData) {
    const wp = db.select({ is_watched: watch_progress.is_watched }).from(watch_progress).where(eq(watch_progress.episode_id, ep.id)).get();
    if (wp?.is_watched) watchedCount++;
  }

  const showRow = db.select({ total_episodes: shows.total_episodes }).from(shows).where(eq(shows.id, id)).get();
  const totalEps = showRow?.total_episodes || allEpsData.length;
  const progressPct = totalEps > 0 ? Math.round((watchedCount / totalEps) * 100) : 0;
  const newStatus = progressPct === 0 ? 'plan' : progressPct === 100 ? 'watched' : 'watching';

  const statusRow = db.select().from(user_show_status).where(eq(user_show_status.show_id, id)).get();
  if (statusRow) {
    db.update(user_show_status).set({
      total_watched_episodes: watchedCount,
      progress_pct: progressPct,
      watch_status: newStatus,
      updated_at: now,
    } as any).where(eq(user_show_status.id, statusRow.id)).run();
  }
  db.update(shows).set({ status: newStatus } as any).where(eq(shows.id, id)).run();
  return c.json({ success: true });
});

// GET /api/shows/:id/history - 获取剧集的观看历程
showsRoute.get('/:id/history', (c) => {
  const id = Number(c.req.param('id'));
  const history = db.select({
    id: watch_progress.id,
    episode_id: watch_progress.episode_id,
    watched_at: watch_progress.watched_at,
    name: episodes.name,
    season_number: episodes.season_number,
    episode_number: episodes.episode_number,
  }).from(watch_progress)
    .innerJoin(episodes, eq(watch_progress.episode_id, episodes.id))
    .where(eq(episodes.show_id, id))
    .orderBy(desc(watch_progress.watched_at))
    .all()
    .filter(item => item.watched_at); // 只取有观看时间的

  return c.json(history);
});

// DELETE /api/shows/:id - 删除剧集及全部关联数据（CASCADE 已处理）
showsRoute.delete('/:id', (c) => {
  const id = Number(c.req.param('id'));
  const show = db.select({ id: shows.id }).from(shows).where(eq(shows.id, id)).get();
  if (!show) return c.json({ error: 'Not found' }, 404);
  db.delete(shows).where(eq(shows.id, id)).run();
  return c.json({ success: true });
});

export default showsRoute;

