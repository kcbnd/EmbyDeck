import { sqlite } from './client';
import fs from 'fs';
import path from 'path';

export function migrate() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS shows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emby_id TEXT NOT NULL UNIQUE,
      tmdb_id TEXT,
      title TEXT NOT NULL,
      title_original TEXT,
      poster_path TEXT,
      backdrop_path TEXT,
      overview TEXT,
      status TEXT DEFAULT 'plan',
      total_seasons INTEGER DEFAULT 0,
      total_episodes INTEGER DEFAULT 0,
      vote_average REAL DEFAULT 0,
      genres TEXT,
      first_air_date TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_show_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id INTEGER REFERENCES shows(id) ON DELETE CASCADE,
      watch_status TEXT DEFAULT 'plan',
      current_season INTEGER DEFAULT 1,
      current_episode INTEGER DEFAULT 0,
      progress_pct REAL DEFAULT 0,
      total_watched_episodes INTEGER DEFAULT 0,
      total_watch_minutes INTEGER DEFAULT 0,
      last_watched_at TEXT,
      is_favorite INTEGER DEFAULT 0,
      note TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id INTEGER REFERENCES shows(id) ON DELETE CASCADE,
      season_number INTEGER,
      name TEXT,
      poster_path TEXT,
      episode_count INTEGER DEFAULT 0,
      air_date TEXT
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id INTEGER REFERENCES shows(id) ON DELETE CASCADE,
      season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE,
      emby_episode_id TEXT UNIQUE,
      season_number INTEGER,
      episode_number INTEGER,
      title TEXT,
      overview TEXT,
      runtime_minutes INTEGER DEFAULT 45,
      air_date TEXT
    );

    CREATE TABLE IF NOT EXISTS watch_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
      emby_play_session_id TEXT,
      played_percentage REAL DEFAULT 0,
      position_ticks INTEGER DEFAULT 0,
      is_watched INTEGER DEFAULT 0,
      watched_at TEXT,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT,
      status TEXT,
      shows_synced INTEGER DEFAULT 0,
      episodes_synced INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TEXT,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );
  `);

  // Add new columns to shows if they don't exist yet
  const cols = sqlite.prepare("PRAGMA table_info(shows)").all() as any[];
  const colNames = cols.map(c => c.name);
  if (!colNames.includes('media_type')) sqlite.exec("ALTER TABLE shows ADD COLUMN media_type TEXT DEFAULT 'tv'");
  if (!colNames.includes('runtime')) sqlite.exec('ALTER TABLE shows ADD COLUMN runtime INTEGER');

  // One-time migration: only write keys that don't exist yet (never overwrite existing saved settings)
  const KEYS_WITH_DEFAULTS: Record<string, string> = {
    EMBY_URL: '',
    EMBY_API_KEY: '',
    EMBY_USER_ID: '',
    TMDB_API_KEY: '',
    TMDB_LANGUAGE: 'zh-CN',
    PROXY_ENABLED: 'false',
    PROXY_PROTOCOL: 'http',
    PROXY_HOST: '127.0.0.1',
    PROXY_PORT: '7890',
    SYNC_CRON: '0 */30 * * * *',
  };

  // Read existing keys from DB
  const existingKeys = new Set(
    (sqlite.prepare('SELECT key FROM settings').all() as any[]).map((r: any) => r.key)
  );

  // Read .env for bootstrap values (only used for keys not yet in DB)
  const envPath = path.resolve(process.cwd(), '.env');
  const envVals: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) envVals[m[1]] = m[2].trim();
    }
  }

  const stmt = sqlite.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
  const ts = new Date().toISOString();
  let migrated = 0;
  for (const [key, defaultVal] of Object.entries(KEYS_WITH_DEFAULTS)) {
    if (!existingKeys.has(key)) {
      stmt.run(key, envVals[key] ?? defaultVal, ts);
      migrated++;
    }
  }
  if (migrated > 0) console.log(`[DB] Settings initialized: ${migrated} keys written.`);

  console.log('[DB] Tables initialized.');
}
