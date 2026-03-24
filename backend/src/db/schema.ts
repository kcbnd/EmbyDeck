import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// 1. 剧集主表
export const shows = sqliteTable('shows', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  emby_id: text('emby_id').notNull().unique(),
  tmdb_id: text('tmdb_id'),
  title: text('title').notNull(),
  title_original: text('title_original'),
  poster_path: text('poster_path'),
  backdrop_path: text('backdrop_path'),
  overview: text('overview'),
  status: text('status').default('plan'), // plan / watching / watched
  total_seasons: integer('total_seasons').default(0),
  total_episodes: integer('total_episodes').default(0),
  vote_average: real('vote_average').default(0),
  genres: text('genres'), // JSON string
  first_air_date: text('first_air_date'),
  media_type: text('media_type').default('tv'),
  runtime: integer('runtime'),
  created_at: text('created_at'),
  updated_at: text('updated_at'),
});

// 2. 用户追剧状态
export const user_show_status = sqliteTable('user_show_status', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  show_id: integer('show_id').references(() => shows.id, { onDelete: 'cascade' }),
  watch_status: text('watch_status').default('plan'), // plan / watching / watched
  current_season: integer('current_season').default(1),
  current_episode: integer('current_episode').default(0),
  progress_pct: real('progress_pct').default(0),
  total_watched_episodes: integer('total_watched_episodes').default(0),
  total_watch_minutes: integer('total_watch_minutes').default(0),
  last_watched_at: text('last_watched_at'),
  is_favorite: integer('is_favorite', { mode: 'boolean' }).default(false),
  note: text('note'),
  created_at: text('created_at'),
  updated_at: text('updated_at'),
});

// 3. 季度表
export const seasons = sqliteTable('seasons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  show_id: integer('show_id').references(() => shows.id, { onDelete: 'cascade' }),
  season_number: integer('season_number'),
  name: text('name'),
  poster_path: text('poster_path'),
  episode_count: integer('episode_count').default(0),
  air_date: text('air_date'),
});

// 4. 分集表
export const episodes = sqliteTable('episodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  show_id: integer('show_id').references(() => shows.id, { onDelete: 'cascade' }),
  season_id: integer('season_id').references(() => seasons.id, { onDelete: 'cascade' }),
  emby_episode_id: text('emby_episode_id').unique(),
  season_number: integer('season_number'),
  episode_number: integer('episode_number'),
  title: text('title'),
  overview: text('overview'),
  runtime_minutes: integer('runtime_minutes').default(45),
  air_date: text('air_date'),
});

// 5. 播放进度明细
export const watch_progress = sqliteTable('watch_progress', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  episode_id: integer('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
  emby_play_session_id: text('emby_play_session_id'),
  played_percentage: real('played_percentage').default(0),
  position_ticks: integer('position_ticks').default(0),
  is_watched: integer('is_watched', { mode: 'boolean' }).default(false),
  watched_at: text('watched_at'),
  synced_at: text('synced_at'),
});

// 6. 同步日志
export const sync_log = sqliteTable('sync_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sync_type: text('sync_type'), // manual / auto / webhook
  status: text('status'), // running / success / error
  shows_synced: integer('shows_synced').default(0),
  episodes_synced: integer('episodes_synced').default(0),
  error_message: text('error_message'),
  started_at: text('started_at'),
  finished_at: text('finished_at'),
});
