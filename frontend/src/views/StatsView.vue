<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import Milestones from '@/components/charts/Milestones.vue';
import WatchHeatmap from '@/components/charts/WatchHeatmap.vue';
import TimeDistChart from '@/components/charts/TimeDistChart.vue';
import GenreRadar from '@/components/charts/GenreRadar.vue';
import WatchTimeline from '@/components/WatchTimeline.vue';

const imageErrors = ref<Record<number, boolean>>({});

const filterYear = ref('');
const filterGenre = ref('');
const filterType = ref('');
const filterStatus = ref('');
const isTimelineOpen = ref(false);
const timelineShowId = ref<number | null>(null);

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

// 处理类型筛选选项，将英文转换为中文
const processedGenres = computed(() => {
  return stats.value.filterOptions.genres.map(genre => genreMap[genre] || genre);
});

function viewHistory(id: number) {
  timelineShowId.value = id;
  isTimelineOpen.value = true;
}

const stats = ref({
  totalShows: 0,
  watchingCount: 0,
  watchedCount: 0,
  planCount: 0,
  totalWatchedEpisodes: 0,
  totalWatchMinutes: 0,
  lastSyncAt: null as string | null,
  
  // 进阶数据
  heatmap: [] as { date: string; count: number }[],
  timeDist: [] as { hour: number; count: number }[],
  genres: [] as { genre: string; count: number }[],
  milestones: {
    bingeRecord: { date: '', count: 0, showNames: [] },
    abandonedCount: 0
  },
  filterOptions: { years: [] as string[], genres: [] as string[] }
});

const shows = ref<any[]>([]);
const loading = ref(true);

const filteredShows = computed(() => {
  return shows.value.filter(s => {
    if (filterType.value && s.media_type !== filterType.value) return false;
    const sStatus = s.status || s.watch_status || 'plan';
    if (filterStatus.value && sStatus !== filterStatus.value) return false;
    if (filterYear.value) {
      const y = s.first_air_date?.slice(0, 4) || s.release_date?.slice(0, 4);
      if (y !== filterYear.value) return false;
    }
    if (filterGenre.value) {
      if (!s.genres?.includes(filterGenre.value)) return false;
    }
    return true;
  });
});

async function fetchStats() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filterYear.value) params.append('year', filterYear.value);
    if (filterGenre.value) params.append('genre', filterGenre.value);
    if (filterType.value) params.append('type', filterType.value);
    if (filterStatus.value) params.append('status', filterStatus.value);
    
    const res = await fetch('/api/stats?' + params.toString());
    if (res.ok) {
      const data = await res.json();
      stats.value = { ...stats.value, ...data };
    }
  } catch {} finally { loading.value = false; }
}

onMounted(async () => {
  try {
    const sh = await fetch('/api/shows');
    if (sh.ok) shows.value = await sh.json();
  } catch {}
  await fetchStats();
});

watch([filterYear, filterGenre, filterType, filterStatus], async () => {
  try {
    const params = new URLSearchParams();
    if (filterYear.value) params.append('year', filterYear.value);
    if (filterGenre.value) params.append('genre', filterGenre.value);
    if (filterType.value) params.append('type', filterType.value);
    if (filterStatus.value) params.append('status', filterStatus.value);
    
    const sh = await fetch('/api/shows?' + params.toString());
    if (sh.ok) shows.value = await sh.json();
  } catch {}
  await fetchStats();
});

