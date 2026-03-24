<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ShowCard from '@/components/ShowCard.vue';
import DetailModal from '@/components/DetailModal.vue';
import SearchModal from '@/components/SearchModal.vue';

const shows = ref<any[]>([]);
const loading = ref(true);
const drawerOpen = ref(false);
const searchModalOpen = ref(false);
const selectedShow = ref<any>(null);

async function loadShows() {
  loading.value = true;
  try {
    const res = await fetch('/api/shows');
    if (res.ok) {
      shows.value = await res.json();
    } else {
      shows.value = [];
    }
  } catch {
    shows.value = [];
  } finally { loading.value = false; }
}

onMounted(() => {
  loadShows();
});

function openDetail(show: any) {
  selectedShow.value = show;
  drawerOpen.value = true;
}

const watchingList = () => shows.value.filter(s => s.status === 'watching');
const planList = () => shows.value.filter(s => s.status === 'plan');
const watchedList = () => shows.value.filter(s => s.status === 'watched');
</script>

<template>
  <div class="space-y-10 pb-12">
    <!-- 加载中 -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <template v-else>
      <!-- 继续观看 -->
      <section v-if="watchingList().length > 0">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-3">
          <span class="w-1.5 h-6 bg-blue-500 rounded-full"></span>继续观看
          <span class="text-sm font-normal text-gray-400">{{ watchingList().length }} 部</span>
        </h2>
        <div class="grid gap-4 sm:gap-5" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))">
          <ShowCard v-for="show in watchingList()" :key="show.id" :item="show" @click.stop="openDetail(show)" />
        </div>
      </section>

      <!-- 搜索/过滤可占位在此 -->
      <div class="flex items-center gap-3">
        <button @click="searchModalOpen = true" class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[12px] shadow-[0_2px_8px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_12px_rgba(37,99,235,0.3)] transition-all font-medium text-sm border border-transparent hover:border-blue-400/30">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          添加记录
        </button>
      </div>

      <!-- 我的片单 -->
      <section v-if="planList().length > 0">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-3">
          <span class="w-1.5 h-6 bg-gray-400 rounded-full"></span>我的片单
          <span class="text-sm font-normal text-gray-400">{{ planList().length }} 部</span>
        </h2>
        <div class="grid gap-4 sm:gap-5" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))">
          <ShowCard v-for="show in planList()" :key="show.id" :item="show" @click.stop="openDetail(show)" />
        </div>
      </section>

      <!-- 看完了 -->
      <section v-if="watchedList().length > 0">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-3">
          <span class="w-1.5 h-6 bg-emerald-500 rounded-full"></span>看完了
          <span class="text-sm font-normal text-gray-400">{{ watchedList().length }} 部</span>
        </h2>
        <div class="grid gap-4 sm:gap-5" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))">
          <ShowCard v-for="show in watchedList()" :key="show.id" :item="show" @click.stop="openDetail(show)" />
        </div>
      </section>

      <!-- 空状态 -->
      <div v-if="!watchingList().length && !planList().length && !watchedList().length"
        class="flex flex-col items-center justify-center py-24 text-gray-400">
        <div class="text-6xl mb-4">📺</div>
        <p class="text-lg font-medium mb-2">还没有追剧记录</p>
        <p class="text-sm">点击右上角「立即同步」从 Emby 导入你的剧集</p>
      </div>
    </template>

    <!-- 详情弹窗 -->
    <DetailModal
      :show="drawerOpen"
      :item="selectedShow"
      @close="drawerOpen = false"
      @deleted="drawerOpen = false; loadShows()"
    />

    <SearchModal
      v-if="searchModalOpen"
      @close="searchModalOpen = false"
      @added="loadShows"
    />
  </div>
</template>
