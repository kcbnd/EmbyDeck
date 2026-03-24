import { sqlite } from './client';

/**
 * 从 settings 表读取单个配置项，缓存在内存中提升热路径性能
 */
const cache: Record<string, string | undefined> = {};

export function getSetting(key: string, fallback = ''): string {
  if (key in cache) return cache[key] ?? fallback;
  const row = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  const val = row?.value ?? fallback;
  cache[key] = val;
  return val;
}

export function setSetting(key: string, value: string) {
  sqlite.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
    .run(key, value, new Date().toISOString());
  cache[key] = value;
}

export function getAllSettings(): Record<string, string> {
  const rows = sqlite.prepare('SELECT key, value FROM settings').all() as any[];
  return Object.fromEntries(rows.map(r => [r.key, r.value ?? '']));
}

/** 在保存设置后清除缓存，让服务重新读取 */
export function clearSettingsCache() {
  for (const k of Object.keys(cache)) delete cache[k];
}
