import { Hono } from 'hono';
import { getSetting, setSetting, getAllSettings, clearSettingsCache } from '../db/settings';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

const settingsRoute = new Hono();

const ALLOWED_KEYS = [
  'EMBY_URL', 'EMBY_API_KEY', 'EMBY_USER_ID',
  'TMDB_API_KEY', 'TMDB_LANGUAGE',
  'PROXY_ENABLED', 'PROXY_PROTOCOL', 'PROXY_HOST', 'PROXY_PORT',
  'SYNC_CRON',
];

// GET /api/settings
settingsRoute.get('/', (c) => {
  const all = getAllSettings();
  return c.json({
    EMBY_URL: all['EMBY_URL'] ?? '',
    EMBY_API_KEY: all['EMBY_API_KEY'] ?? '',
    EMBY_USER_ID: all['EMBY_USER_ID'] ?? '',
    TMDB_API_KEY: all['TMDB_API_KEY'] ?? '',
    TMDB_LANGUAGE: all['TMDB_LANGUAGE'] ?? 'zh-CN',
    PROXY_ENABLED: all['PROXY_ENABLED'] === 'true',
    PROXY_PROTOCOL: all['PROXY_PROTOCOL'] ?? 'http',
    PROXY_HOST: all['PROXY_HOST'] ?? '127.0.0.1',
    PROXY_PORT: all['PROXY_PORT'] ?? '7890',
    SYNC_CRON: all['SYNC_CRON'] ?? '0 */30 * * * *',
  });
});

// POST /api/settings
settingsRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    for (const key of ALLOWED_KEYS) {
      if (body[key] !== undefined) {
        setSetting(key, String(body[key]));
      }
    }
    clearSettingsCache();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/settings/test-tmdb - 测试 TMDB 连接（不走代理）
settingsRoute.get('/test-tmdb', async (c) => {
  const apiKey = getSetting('TMDB_API_KEY');
  if (!apiKey) return c.json({ ok: false, error: '未配置 TMDB API Key' }, 400);
  try {
    const res = await axios.get('https://api.themoviedb.org/3/configuration', {
      params: { api_key: apiKey },
      timeout: 10000,
    });
    return c.json({ ok: true, message: 'TMDB 连接成功', version: res.data.api_version ?? '' });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message ?? 'TMDB 请求失败' }, 502);
  }
});

// GET /api/settings/test-emby - 测试 Emby 连接
settingsRoute.get('/test-emby', async (c) => {
  const embyUrl = getSetting('EMBY_URL');
  const apiKey = getSetting('EMBY_API_KEY');
  if (!embyUrl) return c.json({ ok: false, error: '未配置 Emby 地址' }, 400);
  try {
    const res = await axios.get(`${embyUrl}/System/Info`, {
      headers: { 'X-Emby-Token': apiKey },
      timeout: 10000,
    });
    return c.json({ ok: true, message: `Emby 连接成功：${res.data.ServerName ?? res.data.ProductName ?? 'Emby'}`, version: res.data.Version ?? '' });
  } catch (e: any) {
    const status = e.response?.status;
    return c.json({ ok: false, error: status ? `HTTP ${status}: ${e.message}` : e.message ?? 'Emby 请求失败' }, 502);
  }
});

// GET /api/settings/test-proxy - 通过代理访问 TMDB 测试连通性
settingsRoute.get('/test-proxy', async (c) => {
  const proxyEnabled = getSetting('PROXY_ENABLED') === 'true';
  if (!proxyEnabled) return c.json({ ok: false, error: '代理未启用' }, 400);
  const protocol = getSetting('PROXY_PROTOCOL', 'http').toLowerCase();
  const host = getSetting('PROXY_HOST', '127.0.0.1');
  const port = getSetting('PROXY_PORT', '7890');
  const apiKey = getSetting('TMDB_API_KEY');
  const proxyUrl = `${protocol}://${host}:${port}`;
  try {
    const agent = protocol === 'socks5' ? new SocksProxyAgent(proxyUrl) : new HttpsProxyAgent(proxyUrl);
    const res = await axios.get('https://api.themoviedb.org/3/configuration', {
      params: { api_key: apiKey },
      httpsAgent: agent,
      httpAgent: agent,
      proxy: false as any,
      timeout: 10000,
    });
    return c.json({ ok: true, message: `代理 ${proxyUrl} 连接成功 (TMDB 可达)` });
  } catch (e: any) {
    return c.json({ ok: false, error: `通过 ${proxyUrl} 代理失败: ${e.message}` }, 502);
  }
});

export default settingsRoute;
