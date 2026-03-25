import axios from 'axios';
import { getSetting } from '../db/settings';

function embyAxios() {
  return axios.create({
    baseURL: getSetting('EMBY_URL'),
    headers: { 'X-Emby-Token': getSetting('EMBY_API_KEY') },
    timeout: 30000,
  });
}

export class EmbyService {
  async getLibraryShows() {
    const userId = getSetting('EMBY_USER_ID');
    const res = await embyAxios().get(`/Users/${userId}/Items`, {
      params: {
        IncludeItemTypes: 'Series',
        Recursive: true,
        Fields: 'Overview,ProviderIds,ImageTags,UserData,RunTimeTicks',
      },
    });
    return res.data;
  }

  async getShowSeasons(seriesId: string) {
    const userId = getSetting('EMBY_USER_ID');
    const res = await embyAxios().get(`/Shows/${seriesId}/Seasons`, {
      params: { UserId: userId },
    });
    return res.data;
  }

  async getSeasonEpisodes(seriesId: string, seasonId: string) {
    const userId = getSetting('EMBY_USER_ID');
    const res = await embyAxios().get(`/Shows/${seriesId}/Episodes`, {
      params: {
        SeasonId: seasonId,
        UserId: userId,
        Fields: 'UserData,RunTimeTicks,Overview',
      },
    });
    return res.data;
  }

  async markEpisodeWatched(embyEpisodeId: string) {
    const userId = getSetting('EMBY_USER_ID');
    await embyAxios().post(`/Users/${userId}/PlayedItems/${embyEpisodeId}`);
  }

  async markEpisodeUnwatched(embyEpisodeId: string) {
    const userId = getSetting('EMBY_USER_ID');
    await embyAxios().delete(`/Users/${userId}/PlayedItems/${embyEpisodeId}`);
  }

  // 获取播放历史
  async getPlaybackHistory() {
    const userId = getSetting('EMBY_USER_ID');
    const res = await embyAxios().get(`/Users/${userId}/Items`, {
      params: {
        IncludeItemTypes: 'Episode,Movie',
        Recursive: true,
        Fields: 'Overview,ProviderIds,ImageTags,UserData,RunTimeTicks,DatePlayed',
        SortBy: 'DatePlayed',
        SortOrder: 'Descending',
        Limit: 1000
      },
    });
    return res.data;
  }

  // 获取活动日志（包含播放记录）
  async getActivityLog() {
    const res = await embyAxios().get('/System/ActivityLog/Entries', {
      params: {
        Limit: 1000,
        StartIndex: 0
      },
    });
    return res.data;
  }

  // 获取用户列表（用于设置页选择 User ID）
  static async getUsers(url: string, key: string) {
    const res = await axios.get(`${url}/Users`, {
      headers: { 'X-Emby-Token': key },
      timeout: 10000,
    });
    return res.data;
  }
}
