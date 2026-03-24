<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore } from '@/stores/theme';
import VChart from 'vue-echarts';

const props = defineProps<{
  data: { hour: number; count: number }[];
}>();

const themeStore = useThemeStore();
const isDark = computed(() => themeStore.isDark);

const option = computed(() => {
  if (!props.data || props.data.length === 0) return {};

  // 补齐 0-23 小时
  const hoursData = new Array(24).fill(0);
  props.data.forEach(d => {
    hoursData[d.hour] = d.count;
  });

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark.value ? '#1f2937' : '#fff',
      textStyle: { color: isDark.value ? '#fff' : '#111' },
      borderColor: isDark.value ? '#374151' : '#e5e7eb',
      formatter: '{b}:00 - 观看了 {c} 集'
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: Array.from({length: 24}, (_, i) => i),
      axisLabel: { color: isDark.value ? '#9ca3af' : '#6b7280' },
      axisLine: { lineStyle: { color: isDark.value ? '#374151' : '#e5e7eb' } },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: isDark.value ? '#1f2937' : '#f3f4f6' } },
      axisLabel: { color: isDark.value ? '#9ca3af' : '#6b7280' },
    },
    series: [
      {
        name: '观看集数',
        type: 'line',
        smooth: true,
        symbol: 'none',
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.5)' }, // Tailwind blue-500
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
            ]
          }
        },
        lineStyle: { width: 3, color: '#3b82f6' },
        data: hoursData
      }
    ]
  };
});
</script>

<template>
  <div class="w-full h-full min-h-[200px]">
    <VChart v-if="data && data.length" :option="option" autoresize class="w-full h-full" />
    <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">暂无数据</div>
  </div>
</template>
