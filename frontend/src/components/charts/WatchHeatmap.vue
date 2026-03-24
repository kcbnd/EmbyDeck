<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore } from '@/stores/theme';
import VChart from 'vue-echarts';

const props = defineProps<{
  data: { date: string; count: number }[];
}>();

const themeStore = useThemeStore();
const isDark = computed(() => themeStore.isDark);

const option = computed(() => {
  if (!props.data || props.data.length === 0) return {};
  
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  const startDateStr = start.toISOString().split('T')[0];
  const endDateStr = end.toISOString().split('T')[0];

  const heatmapData = props.data.map(item => [item.date, item.count]);

  return {
    tooltip: {
      position: 'top',
      formatter: function (p: any) {
        return `${p.data[0]}: 观看了 ${p.data[1]} 集`;
      },
      backgroundColor: isDark.value ? '#1f2937' : '#fff',
      textStyle: { color: isDark.value ? '#fff' : '#111' },
      borderColor: isDark.value ? '#374151' : '#e5e7eb'
    },
    visualMap: {
      min: 0,
      max: Math.max(...props.data.map(d => d.count), 5), // 至少以5为刻度最深
      type: 'piecewise',
      orient: 'horizontal',
      left: 'right',
      bottom: '0',
      textStyle: { color: isDark.value ? '#9ca3af' : '#6b7280' },
      inRange: {
        color: isDark.value 
          ? ['pt-13', '#0e4429', '#006d32', '#26a641', '#39d353'] // 类似 GitHub 深色主题绿色
          : ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'] // GitHub 浅色主题绿色
      },
      pieces: [
        {value: 0, color: isDark.value ? '#161b22' : '#ebedf0'}, // 0 的颜色
        {min: 1, max: 2},
        {min: 3, max: 5},
        {min: 6, max: 10},
        {min: 11}
      ],
      show: false // 可以隐藏左下角的图例保持简洁
    },
    calendar: {
      top: 20,
      left: 30,
      right: 10,
      cellSize: ['auto', 14],
      range: [startDateStr, endDateStr],
      itemStyle: {
        color: isDark.value ? '#161b22' : '#ebedf0', // empty
        borderWidth: 2,
        borderColor: isDark.value ? '#1f2937' : '#fff'
      },
      splitLine: { show: false },
      yearLabel: { show: false },
      dayLabel: {
        firstDay: 1,
        nameMap: ['日', '一', '二', '三', '四', '五', '六'],
        color: isDark.value ? '#9ca3af' : '#6b7280'
      },
      monthLabel: {
        nameMap: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
        color: isDark.value ? '#9ca3af' : '#6b7280'
      }
    },
    series: {
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: heatmapData
    }
  };
});
</script>

<template>
  <div class="w-full h-[150px]">
    <VChart v-if="data && data.length" :option="option" autoresize class="w-full h-full" />
    <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">暂无观影数据</div>
  </div>
</template>
