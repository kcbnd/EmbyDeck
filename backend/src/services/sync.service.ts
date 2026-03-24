import { db } from '../db/client';
import { shows, seasons, episodes, watch_progress, user_show_status, sync_log } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { EmbyService } from './emby.service';
import { fetchTmdbShow, searchTmdbShow } from './tmdb.service';
import { getSetting } from '../db/settings';

const embyService = new EmbyService();

function now() {
  return new Date().toISOString();
}

export class SyncService {
  async syncAll(syncType = 'manual') {
    const started_at = now();
    db.insert(sync_log).values({ sync_type: syncType, status: 'running', started_at } as any).run();

    let showsSynced = 0;
    let episodesSynced = 0;

    try {
      // 获取播放历史数据
      const playbackHistory = await embyService.getPlaybackHistory();
      const activityLog = await embyService.getActivityLog();
      
      // 处理播放历史数据
      this.processPlaybackHistory(playbackHistory);
      
      const embyData = await embyService.getLibraryShows();
      const items = embyData.Items || [];

      for (const item of items) {
        try {
          const embyId = item.Id;
          const tmdbId = item.ProviderIds?.Tmdb || '';
          const imageTag = item.ImageTags?.Primary;
          const posterPath = imageTag
            ? `${getSetting('EMBY_URL')}/Items/${embyId}/Images/Primary?tag=${imageTag}`
            : null;

          // 从 TMDB 补充元数据
          let tmdbData: any = null;
          if (tmdbId) {
            tmdbData = await fetchTmdbShow(tmdbId);
          }
          if (!tmdbData && item.Name) {
            tmdbData = await searchTmdbShow(item.Name);
          }

          const showPayload: any = {
            emby_id: embyId,
            tmdb_id: tmdbId || (tmdbData?.id?.toString() ?? null),
            title: tmdbData?.name || item.Name || '未知',
            title_original: tmdbData?.original_name || item.OriginalTitle || null,
            poster_path: tmdbData?.poster_path
              ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}`
              : posterPath,
            backdrop_path: tmdbData?.backdrop_path
              ? `https://image.tmdb.org/t/p/w1280${tmdbData.backdrop_path}`
              : null,
            overview: tmdbData?.overview || item.Overview || null,
            total_seasons: tmdbData?.number_of_seasons || 0,
            total_episodes: tmdbData?.number_of_episodes || 0,
            vote_average: tmdbData?.vote_average || 0,
            genres: tmdbData?.genres ? JSON.stringify(tmdbData.genres.map((g: any) => g.name)) : null,
            first_air_date: tmdbData?.first_air_date || null,
            updated_at: now(),
          };

          const existing = db.select().from(shows).where(eq(shows.emby_id, embyId)).get();
          let showId: number;

          if (existing) {
            showId = existing.id;
            db.update(shows).set(showPayload).where(eq(shows.id, showId)).run();
          } else {
            showPayload.created_at = now();
            const result = db.insert(shows).values(showPayload as any).run();
            showId = result.lastInsertRowid as number;
          }

          showsSynced++;

          // 同步季和集
          const seasonsData = await embyService.getShowSeasons(embyId);
          let totalWatched = 0;
          let totalEps = 0;
          let lastWatchedAt: string | null = null;
          let currentSeason = 1;
          let currentEpisode = 0;

          for (const s of seasonsData.Items || []) {
            if (!s.IndexNumber) continue;
            const seasonNum = s.IndexNumber;

            const existingSeason = db.select().from(seasons)
              .where(and(eq(seasons.show_id, showId), eq(seasons.season_number, seasonNum))).get();

            let seasonId: number;
            const seasonPayload: any = {
              show_id: showId,
              season_number: seasonNum,
              name: s.Name || `第 ${seasonNum} 季`,
              episode_count: s.ChildCount || 0,
            };

            if (existingSeason) {
              seasonId = existingSeason.id;
              db.update(seasons).set(seasonPayload).where(eq(seasons.id, seasonId)).run();
            } else {
              const result = db.insert(seasons).values(seasonPayload as any).run();
              seasonId = result.lastInsertRowid as number;
            }

            // 同步分集
            const epsData = await embyService.getSeasonEpisodes(embyId, s.Id);
            for (const ep of epsData.Items || []) {
              if (ep.Type !== 'Episode') continue;
              totalEps++;

              const epPayload: any = {
                show_id: showId,
                season_id: seasonId,
                emby_episode_id: ep.Id,
                season_number: seasonNum,
                episode_number: ep.IndexNumber || 0,
                title: ep.Name || `第 ${ep.IndexNumber} 集`,
                overview: ep.Overview || null,
                runtime_minutes: ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / 600000000) : 45,
                air_date: ep.PremiereDate || null,
              };

              const existingEp = db.select().from(episodes)
                .where(eq(episodes.emby_episode_id, ep.Id)).get();
              let epId: number;

              if (existingEp) {
                epId = existingEp.id;
                db.update(episodes).set(epPayload).where(eq(episodes.id, epId)).run();
              } else {
                const result = db.insert(episodes).values(epPayload as any).run();
                epId = result.lastInsertRowid as number;
              }
              episodesSynced++;

              // 播放进度
              const userData = ep.UserData || {};
              const pct = userData.PlayedPercentage || (userData.Played ? 100 : 0);
              const isWatched = userData.Played === true || pct >= 90;

              if (pct > 0 || isWatched) {
                const existingProgress = db.select().from(watch_progress)
                  .where(eq(watch_progress.episode_id, epId)).get();
                const progressPayload: any = {
                  episode_id: epId,
                  played_percentage: pct,
                  position_ticks: userData.PlaybackPositionTicks || 0,
                  is_watched: isWatched,
                  watched_at: isWatched ? now() : null,
                  synced_at: now(),
                };
                if (existingProgress) {
                  db.update(watch_progress).set(progressPayload).where(eq(watch_progress.id, existingProgress.id)).run();
                } else {
                  db.insert(watch_progress).values(progressPayload as any).run();
                }

                if (isWatched) {
                  totalWatched++;
                  if (!lastWatchedAt || now() > lastWatchedAt) lastWatchedAt = now();
                  if (seasonNum > currentSeason || (seasonNum === currentSeason && (ep.IndexNumber || 0) > currentEpisode)) {
                    currentSeason = seasonNum;
                    currentEpisode = ep.IndexNumber || 0;
                  }
                }
              }
            }
          }

          // 计算追剧状态
          let watchStatus = 'plan';
          if (totalWatched > 0 && totalWatched < totalEps) watchStatus = 'watching';
          else if (totalEps > 0 && totalWatched >= totalEps) watchStatus = 'watched';

          const statusPayload: any = {
            show_id: showId,
            watch_status: watchStatus,
            current_season: currentSeason,
            current_episode: currentEpisode,
            total_watched_episodes: totalWatched,
            progress_pct: totalEps > 0 ? Math.round((totalWatched / totalEps) * 100) : 0,
            last_watched_at: lastWatchedAt,
            updated_at: now(),
          };

          const existingStatus = db.select().from(user_show_status)
            .where(eq(user_show_status.show_id, showId)).get();
          if (existingStatus) {
            // 已有记录：只更新 Emby 同步来的播放进度数据，保留用户手动设置的 watch_status
            db.update(user_show_status).set({
              current_season: currentSeason,
              current_episode: currentEpisode,
              total_watched_episodes: totalWatched,
              progress_pct: totalEps > 0 ? Math.round((totalWatched / totalEps) * 100) : existingStatus.progress_pct,
              last_watched_at: lastWatchedAt,
              updated_at: now(),
              // watch_status: 不覆盖，用户在 UI 手动设置的状态优先
            } as any).where(eq(user_show_status.id, existingStatus.id)).run();
          } else {
            // 首次同步，写入完整状态
            const initPayload: any = {
              show_id: showId,
              watch_status: watchStatus,
              current_season: currentSeason,
              current_episode: currentEpisode,
              total_watched_episodes: totalWatched,
              progress_pct: totalEps > 0 ? Math.round((totalWatched / totalEps) * 100) : 0,
              last_watched_at: lastWatchedAt,
              created_at: now(),
              updated_at: now(),
            };
            db.insert(user_show_status).values(initPayload as any).run();
          }

          // 只对真实 Emby 条目更新计算出的 watchStatus，手动添加的条目保留其状态
          if (!String(embyId).startsWith('manual_tmdb_')) {
            db.update(shows).set({ status: watchStatus } as any).where(eq(shows.id, showId)).run();
          }
        } catch (epErr: any) {
          console.error(`[Sync] Error syncing show ${item.Name}:`, epErr.message);
        }
      }

