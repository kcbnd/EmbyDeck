<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterView, RouterLink, useRoute } from 'vue-router';
import { useThemeStore } from '@/stores/theme';

const themeStore = useThemeStore();
const route = useRoute();
const syncing = ref(false);
const lastSyncAt = ref<string | null>(null);

onMounted(() => {
  themeStore.init();
  loadSyncStatus();
});

async function loadSyncStatus() {
  try {
    const res = await fetch('/api/sync/status');
    if (res.ok) {
      const data = await res.json();
      lastSyncAt.value = data.latest?.finished_at || null;
    }
  } catch {}
}

async function triggerSync() {
  if (syncing.value) return;
  syncing.value = true;
  try {
    await fetch('/api/sync/manual', { method: 'POST' });
    setTimeout(() => { syncing.value = false; loadSyncStatus(); }, 3000);
  } catch { syncing.value = false; }
}

function formatRelTime(isoStr: string | null) {
  if (!isoStr) return '从未同步';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-200">
    <!-- 顶部导航 -->
    <nav class="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div class="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <!-- Logo -->
        <RouterLink to="/" class="flex items-center gap-2 shrink-0">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">E</div>
          <span class="font-bold text-lg text-gray-900 dark:text-white hidden sm:block">EmbyFlow</span>
        </RouterLink>

        <!-- 导航链接 -->
        <div class="flex items-center gap-1">
          <RouterLink v-for="nav in [{ to: '/', label: '首页' }, { to: '/stats', label: '统计' }, { to: '/settings', label: '设置' }]"
            :key="nav.to" :to="nav.to"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            :class="route.path === nav.to
              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'">
            {{ nav.label }}
          </RouterLink>
        </div>

        <!-- 右侧工具栏 -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- 同步状态 -->
          <div class="hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <div class="w-2 h-2 rounded-full" :class="syncing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'"></div>
            {{ syncing ? '同步中...' : formatRelTime(lastSyncAt) }}
          </div>
          <!-- 手动同步 -->
          <button @click="triggerSync" :disabled="syncing"
            class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
            :class="syncing
              ? 'border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-600 cursor-not-allowed'
              : 'border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'">
            {{ syncing ? '同步中' : '立即同步' }}
          </button>
          <!-- 主题切换 -->
          <button @click="themeStore.toggle"
            class="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-lg">
            {{ themeStore.isDark ? '☀️' : '🌙' }}
          </button>
        </div>
      </div>
    </nav>

    <!-- 页面内容 -->
    <main class="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
      <RouterView />
    </main>
  </div>
</template>
