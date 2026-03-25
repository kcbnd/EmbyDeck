import { Hono } from 'hono';
import { getSetting, setSetting, getAllSettings, clearSettingsCache } from '../db/settings';
import axios from 'axios';
import { EmbyService } from '../services/emby.service';
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

// GET /api/settings/test-tmdb - 测试 TMDB 连接（支持即时参数测试）
settingsRoute.get('/test-tmdb', async (c) => {
  const apiKey = c.req.query('key') || getSetting('TMDB_API_KEY');
  if (!apiKey) return c.json({ ok: false, error: '未配置 TMDB API Key' }, 400);
  
  const proxyEnabled = getSetting('PROXY_ENABLED') === 'true';
  const protocol = getSetting('PROXY_PROTOCOL', 'http').toLowerCase();
  const host = getSetting('PROXY_HOST', '127.0.0.1');
  const port = getSetting('PROXY_PORT', '7890');
  
  try {
    const axiosConfig: any = {
      params: { api_key: apiKey },
      timeout: 10000,
    };
    
    if (proxyEnabled) {
      const proxyUrl = `${protocol}://${host}:${port}`;
      const agent = protocol === 'socks5' ? new SocksProxyAgent(proxyUrl) : new HttpsProxyAgent(proxyUrl);
      axiosConfig.httpsAgent = agent;
      axiosConfig.httpAgent = agent;
      axiosConfig.proxy = false;
    }
    
    const res = await axios.get('https://api.themoviedb.org/3/configuration', axiosConfig);
    const proxyInfo = proxyEnabled ? ` (通过代理 ${protocol}://${host}:${port})` : '';
    return c.json({ ok: true, message: `TMDB 连接成功${proxyInfo}`, version: res.data.api_version ?? '' });
  } catch (e: any) {
    const status = e.response?.status;
    const msg = e.response?.data?.status_message || e.message;
    return c.json({ ok: false, error: status ? `HTTP ${status}: ${msg}` : msg }, 200);
  }
});

// GET /api/settings/test-emby - 测试 Emby 连接（支持即时参数测试）
settingsRoute.get('/test-emby', async (c) => {
  const embyUrl = c.req.query('url') || getSetting('EMBY_URL');
  const apiKey = c.req.query('key') || getSetting('EMBY_API_KEY');
  if (!embyUrl) return c.json({ ok: false, error: '未配置 Emby 地址' }, 400);
  try {
    const res = await axios.get(`${embyUrl}/System/Info`, {
      headers: { 'X-Emby-Token': apiKey },
      timeout: 10000,
    });
    return c.json({ ok: true, message: `Emby 连接成功：${res.data.ServerName ?? res.data.ProductName ?? 'Emby'}`, version: res.data.Version ?? '' });
  } catch (e: any) {
    const status = e.response?.status;
    const msg = status === 401 ? 'API Key 无效或权限不足' : (e.message ?? '请求失败');
    return c.json({ ok: false, error: status ? `HTTP ${status}: ${msg}` : msg }, 200);
  }
});

// GET /api/settings/emby-users - 获取 Emby 用户列表
settingsRoute.get('/emby-users', async (c) => {
  const url = c.req.query('url');
  const key = c.req.query('key');
  if (!url || !key) return c.json({ ok: false, error: '请先填写服务器地址和 API Key' }, 400);
  try {
    const users = await EmbyService.getUsers(url, key);
    return c.json({ ok: true, users: users.map((u: any) => ({ id: u.Id, name: u.Name })) });
  } catch (e: any) {
    const status = e.response?.status;
    return c.json({ ok: false, error: status ? `HTTP ${status}: 获取用户失败` : e.message }, 200);
  }
});

// GET /api/settings/test-proxy - 通过代理访问 TMDB 测试连通性
settingsRoute.get('/test-proxy', async (c) => {
  const proxyEnabled = c.req.query('enabled') === 'true' || getSetting('PROXY_ENABLED') === 'true';
  if (!proxyEnabled) return c.json({ ok: false, error: '代理未启用' }, 400);
  
  const protocol = (c.req.query('protocol') || getSetting('PROXY_PROTOCOL', 'http')).toLowerCase();
  const host = c.req.query('host') || getSetting('PROXY_HOST', '127.0.0.1');
  const port = c.req.query('port') || getSetting('PROXY_PORT', '7890');
  const apiKey = c.req.query('tmdb_key') || getSetting('TMDB_API_KEY');
  
  const proxyUrl = `${protocol}://${host}:${port}`;
  try {
    const agent = protocol === 'socks5' ? new SocksProxyAgent(proxyUrl) : new HttpsProxyAgent(proxyUrl);
    await axios.get('https://api.themoviedb.org/3/configuration', {
      params: { api_key: apiKey },
      httpsAgent: agent,
      httpAgent: agent,
      proxy: false as any,
      timeout: 15000,
    });
    return c.json({ ok: true, message: `代理 ${proxyUrl} 连接成功 (TMDB 可达)` });
  } catch (e: any) {
    return c.json({ ok: false, error: `代理 ${proxyUrl} 连接失败: ${e.message}` }, 200);
  }
});

export default settingsRoute;
