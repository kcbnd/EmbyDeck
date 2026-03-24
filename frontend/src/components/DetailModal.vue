<script setup lang="ts">
import { ref, watch, computed } from 'vue';

const props = defineProps<{ show: boolean; item: any }>();
const emit = defineEmits<{ close: [], deleted: [] }>();

const detail = ref<any>(null);
const activeSeason = ref(0);
const loading = ref(false);
const toggling = ref<number | null>(null);
const markingAll = ref(false);
const togglingMovie = ref(false);
const posterError = ref(false);
const backdropError = ref(false);

watch(() => props.show, async (val) => {
  if (val && props.item) {
    loading.value = true;
    try {
      const res = await fetch(`/api/shows/${props.item.id}`);
      if (res.ok) {
        detail.value = await res.json();
      } else {
        throw new Error('API request failed');
      }
    } catch {
      // API 失败时使用基础 prop 数据
      detail.value = { ...props.item, seasons: [], episodes: [] };
    } finally { 
      loading.value = false;
      // 默认选中第一季
      if (detail.value?.seasons?.length > 0) {
        const s1 = detail.value.seasons.find((s:any) => s.season_number === 1);
        activeSeason.value = s1 ? s1.id : detail.value.seasons[0].id;
      }
    }
  } else if (!val) {
    setTimeout(() => { detail.value = null; }, 300);
  }
});

const currentSeasonEpisodes = computed(() => {
  if (!detail.value || !detail.value.episodes) return [];
  return detail.value.episodes.filter((ep: any) => ep.season_id === activeSeason.value);
});

async function toggleEpisode(ep: any) {
  toggling.value = ep.id;
  try {
    const res = await fetch(`/api/episodes/${ep.id}/toggle`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      ep.is_watched = data.is_watched;
      ep.played_percentage = data.is_watched ? 100 : 0;
      // 重新拉取 user_status 刷新进度条和百分比
      if (props.item?.id) {
        const r2 = await fetch(`/api/shows/${props.item.id}`);
        if (r2.ok) {
          const updated = await r2.json();
          if (detail.value) detail.value.user_status = updated.user_status;
          // 同步角标状态（由进度自动推导）
          if (props.item && updated.user_status?.watch_status) {
            props.item.status = updated.user_status.watch_status;
          }
        }
      }
    } else {
      ep.is_watched = !ep.is_watched;
    }
  } catch {
    ep.is_watched = !ep.is_watched;
  } finally { toggling.value = null; }
}

async function changeStatus(status: string) {
  if (!props.item) return;
  try {
    await fetch(`/api/shows/${props.item.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watch_status: status }),
    });
    if (detail.value?.user_status) detail.value.user_status.watch_status = status;
    props.item.status = status;
  } catch {}
}

async function markAllWatched() {
  if (!props.item?.id || markingAll.value) return;
  markingAll.value = true;
  // 判断当前季所有集是否已全部看完
  const allWatched = currentSeasonEpisodes.value.length > 0 &&
    currentSeasonEpisodes.value.every((e: any) => e.is_watched);
  const newWatched = !allWatched;
  try {
    const res = await fetch(`/api/shows/${props.item.id}/mark-all-watched`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watched: newWatched, season_id: activeSeason.value }),
    });
    if (res.ok) {
      if (detail.value?.episodes) {
        for (const ep of detail.value.episodes) {
          if (ep.season_id === activeSeason.value) {
            ep.is_watched = newWatched;
            ep.played_percentage = newWatched ? 100 : 0;
          }
        }
      }
      const r2 = await fetch(`/api/shows/${props.item.id}`);
      if (r2.ok) { 
        const u = await r2.json(); 
        if (detail.value) detail.value.user_status = u.user_status;
        if (props.item && u.user_status?.watch_status) {
          props.item.status = u.user_status.watch_status;
        }
      }
    }
  } finally { markingAll.value = false; }
}

async function toggleMovieWatched() {
  if (!props.item?.id || togglingMovie.value) return;
  togglingMovie.value = true;
  try {
    const currentPct = detail.value?.user_status?.progress_pct || 0;
    const newPct = currentPct >= 100 ? 0 : 100;
    const newStatus = newPct >= 100 ? 'watched' : 'plan';
    await fetch(`/api/shows/${props.item.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watch_status: newStatus, progress_pct: newPct }),
    });
    if (detail.value) {
      if (!detail.value.user_status) detail.value.user_status = {};
      detail.value.user_status.progress_pct = newPct;
      detail.value.user_status.watch_status = newStatus;
    }
    props.item.status = newStatus;
    props.item.progress_pct = newPct;
  } finally { togglingMovie.value = false; }
}

