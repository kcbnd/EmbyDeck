<script setup lang="ts">
import { ref, watch, computed } from 'vue';

const props = defineProps<{
  showId: number | null;
  isOpen: boolean;
}>();

const emit = defineEmits(['close']);

const history = ref<any[]>([]);
const loading = ref(false);

watch(() => props.isOpen, async (val) => {
  if (val && props.showId) {
    loading.value = true;
    try {
      const res = await fetch(`/api/shows/${props.showId}/history`);
      if (res.ok) {
        history.value = await res.json();
      }
    } finally {
      loading.value = false;
    }
  } else {
    history.value = [];
  }
});

const groupedHistory = computed(() => {
  const groups: Record<string, any[]> = {};
  history.value.forEach(item => {
    const d = new Date(item.watched_at).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    if (!groups[d]) groups[d] = [];
    groups[d].push(item);
  });
  return Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0]));
});

</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex justify-end">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>
      
      <!-- Drawer -->
      <div class="relative w-full max-w-md bg-white dark:bg-gray-900 h-full shadow-2xl overflow-hidden flex flex-col transform transition-transform">
        <div class="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            观看历程
          </h2>
          <button @click="$emit('close')" class="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div class="flex-1 overflow-y-auto p-6 scrollbar-hide bg-gray-50/50 dark:bg-gray-900">
          <div v-if="loading" class="flex justify-center py-10">
            <svg class="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          </div>
          <div v-else-if="groupedHistory.length" class="relative pl-3">
            <div class="absolute inset-y-0 left-4 w-px bg-gray-200 dark:bg-gray-700"></div>
            
            <div v-for="[date, items] in groupedHistory" :key="date" class="mb-8 relative">
              <div class="flex items-center mb-3">
                <div class="absolute -left-[21px] w-3 h-3 bg-white dark:bg-gray-900 border-2 border-blue-500 rounded-full"></div>
                <div class="font-semibold text-sm text-gray-900 dark:text-white ml-5">{{ date }}</div>
              </div>
              <div class="ml-5 space-y-3">
                <div v-for="item in items" :key="item.id" 
                  class="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-500 font-bold flex flex-col items-center justify-center shrink-0 text-xs">
                    <span v-if="item.season_number && item.episode_number">E{{ item.episode_number }}</span>
                    <span v-else>✅</span>
                  </div>
                  <div>
                    <div class="text-sm font-medium text-gray-900 dark:text-white">{{ item.name || '标记为看完' }}</div>
                    <div class="text-xs text-gray-500 mt-0.5">于 {{ new Date(item.watched_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }} 观看完成</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-20 text-gray-400 text-sm">
            暂无观看记录
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
