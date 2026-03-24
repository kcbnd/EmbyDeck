<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';

const emit = defineEmits<{ close: [], added: [] }>();

const query = ref('');
const currentType = ref('all'); // all, tv, movie
const results = ref<any[]>([]);
const loading = ref(false);
const searched = ref(false);
const adding = ref<number | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);

const addedTmdbIds = ref(new Set<string>());

async function loadAdded() {
  try {
    const res = await fetch('/api/shows');
    if (res.ok) {
      const list = await res.json();
      addedTmdbIds.value = new Set(list.map((s: any) => String(s.tmdb_id)).filter(Boolean));
    }
  } catch {}
}

onMounted(() => {
  nextTick(() => searchInput.value?.focus());
  loadAdded();
});

async function handleSearch() {
  if (!query.value.trim()) return;
  loading.value = true;
  searched.value = true;
  try {
    const res = await fetch(`/api/shows/search?q=${encodeURIComponent(query.value)}&type=${currentType.value}`);
    if (res.ok) {
      const data: any[] = await res.json();
      // merge already_added from local set for items not in DB compare response
      results.value = data.map(r => ({ ...r, already_added: r.already_added || addedTmdbIds.value.has(String(r.tmdb_id)) }));
    } else {
      results.value = [];
    }
  } catch {
    results.value = [];
  } finally {
    loading.value = false;
  }
}

async function handleAdd(item: any) {
  if (item.already_added || adding.value) return;
  adding.value = item.tmdb_id;
  try {
    const res = await fetch('/api/shows/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tmdb_id: item.tmdb_id, media_type: item.media_type })
    });
    if (res.ok) {
      item.already_added = true;
      addedTmdbIds.value.add(String(item.tmdb_id));
      emit('added');
    }
  } catch (e) {
    console.error('Failed to add show', e);
  } finally {
    adding.value = null;
  }
}

// Fallback background style function for blank posters
function getPlaceholderStyle(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue}, 60%, 50%), hsl(${(hue + 40) % 360}, 70%, 30%))`
  };
}
</script>

<template>
  <Teleport to="body">
    <!-- 背景遮罩 -->
    <transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div class="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm" @click="emit('close')"></div>
    </transition>

    <!-- 弹窗主体 -->
    <transition
      enter-active-class="transition duration-300 ease-out origin-center"
      enter-from-class="opacity-0 scale-95 translate-y-4"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in origin-center"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-4"
    >
      <div class="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
        <div class="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-[12px] shadow-[0_4px_24px_rgba(0,0,0,0.15)] flex flex-col relative max-h-[80vh] pointer-events-auto" @click.stop>
          
          <!-- 关闭按钮 -->
          <button @click="emit('close')" class="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">✕</button>

          <!-- 顶部搜索框 -->
          <div class="p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">搜索并添加影视</h2>
            
            <!-- Tabs -->
            <div class="flex gap-2 mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
              <button v-for="t in [{label:'全部',value:'all'},{label:'电视剧',value:'tv'},{label:'电影',value:'movie'}]" :key="t.value"
                @click="currentType = t.value; if(query.trim()) handleSearch()"
                class="px-4 py-1.5 text-sm font-medium rounded-md transition-all"
                :class="currentType === t.value ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'">
                {{ t.label }}
              </button>
            </div>

            <div class="flex gap-3">
              <input ref="searchInput" v-model="query" @keyup.enter="handleSearch" type="text" placeholder="输入 TMDB 剧集/电影名称..."
                class="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[12px] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:text-white transition-all shadow-inner" />
              <button @click="handleSearch" :disabled="loading" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-[12px] font-medium text-sm transition-colors shadow-sm flex items-center justify-center min-w-[80px]">
                <div v-if="loading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span v-else>搜索</span>
              </button>
            </div>
          </div>

          <!-- 搜索结果列表 -->
          <div class="flex-1 overflow-y-auto p-2 sm:p-4 bg-gray-50/50 dark:bg-gray-900/50 scrollbar-thin">
            <div v-if="loading && results.length === 0" class="py-20 flex flex-col items-center justify-center text-gray-400">
              <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p class="text-sm">正在检索 TMDB 数据库...</p>
            </div>
            
            <div v-else-if="searched && results.length === 0" class="py-20 flex flex-col items-center justify-center text-gray-400">
              <svg class="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <p class="text-base font-medium text-gray-500 dark:text-gray-400">没有找到相关影视</p>
              <p class="text-[13px] mt-1.5 text-gray-400 dark:text-gray-500">试试其他关键词，或切换电视剧/电影分类搜索</p>
            </div>

            <div v-else class="flex flex-col gap-2">
              <div v-for="item in results" :key="item.tmdb_id" class="flex gap-4 p-3 bg-white dark:bg-gray-800 rounded-[12px] border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-500/30 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all">
                <!-- 海报缩略图 -->
                <div class="w-[60px] h-[90px] shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600">
                  <img v-if="item.poster_path" :src="item.poster_path" class="w-full h-full object-cover" loading="lazy" />
                  <div v-else :style="getPlaceholderStyle(item.title)" class="w-full h-full flex items-center justify-center p-1 text-center text-[10px] font-bold text-white shadow-inner break-words leading-tight">
                    {{ item.title.slice(0, 6) }}
                  </div>
                </div>

                <!-- 信息区 -->
                <div class="flex-1 flex flex-col justify-center min-w-0 py-1">
                  <div class="flex items-center gap-2 mb-1 border-b-0">
                    <span class="text-[10px] px-1.5 py-0.5 rounded font-bold shadow-sm shrink-0"
                      :class="item.media_type === 'movie' ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20'">
                      {{ item.media_type === 'movie' ? '电影' : '剧集' }}
                    </span>
                    <h3 class="font-bold text-gray-900 dark:text-white text-base truncate">{{ item.title }}</h3>
                    <span v-if="item.vote_average" class="text-[11px] px-1.5 py-0.5 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 rounded font-bold shadow-sm border border-yellow-100/50 dark:border-yellow-500/20 shrink-0">⭐ {{ item.vote_average.toFixed(1) }}</span>
                  </div>
                  <div class="text-[11px] text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-2 truncate">
                    <span v-if="item.original_name && item.original_name !== item.title" class="truncate">{{ item.original_name }}</span>
                    <span v-if="item.original_name && item.original_name !== item.title && item.first_air_date">·</span>
                    <span v-if="item.first_air_date" class="shrink-0 font-medium">{{ item.first_air_date.slice(0, 4) }} 年首播</span>
                  </div>
                  <p class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed flex-1">{{ item.overview || '暂无简介' }}</p>
                </div>

                <!-- 按钮区 -->
                <div class="shrink-0 flex items-center justify-center pl-2">
                  <button v-if="item.already_added" disabled class="px-4 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 text-xs font-medium rounded-full cursor-not-allowed">已添加</button>
                  <button v-else @click="handleAdd(item)" :disabled="adding === item.tmdb_id" class="px-4 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 font-medium text-xs rounded-full transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50">
                    <div v-if="adding === item.tmdb_id" class="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <svg v-else class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                    添加
                  </button>
                </div>
              </div>
            </div>
            
          </div>

        </div>
      </div>
    </transition>
  </Teleport>
</template>