// 类型名称映射：英文转中文
const genreMap: Record<string, string> = {
  'Action': '动作',
  'Adventure': '冒险',
  'Animation': '动画',
  'Comedy': '喜剧',
  'Crime': '犯罪',
  'Documentary': '纪录片',
  'Drama': '剧情',
  'Family': '家庭',
  'Fantasy': '奇幻',
  'History': '历史',
  'Horror': '恐怖',
  'Music': '音乐',
  'Mystery': '悬疑',
  'Romance': '爱情',
  'Science Fiction': '科幻',
  'Sci-Fi & Fantasy': '科幻 & 奇幻',
  'Thriller': '惊悚',
  'War': '战争',
  'Western': '西部'
};

// 解析 genres 字段：支持 JSON 数组字符串、逗号分割字符串、对象数组、字符串数组
const parsedGenres = computed(() => {
  const g = detail.value?.genres || props.item?.genres;
  if (!g) return [];
  if (Array.isArray(g)) return g.map((x: any) => genreMap[typeof x === 'object' ? x.name : String(x)] || (typeof x === 'object' ? x.name : String(x)));
  if (typeof g === 'string') {
    const s = g.trim();
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        return arr.map((x: any) => genreMap[typeof x === 'object' ? x.name : String(x)] || (typeof x === 'object' ? x.name : String(x)));
      } catch {}
    }
    return s.split(',').map((x: string) => genreMap[x.trim()] || x.trim()).filter(Boolean);
  }
  return [];
});

async function deleteShow() {
  if (!props.item) return;
  if (!confirm(`确定要从列表中删除「${props.item.title}」吗？此操作不可撤销。`)) return;
  try {
    const res = await fetch(`/api/shows/${props.item.id}`, { method: 'DELETE' });
    if (res.ok) { emit('deleted'); emit('close'); }
  } catch {}
}
</script>

