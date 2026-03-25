<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';

interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
  context?: any;
  stack?: string;
}

const logs = ref<LogEntry[]>([]);
const loading = ref(false);
const autoScroll = ref(true);
const logContainer = ref<HTMLElement | null>(null);
const levelFilter = ref<string>('all');
const moduleFilter = ref<string>('all');

const levelOptions = [
  { value: 'all', label: '全部' },
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warn' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' },
];

const moduleOptions = [
  { value: 'all', label: '全部' },
  { value: 'Emby_Webhook', label: 'Emby_Webhook' },
  { value: 'Cron_Sync', label: 'Cron_Sync' },
  { value: 'TMDB_API', label: 'TMDB_API' },
  { value: 'DB_Engine', label: 'DB_Engine' },
  { value: 'Settings', label: 'Settings' },
  { value: 'API', label: 'API' },
];

let refreshInterval: number | null = null;

async function fetchLogs() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.append('limit', '200');
    if (levelFilter.value !== 'all') params.append('level', levelFilter.value);
    
    const res = await fetch(`/api/logs?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      logs.value = data.logs || [];
    }
  } catch (e: any) {
    console.error('Failed to fetch logs:', e);
  } finally {
    loading.value = false;
  }
}

function scrollToBottom() {
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
}

function getLevelClass(level: string): string {
  switch (level) {
    case 'error': return 'text-red-400';
    case 'warn': return 'text-yellow-400';
    case 'info': return 'text-green-400';
    case 'debug': return 'text-blue-400';
    default: return 'text-gray-400';
  }
}

function getModuleBadgeClass(module: string): string {
  const colors: Record<string, string> = {
    'Emby_Webhook': 'bg-purple-600 text-purple-100',
    'Cron_Sync': 'bg-blue-600 text-blue-100',
    'TMDB_API': 'bg-orange-600 text-orange-100',
    'DB_Engine': 'bg-green-600 text-green-100',
    'Settings': 'bg-pink-600 text-pink-100',
    'API': 'bg-indigo-600 text-indigo-100',
  };
  return colors[module] || 'bg-gray-600 text-gray-100';
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  } catch {
    return timestamp;
  }
}

const filteredLogs = ref<LogEntry[]>([]);

function applyFilters() {
  let result = logs.value;
  
  if (levelFilter.value !== 'all') {
    result = result.filter(log => log.level === levelFilter.value);
  }
  
  if (moduleFilter.value !== 'all') {
    result = result.filter(log => log.module === moduleFilter.value);
  }
  
  filteredLogs.value = result;
}

watch([logs, levelFilter, moduleFilter], () => {
  applyFilters();
});

onMounted(async () => {
  await fetchLogs();
  refreshInterval = window.setInterval(fetchLogs, 5000);
  
  await nextTick();
  if (autoScroll.value) {
    scrollToBottom();
  }
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">系统运行日志</h1>
      <div class="flex gap-3">
        <select v-model="levelFilter" class="text-sm border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-800 focus:ring-blue-500 py-1.5 pl-3 pr-8">
          <option v-for="opt in levelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <select v-model="moduleFilter" class="text-sm border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-800 focus:ring-blue-500 py-1.5 pl-3 pr-8">
          <option v-for="opt in moduleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <button @click="fetchLogs" :disabled="loading" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors">
          <span v-if="loading">刷新中...</span>
          <span v-else>刷新</span>
        </button>
      </div>
    </div>
    
    <div class="flex items-center gap-4">
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" v-model="autoScroll" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        <span class="text-sm text-gray-700 dark:text-gray-300">自动滚动到底部</span>
      </label>
      <button @click="scrollToBottom" class="px-4 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
        滚动到底部
      </button>
    </div>
    
    <div ref="logContainer" class="bg-gray-900 rounded-lg p-4 h-[600px] overflow-y-auto font-mono text-sm leading-relaxed">
      <div v-if="loading && logs.length === 0" class="flex items-center justify-center h-full">
        <div class="text-gray-400">加载中...</div>
      </div>
      
      <div v-else-if="filteredLogs.length === 0" class="flex items-center justify-center h-full">
        <div class="text-gray-500">暂无日志</div>
      </div>
      
      <div v-else class="space-y-1">
        <div v-for="(log, index) in filteredLogs" :key="index" class="flex gap-3">
          <div class="flex-shrink-0 text-gray-500 w-20">
            {{ formatTimestamp(log.timestamp) }}
          </div>
          <div class="flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium" :class="getModuleBadgeClass(log.module)">
            {{ log.module }}
          </div>
          <div class="flex-shrink-0 w-14 text-center">
            <span :class="getLevelClass(log.level)" class="font-bold uppercase text-xs">
              {{ log.level }}
            </span>
          </div>
          <div class="flex-grow min-w-0 text-gray-300 break-all">
            <span>{{ log.message }}</span>
            <span v-if="log.context" class="text-gray-500 ml-2 text-xs">
              {{ JSON.stringify(log.context) }}
            </span>
            <div v-if="log.stack" class="mt-1 text-red-400 text-xs whitespace-pre-wrap">
              {{ log.stack }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