      const lastLog = db.select().from(sync_log)
        .where(eq(sync_log.status, 'running')).get();
      if (lastLog) {
        db.update(sync_log).set({
          status: 'success',
          shows_synced: showsSynced,
          episodes_synced: episodesSynced,
          finished_at: now(),
        } as any).where(eq(sync_log.id, lastLog.id)).run();
      }

      console.log(`[Sync] Done: ${showsSynced} shows, ${episodesSynced} episodes`);
      return { showsSynced, episodesSynced };
    } catch (err: any) {
      const lastLog = db.select().from(sync_log)
        .where(eq(sync_log.status, 'running')).get();
      if (lastLog) {
        db.update(sync_log).set({
          status: 'error',
          error_message: err.message,
          finished_at: now(),
        } as any).where(eq(sync_log.id, lastLog.id)).run();
      }
      throw err;
    }
  }

  // 处理播放历史数据
  private processPlaybackHistory(playbackHistory: any) {
    const items = playbackHistory.Items || [];
    console.log(`[Sync] Processing ${items.length} playback history items`);

    for (const item of items) {
      try {
        // 只处理已播放的项目
        if (!item.UserData?.Played) continue;

        const embyId = item.Id;
        const datePlayed = item.DatePlayed || item.UserData?.LastPlayedDate;

        if (!datePlayed) continue;

        // 根据项目类型处理
        if (item.Type === 'Episode') {
          // 处理剧集
          const episode = db.select().from(episodes)
            .where(eq(episodes.emby_episode_id, embyId)).get();

          if (episode) {
            // 更新观看进度
            const existingProgress = db.select().from(watch_progress)
              .where(eq(watch_progress.episode_id, episode.id)).get();

            const progressPayload: any = {
              episode_id: episode.id,
              played_percentage: 100,
              position_ticks: 0,
              is_watched: true,
              watched_at: datePlayed,
              synced_at: now(),
            };

            if (existingProgress) {
              db.update(watch_progress).set(progressPayload)
                .where(eq(watch_progress.id, existingProgress.id)).run();
            } else {
              db.insert(watch_progress).values(progressPayload as any).run();
            }

            // 更新剧集的观看状态
            this.updateShowStatus(episode.show_id);
          }
        } else if (item.Type === 'Movie') {
          // 处理电影
          const show = db.select().from(shows)
            .where(eq(shows.emby_id, embyId)).get();

          if (show) {
            // 更新电影的观看状态
            const statusPayload: any = {
              show_id: show.id,
              watch_status: 'watched',
              total_watched_episodes: 1,
              progress_pct: 100,
              last_watched_at: datePlayed,
              updated_at: now(),
            };

            const existingStatus = db.select().from(user_show_status)
              .where(eq(user_show_status.show_id, show.id)).get();

            if (existingStatus) {
              db.update(user_show_status).set(statusPayload)
                .where(eq(user_show_status.id, existingStatus.id)).run();
            } else {
              statusPayload.created_at = now();
              db.insert(user_show_status).values(statusPayload as any).run();
            }

            db.update(shows).set({ status: 'watched' } as any)
              .where(eq(shows.id, show.id)).run();
          }
        }
      } catch (err: any) {
        console.error(`[Sync] Error processing playback history item:`, err.message);
      }
    }
  }

  // 更新剧集的观看状态
  private updateShowStatus(showId: number) {
    // 获取剧集的所有集数
    const allEpisodes = db.select().from(episodes)
      .where(eq(episodes.show_id, showId)).all();

    if (allEpisodes.length === 0) return;

    // 获取已观看的集数
    const watchedEpisodes = db.select().from(watch_progress)
      .where(
        and(
          eq(watch_progress.is_watched, true),
          inArray(
            watch_progress.episode_id,
            allEpisodes.map(ep => ep.id)
          )
        )
      ).all();

    const totalWatched = watchedEpisodes.length;
    const totalEps = allEpisodes.length;

    // 计算观看状态
    let watchStatus = 'plan';
    if (totalWatched > 0 && totalWatched < totalEps) watchStatus = 'watching';
    else if (totalEps > 0 && totalWatched >= totalEps) watchStatus = 'watched';

    // 更新状态
    const existingStatus = db.select().from(user_show_status)
      .where(eq(user_show_status.show_id, showId)).get();

    const statusPayload: any = {
      show_id: showId,
      watch_status: watchStatus,
      total_watched_episodes: totalWatched,
      progress_pct: totalEps > 0 ? Math.round((totalWatched / totalEps) * 100) : 0,
      updated_at: now(),
    };

    if (existingStatus) {
      db.update(user_show_status).set(statusPayload)
        .where(eq(user_show_status.id, existingStatus.id)).run();
    } else {
      statusPayload.created_at = now();
      statusPayload.current_season = 1;
      statusPayload.current_episode = 0;
      statusPayload.total_watch_minutes = 0;
      statusPayload.last_watched_at = null;
      db.insert(user_show_status).values(statusPayload as any).run();
    }

    // 更新 shows 表的状态
    db.update(shows).set({ status: watchStatus } as any)
      .where(eq(shows.id, showId)).run();
  }
}
