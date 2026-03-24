<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  item: {
    id: number;
    title: string;
    poster_path?: string;
    status?: string;
    progress_pct?: number;
    current_season?: number | null;
    current_episode?: number | null;
    vote_average?: number;
    first_air_date?: string;
    media_type?: string;
  };
}>();

const emit = defineEmits<{ click: [MouseEvent] }>();

const badgeText = computed(() => {
  if (props.item.media_type === 'movie') return '电影';
  if (props.item.status === 'watched') return '已看过';
  if (props.item.status === 'watching') return '在看中';
  return '想看';
});

const badgeClass = computed(() => {
  if (props.item.media_type === 'movie') return 'bg-purple-500 text-white';
  if (props.item.status === 'watched') return 'bg-emerald-500 text-white';
  if (props.item.status === 'watching') return 'bg-blue-500 text-white';
  return 'bg-gray-400 text-white';
});

const epLabel = computed(() => {
  if (props.item.media_type === 'movie') return null;
  const s = props.item.current_season;
  const e = props.item.current_episode;
  if (!s || !e) return null; // 季/集为 null 或 0 时不显示
  return `S${String(s).padStart(2,'0')}E${String(e).padStart(2,'0')}`;
});

const imageError = ref(false);

const placeholderStyle = computed(() => {
  let hash = 0;
  const title = props.item.title || '';
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue}, 60%, 50%), hsl(${(hue + 40) % 360}, 70%, 30%))`
  };
});
</script>

<template>
  <div
    class="relative group rounded-[12px] overflow-hidden cursor-pointer bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 shadow-[0_2px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-200 ease-in-out hover:-translate-y-1"
    @click="(e) => emit('click', e)">
    <!-- 海报 2:3 -->
    <div class="aspect-[2/3] bg-gray-200 dark:bg-gray-700">
      <img v-if="item.poster_path && !imageError"
        :src="item.poster_path" :alt="item.title"
        @error="imageError = true"
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        loading="lazy" />
      <div v-else :style="placeholderStyle" class="w-full h-full flex items-center justify-center text-white p-4 text-center font-bold text-lg shadow-inner">
        {{ item.title }}
      </div>
    </div>

    <!-- 状态角标 -->
    <div class="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-medium shadow-sm backdrop-blur-sm bg-opacity-90 dark:bg-opacity-90 z-10" :class="badgeClass">
      {{ badgeText }}
    </div>

    <!-- 底部渐变 -->
    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3 pt-14 flex flex-col justify-end z-10">
      <!-- 第一行：剧名 -->
      <h3 class="text-white font-bold text-sm truncate drop-shadow-md mb-1">{{ item.title }}</h3>
      
      <!-- 第二行：评分 + 年份 -->
      <div class="flex items-center gap-2 text-[11px] text-white/80 font-medium mb-1 drop-shadow-sm">
        <span v-if="item.vote_average" class="flex items-center gap-0.5 text-yellow-400"><span class="text-[10px]">⭐</span> {{ item.vote_average.toFixed(1) }}</span>
        <span v-if="item.first_air_date">{{ item.first_air_date.slice(0, 4) }}</span>
      </div>

      <!-- 第三行：进度 (仅在看/已看) -->
      <div v-if="item.status !== 'plan' && item.progress_pct !== undefined" class="text-[11px] text-white/70 font-medium mb-1.5 drop-shadow-sm">
        <template v-if="epLabel">{{ epLabel }} · </template>{{ Math.round(item.progress_pct || 0) }}%
      </div>
      
      <!-- 进度条贴边（所有卡片都渲染，progress=0 时透明若隐若现） -->
      <div class="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
        <div class="h-full rounded-r-full transition-all duration-700"
          :style="{ width: `${item.progress_pct || 0}%`, opacity: (item.progress_pct || 0) > 0 ? 1 : 0,
          background: item.status === 'watched' ? '#10b981' : '#3b82f6' }"
        ></div>
      </div>
    </div>
  </div>
</template>