<template>
  <Teleport to="body">
    <!-- 独立背景遮罩 -->
    <transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="show" class="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm" @click="emit('close')"></div>
    </transition>

    <!-- 独立主体内容容器 -->
    <transition
      enter-active-class="transition duration-300 ease-out origin-center"
      enter-from-class="opacity-0 scale-95 translate-y-4"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in origin-center"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-4"
    >
      <div v-if="show" class="fixed inset-0 z-[101] flex items-center justify-center p-4 min-h-screen pointer-events-none">
        <div class="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col relative max-h-[85vh] pointer-events-auto" @click.stop>
          
          <!-- 关闭按钮 -->
          <button @click="emit('close')" class="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 dark:bg-gray-800 text-white hover:bg-black/40 dark:hover:bg-gray-700 transition-colors">✕</button>

          <div v-if="loading" class="flex-1 flex items-center justify-center py-32 text-gray-400">
            <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>

          <div v-else-if="detail" class="flex-1 overflow-y-auto scrollbar-thin">
            <!-- 上半部分布局 -->
            <div class="flex flex-col sm:flex-row p-6 gap-6 border-b border-gray-100 dark:border-gray-800">
              <!-- 左侧 1/3: 海报 -->
              <div class="w-full sm:w-1/3 shrink-0 flex flex-col gap-4">
                <div class="aspect-[2/3] bg-gray-200 dark:bg-gray-800 rounded-[12px] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-gray-100 dark:border-gray-700">
                  <img v-if="detail.backdrop_path && !detail.poster_path && !backdropError" @error="backdropError = true" :src="detail.backdrop_path" class="w-full h-full object-cover" />
                  <img v-else-if="detail.poster_path && !posterError" @error="posterError = true" :src="detail.poster_path" class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-black text-white p-4 text-center font-bold shadow-inner flex-col">
                    <span class="text-3xl mb-2 opacity-50">🍿</span>
                    <span class="text-lg leading-tight">{{ detail.title }}</span>
                  </div>
                </div>

                <div class="flex flex-col gap-3">
                  <!-- 大字号评分等 -->
                  <div class="flex items-end gap-3 px-1">
                    <div v-if="detail.vote_average || (props.item && props.item.vote_average)" class="flex items-baseline gap-1">
                      <span class="text-2xl font-bold text-gray-900 dark:text-white leading-none">{{ (detail.vote_average || props.item?.vote_average)?.toFixed(1) }}</span>
                      <span class="text-sm font-medium text-gray-500 dark:text-gray-400">分</span>
                    </div>
                    <div class="flex flex-col gap-0.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
                      <span v-if="detail.first_air_date || (props.item && props.item.first_air_date)">
                        {{ detail.media_type === 'movie' ? '上映' : '首播' }} {{ (detail.first_air_date || props.item?.first_air_date)?.slice(0, 4) }}
                      </span>
                      <span v-if="detail.media_type !== 'movie'">
                        共 {{ detail.total_seasons || detail.seasons?.length || 0 }} 季
                      </span>
                      <span v-else-if="detail.runtime || props.item?.runtime">
                        时长 {{ detail.runtime || props.item?.runtime }} 分钟
                      </span>
                    </div>
                  </div>
                  <!-- 类型标签蓝色胶囊 -->
                  <div v-if="parsedGenres.length" class="flex flex-wrap gap-1.5 px-1">
                    <span v-for="(g, i) in parsedGenres" :key="i"
                      class="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 rounded-full font-medium">
                      {{ g }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- 右侧 2/3: 信息 -->
              <div class="w-full sm:w-2/3 flex flex-col min-w-0">
                <h2 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 break-words">{{ detail.title }}</h2>
                <div v-if="detail.title_original" class="text-sm font-medium text-gray-400 dark:text-gray-500 mb-4">{{ detail.title_original }}</div>
                <div v-else class="mb-4"></div>

                <div class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6 flex-1 overflow-y-auto pr-2 scrollbar-thin line-clamp-4">
                  {{ detail.overview || '暂无简介' }}
                </div>

                <!-- 状态与进度 -->
                <div class="shrink-0 mt-auto">
                  <div class="flex gap-2 mb-4 items-center">
                    <button v-for="s in [{ val: 'plan', label: '想看' }, { val: 'watching', label: '在看' }, { val: 'watched', label: '已看' }]"
                      :key="s.val" @click="changeStatus(s.val)"
                      class="px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors shadow-sm"
                      :class="(detail.user_status?.watch_status || detail.status) === s.val
                        ? 'bg-blue-500 border-blue-500 text-white shadow-blue-500/30'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-500 dark:hover:text-blue-400'">
                      {{ s.label }}
                    </button>
                    <!-- 删除按钮 -->
                    <button @click="deleteShow" title="从列表删除"
                      class="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-500/20">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div class="bg-gray-50 dark:bg-gray-800/80 rounded-[12px] p-4 border border-gray-100 dark:border-gray-700 shadow-inner">
                    <!-- 电影：点击进度条直接切换已看/未看 -->
                    <template v-if="detail.media_type === 'movie'">
                      <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
                        <span>观看进度</span>
                        <span class="font-bold" :class="(detail.user_status?.progress_pct || 0) >= 100 ? 'text-emerald-500' : 'text-blue-500'">
                          {{ Math.round(detail.user_status?.progress_pct || 0) }}%
                        </span>
                      </div>
                      <div class="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner mb-3 cursor-pointer group" title="点击切换已看/未看" @click="toggleMovieWatched">
                        <div class="h-full rounded-full transition-all duration-500 group-hover:brightness-110"
                          :class="(detail.user_status?.progress_pct || 0) >= 100 ? 'bg-emerald-500' : 'bg-blue-500'"
                          :style="{ width: `${detail.user_status?.progress_pct || 0}%` }"></div>
                      </div>
                      <button @click="toggleMovieWatched" :disabled="togglingMovie"
                        class="w-full py-1.5 rounded-lg text-xs font-medium border transition-colors"
                        :class="(detail.user_status?.progress_pct || 0) >= 100
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
                          : 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-700 dark:text-blue-400 hover:bg-blue-100'">
                        {{ togglingMovie ? '更新中...' : (detail.user_status?.progress_pct || 0) >= 100 ? '✓ 已看完  （点击取消）' : '标记为已看完' }}
                      </button>
                    </template>
                    <!-- 剧集：显示已看集数进度 -->
                    <template v-else>
                      <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
                        <span>总观看进度</span>
                        <span class="text-blue-600 dark:text-blue-400 font-bold">{{ Math.round(detail.user_status?.progress_pct || detail.progress_pct || 0) }}%</span>
                      </div>
                      <div class="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner mb-2.5">
                        <div class="h-full bg-blue-500 rounded-full transition-all duration-500" :style="{ width: `${detail.user_status?.progress_pct || detail.progress_pct || 0}%` }"></div>
                      </div>
                      <div class="text-[11px] text-gray-500 dark:text-gray-400 font-medium flex gap-1.5 items-center">
                        <span>已看 {{ detail.episodes?.filter((e:any) => e.is_watched).length || 0 }} 集</span>
                        <span>·</span>
                        <span>共 {{ detail.total_episodes || detail.episodes?.length || 0 }} 集</span>
                        <span v-if="detail.total_watch_minutes || props.item?.total_watch_minutes">·</span>
                        <span v-if="detail.total_watch_minutes || props.item?.total_watch_minutes">累计 {{ Math.floor((detail.total_watch_minutes || props.item?.total_watch_minutes || 0) / 60) }}h</span>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <!-- 下半部分：Tab 与 列表 -->
            <div v-if="detail.media_type !== 'movie'" class="px-6 pt-4 sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur z-10 border-b border-gray-100 dark:border-gray-800 shadow-sm flex flex-col gap-2">
              <div class="flex gap-6 overflow-x-auto scrollbar-hide">
                <button v-for="s in detail.seasons" :key="s.id"
                  @click="activeSeason = s.id"
                  class="pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap"
                  :class="activeSeason === s.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'">
                  {{ s.name || `第 ${s.season_number} 季` }}
                </button>
              </div>
            </div>

            <div v-if="detail.media_type !== 'movie'" class="p-6 pt-4 pb-8 bg-gray-50/50 dark:bg-gray-900/50 min-h-[200px]">
              <template v-if="currentSeasonEpisodes.length">
                <div class="flex items-center justify-between mb-4 px-2">
                  <span class="text-sm font-medium text-gray-600 dark:text-gray-400">
                    已看 {{ currentSeasonEpisodes.filter((e: any) => e.is_watched).length }} / {{ currentSeasonEpisodes.length }} 集
                  </span>
                  <button @click="markAllWatched" :disabled="markingAll"
                    class="text-xs px-3 py-1 rounded-full border transition-colors font-medium disabled:opacity-50 flex items-center gap-1"
                    :class="currentSeasonEpisodes.every((e: any) => e.is_watched) && currentSeasonEpisodes.length > 0
                      ? 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                      : 'border-emerald-200 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    {{ markingAll ? '标记中...' : (currentSeasonEpisodes.every((e: any) => e.is_watched) && currentSeasonEpisodes.length > 0 ? '取消全看完' : '全部已看') }}
                  </button>
                </div>
                <div v-for="ep in currentSeasonEpisodes" :key="ep.id"
                  class="group flex items-center justify-between py-4 px-4 -mx-4 hover:bg-white dark:hover:bg-gray-800 rounded-[12px] transition-all cursor-pointer hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
                  :class="ep.is_watched ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : ''"
                  @click="toggleEpisode(ep)">
                  <div class="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <span class="text-sm font-medium text-gray-400 dark:text-gray-500 shrink-0 w-8 font-mono">E{{ String(ep.episode_number).padStart(2, '0') }}</span>
                    <span class="text-sm font-medium truncate transition-colors flex-1"
                      :class="ep.is_watched ? 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400' : 'text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'">
                      {{ ep.title || `第 ${ep.episode_number} 集` }}
                    </span>
                  </div>
                  <div class="flex items-center gap-4 shrink-0 ml-2 sm:ml-4">
                    <span v-if="ep.runtime_minutes" class="text-xs text-gray-400 font-medium hidden sm:inline-block">{{ ep.runtime_minutes }} 分钟</span>
                    <div v-if="toggling === ep.id" class="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <!-- 绿色勾=已看，空心圆=未看 -->
                    <div v-else class="w-6 h-6 rounded-full flex items-center justify-center border transition-colors shadow-sm"
                      :class="ep.is_watched ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 group-hover:border-blue-400 dark:group-hover:border-blue-500'">
                      <svg v-if="ep.is_watched" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </template>
              <div v-else class="py-16 flex flex-col items-center justify-center text-gray-400 text-sm">
                <span class="text-3xl mb-3 opacity-50">📂</span>
                暂无分集数据
              </div>
            </div>

          </div>
          
          <div v-else class="flex-1 flex flex-col items-center justify-center py-32 text-gray-400 text-sm">
            <span class="text-4xl mb-4 opacity-50">⚠</span>
            暂无数据
          </div>

        </div>
      </div>
    </transition>
  </Teleport>
</template>
