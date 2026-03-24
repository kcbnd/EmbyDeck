import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { getSetting } from '../db/settings';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function getProxyAgent() {
  if (getSetting('PROXY_ENABLED') !== 'true') return undefined;
  const protocol = getSetting('PROXY_PROTOCOL', 'http').toLowerCase();
  const host = getSetting('PROXY_HOST', '127.0.0.1');
  const port = getSetting('PROXY_PORT', '7890');
  const url = `${protocol}://${host}:${port}`;
  return protocol === 'socks5' ? new SocksProxyAgent(url) : new HttpsProxyAgent(url);
}

export function tmdbAxios() {
  const agent = getProxyAgent();
  return axios.create({
    baseURL: TMDB_BASE,
    params: {
      api_key: getSetting('TMDB_API_KEY'),
      language: getSetting('TMDB_LANGUAGE', 'zh-CN'),
    },
    ...(agent ? { httpsAgent: agent, httpAgent: agent, proxy: false as any } : {}),
    timeout: 15000,
  });
}

export async function fetchTmdbShow(tmdbId: string) {
  try {
    const res = await tmdbAxios().get(`/tv/${tmdbId}`);
    return res.data;
  } catch (e) {
    return null;
  }
}

export async function searchTmdbShow(name: string) {
  try {
    const res = await tmdbAxios().get('/search/tv', { params: { query: name } });
    return res.data.results?.[0] || null;
  } catch (e) {
    return null;
  }
}

export async function searchTmdbShowsList(name: string) {
  try {
    const res = await tmdbAxios().get('/search/tv', { params: { query: name } });
    return (res.data.results || []).map((r: any) => ({ ...r, media_type: 'tv' }));
  } catch (e) {
    return [];
  }
}

export async function searchTmdbMoviesList(name: string) {
  try {
    const res = await tmdbAxios().get('/search/movie', { params: { query: name } });
    return (res.data.results || []).map((r: any) => ({ ...r, name: r.title, original_name: r.original_title, first_air_date: r.release_date, media_type: 'movie' }));
  } catch (e) {
    return [];
  }
}

export async function fetchTmdbMovie(tmdbId: string) {
  try {
    const res = await tmdbAxios().get(`/movie/${tmdbId}`);
    return res.data;
  } catch (e) {
    return null;
  }
}