function statusLabel(s: string) {
  return { watching: '在看', watched: '已看', plan: '想看' }[s] || s;
}
function statusClass(s: string) {
  return {
    watching: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800',
    watched: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800',
    plan: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600',
  }[s] || '';
}
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- 页面标题 & 全局筛选 -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">数据统计概览</h1>
      <div class="flex flex-wrap items-center gap-3">
        <select v-model="filterYear" class="text-sm border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 focus:ring-blue-500 py-1.5 pl-3 pr-8 shadow-sm transition-shadow">
          <option value="">全部年份</option>
          <option v-for="y in stats.filterOptions.years" :key="y" :value="y">{{ y }}年</option>
        </select>
        <select v-model="filterGenre" class="text-sm border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 focus:ring-blue-500 py-1.5 pl-3 pr-8 shadow-sm transition-shadow">
          <option value="">全部类型</option>
          <option v-for="(cnGenre, index) in processedGenres" :key="index" :value="stats.filterOptions.genres[index]">{{ cnGenre }}</option>
        </select>
        <select v-model="filterType" class="text-sm border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 focus:ring-blue-500 py-1.5 pl-3 pr-8 shadow-sm transition-shadow">
          <option value="">全部类别</option>
          <option value="tv">剧集</option>
          <option value="movie">电影</option>
        </select>
        <select v-model="filterStatus" class="text-sm border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-900 focus:ring-blue-500 py-1.5 pl-3 pr-8 shadow-sm transition-shadow">
          <option value="">全部状态</option>
          <option value="watching">在看</option>
          <option value="watched">已看</option>
          <option value="plan">想看</option>
        </select>
      </div>
    </div>

    <!-- 顶部：趣味里程碑 -->
    <Milestones :stats="stats" />

    <!-- 基础概览统计卡片 -->
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <div v-for="card in [
        { label: '追剧总数', value: stats.totalShows, unit: '部', color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
        { label: '已看集数', value: stats.totalWatchedEpisodes, unit: '集', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
        { label: '总观看时长', value: Math.floor(stats.totalWatchMinutes / 60), unit: 'h', color: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10' },
        { label: '在看中', value: stats.watchingCount, unit: '部', color: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10' },
      ]" :key="card.label"
        class="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
        <div class="w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm" :class="card.color">
          <svg v-if="card.label === '追剧总数'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          <svg v-else-if="card.label === '已看集数'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <svg v-else-if="card.label === '总观看时长'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <svg v-else class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div>
          <div class="text-[36px] font-bold text-gray-900 dark:text-white leading-none">{{ card.value }}<span class="text-sm font-normal text-gray-400 ml-1">{{ card.unit }}</span></div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ card.label }}</div>
        </div>
      </div>
    </div>

    <!-- 进阶图表区 -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      
      <!-- 左侧主栏 (占2列) -->
      <div class="xl:col-span-2 space-y-6">
        <!-- 热力图 -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 class="text-base font-bold text-gray-900 dark:text-white mb-2">观影频率热力图</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">记录你过去一年的每一天</p>
          <WatchHeatmap :data="stats.heatmap" />
        </div>
        
        <!-- 生物钟波浪图 -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 class="text-base font-bold text-gray-900 dark:text-white mb-2">24小时生物钟</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">你最喜欢在什么时间段看剧？</p>
          <div class="h-[250px]">
            <TimeDistChart :data="stats.timeDist" />
          </div>
        </div>
      </div>

      <!-- 右侧副栏 (占1列) -->
      <div class="space-y-6">
        <!-- 偏好雷达 -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm h-full max-h-[400px]">
          <h3 class="text-base font-bold text-gray-900 dark:text-white mb-2">类型偏好雷达</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">基于你观看过的作品类型</p>
          <GenreRadar :data="stats.genres" />
        </div>
      </div>
      
    </div>

    <!-- 剧集记录归档表格 -->
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden mt-6">
      <div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
        <h3 class="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          归档详情 ({{ filteredShows.length }} 条)
        </h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-900/50 text-left text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              <th class="px-5 py-3 w-[48px] box-content">缩略图</th>
              <th class="px-5 py-3">剧名</th>
              <th class="px-5 py-3">类型</th>
              <th class="px-5 py-3">状态</th>
              <th class="px-5 py-3">完成度</th>
              <th class="px-5 py-3">最近观看</th>
              <th class="px-5 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50 dark:divide-gray-800">
            <tr v-for="show in filteredShows" :key="show.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
              <td class="px-5 py-3">
                <img v-if="show.poster_path && !imageErrors[show.id]" :src="show.poster_path" @error="imageErrors[show.id] = true" class="w-[48px] h-[72px] object-cover rounded-md shadow-sm" />
                <div v-else class="w-[48px] h-[72px] bg-gradient-to-br from-gray-800 to-black rounded-md shadow-sm flex items-center justify-center p-1 border border-gray-700">
                  <span class="text-[10px] text-white font-bold leading-tight break-all text-center">{{ show.title.slice(0, 6) }}</span>
                </div>
              </td>
              <td class="px-5 py-3 font-medium text-gray-900 dark:text-white">{{ show.title }}</td>
              <td class="px-5 py-3">
                <span class="px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {{ show.media_type === 'tv' ? '剧集' : '电影' }}
                </span>
              </td>
              <td class="px-5 py-3">
                <span class="px-2.5 py-1 rounded-md text-xs font-bold" :class="statusClass(show.status || show.watch_status || 'plan')">
                  {{ statusLabel(show.status || show.watch_status || 'plan') }}
                </span>
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                  <div class="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 rounded-full transition-all duration-500" :style="{ width: `${show.progress_pct || 0}%` }"></div>
                  </div>
                  <span class="text-xs text-gray-400 font-medium">{{ Math.round(show.progress_pct || 0) }}%</span>
                </div>
              </td>
              <td class="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">
                <span v-if="show.last_watched_at">{{ new Date(show.last_watched_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</span>
                <span v-else>—</span>
              </td>
              <td class="px-5 py-3 text-right">
                <button @click="viewHistory(show.id)" class="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors opacity-0 group-hover:opacity-100">
                  查看历程
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!filteredShows.length" class="text-center py-12 flex flex-col items-center justify-center">
          <svg class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
          <span class="text-gray-400 text-sm">没有找到匹配的归档记录</span>
        </div>
      </div>
    </div>

    <!-- 历程时间轴弹窗 -->
    <WatchTimeline :showId="timelineShowId" :isOpen="isTimelineOpen" @close="isTimelineOpen = false" />
  </div>
</template>
