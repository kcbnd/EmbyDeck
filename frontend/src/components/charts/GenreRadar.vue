<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore } from '@/stores/theme';
import VChart from 'vue-echarts';

const props = defineProps<{
  data: { genre: string; count: number }[];
}>();

const themeStore = useThemeStore();
const isDark = computed(() => themeStore.isDark);

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

const option = computed(() => {
  if (!props.data || props.data.length === 0) return {};
  
  // 取前 8 个主要分类用于雷达图
  const topData = [...props.data].sort((a,b) => b.count - a.count).slice(0, 8);
  const maxCount = Math.max(...topData.map(d => d.count), 5); // 避免雷达过小

  const indicator = topData.map(d => ({ name: genreMap[d.genre] || d.genre, max: maxCount }));
  const values = topData.map(d => d.count);

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: isDark.value ? '#1f2937' : '#fff',
      textStyle: { color: isDark.value ? '#fff' : '#111' },
      borderColor: isDark.value ? '#374151' : '#e5e7eb',
    },
    radar: {
      indicator,
      splitArea: {
        areaStyle: { color: isDark.value ? ['#1f2937', '#111827'] : ['#f9fafb', '#f3f4f6'] }
      },
      axisLine: { lineStyle: { color: isDark.value ? '#374151' : '#e5e7eb' } },
      splitLine: { lineStyle: { color: isDark.value ? '#374151' : '#e5e7eb' } },
      axisName: { color: isDark.value ? '#d1d5db' : '#4b5563', fontWeight: 'bold' }
    },
    series: [
      {
        name: '类型偏好',
        type: 'radar',
        data: [
          {
            value: values,
            name: '观看频次',
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: { color: '#8b5cf6' }, // Tailwind purple-500
            areaStyle: { color: 'rgba(139, 92, 246, 0.4)' },
            lineStyle: { color: '#8b5cf6', width: 2 }
          }
        ]
      }
    ]
  };
});
</script>

<template>
  <div class="w-full h-full min-h-[250px]">
    <VChart v-if="data && data.length" :option="option" autoresize class="w-full h-full" />
    <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">暂无数据</div>
  </div>
</template>
