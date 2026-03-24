<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  stats: any;
}>();

const bingeRecord = computed(() => props.stats?.milestones?.bingeRecord);
const totalTimeStr = computed(() => {
  const mins = props.stats?.totalWatchMinutes || 0;
  if (mins === 0) return '';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `累计观影 ${hours} 小时`;
  const days = Math.floor(hours / 24);
  return `总观影 ${hours} 小时，也就是整整 ${days} 天 ${hours % 24} 小时`;
});

const abandoned = computed(() => props.stats?.milestones?.abandonedCount || 0);

</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
    <!-- 时间转化里程碑 -->
    <div class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[16px] p-5 text-white shadow-md relative overflow-hidden group">
      <div class="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
      <div class="flex items-center gap-3 mb-2">
        <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">⏳</div>
        <h3 class="font-bold text-sm text-indigo-100">时间见证者</h3>
      </div>
      <div v-if="stats?.totalWatchMinutes > 0">
        <div class="text-xl font-extrabold mb-1 drop-shadow-sm">{{ totalTimeStr }}</div>
        <div class="text-xs text-indigo-200/80">在这段时光里，你体验了无数段截然不同的人生。</div>
      </div>
      <div v-else class="text-sm font-medium mt-2">
        旅程才刚刚开始，去发现第一部让你心动的作品吧。
      </div>
    </div>

    <!-- 沉迷记录 -->
    <div class="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[16px] p-5 text-white shadow-md relative overflow-hidden group">
      <div class="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
      <div class="flex items-center gap-3 mb-2">
        <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">🔥</div>
        <h3 class="font-bold text-sm text-emerald-100">Binge Record</h3>
      </div>
      <div v-if="bingeRecord?.count > 0">
        <div class="text-[17px] font-bold mb-1 drop-shadow-sm leading-snug">
          在 {{ bingeRecord.date }} 这天，<br/>你一口气肝了 <span class="text-2xl font-black text-yellow-300 mx-1">{{ bingeRecord.count }}</span> 集！
        </div>
        <div class="text-[11px] text-emerald-100/90 truncate mt-1.5" :title="bingeRecord.showNames.join(', ')">
          主要是为了看: {{ bingeRecord.showNames.join(', ') || '某部神秘佳作' }}
        </div>
      </div>
      <div v-else class="text-sm font-medium mt-2">
        还没找到那部让你通宵达旦、欲罢不能的剧？
      </div>
    </div>

    <!-- 弃剧雷达 / 专注度 -->
    <div class="bg-gradient-to-br from-rose-500 to-orange-500 rounded-[16px] p-5 text-white shadow-md relative overflow-hidden group">
      <div class="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
      <div class="flex items-center gap-3 mb-2">
        <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">🍂</div>
        <h3 class="font-bold text-sm text-rose-100">专注与搁置</h3>
      </div>
      <div v-if="abandoned > 0">
        <div class="text-[17px] font-bold mb-1 drop-shadow-sm leading-snug">
          有 <span class="text-2xl font-black text-rose-200 mx-1">{{ abandoned }}</span> 部剧被你打入冷宫
        </div>
        <div class="text-[11px] text-rose-100/90 mt-1.5">
          它们已经超过 3 个月没有更新进度了。<br/>是时候决定是继续看，还是直接标记弃剧了。
        </div>
      </div>
      <div v-else-if="stats?.watchingCount > 0" class="text-sm font-medium mt-2 leading-relaxed">
        你的追剧非常专注！<br/>目前在看的 <span class="font-bold">{{ stats.watchingCount }}</span> 部剧都在积极推进中，没有半途而废。
      </div>
      <div v-else class="text-sm font-medium mt-2">
        目前没有正在追的剧集。
      </div>
    </div>
  </div>
</template>
