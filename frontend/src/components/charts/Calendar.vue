<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore } from '@/stores/theme';
import VChart from 'vue-echarts';
import type { EChartsOption } from 'echarts/core';

const props = defineProps<{
  data: { date: string; count: number }[];
  title?: string;
}>();

const themeStore = useThemeStore();
const isDark = computed(() => themeStore.isDark);

const option = computed<EChartsOption>(() => {
  if (!props.data || props.data.length === 0) return {};

  const dates = props.data.map(d => d.date);
  const counts = props.data.map(d => d.count);
  
  const maxValue = Math.max(...counts, 1);
  
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: isDark.value ? '#1f2937' : '#fff',
      textStyle: { color: isDark.value ? '#fff' : '#111' },
      borderColor: isDark.value ? '#374151' : '#e5e7eb',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: {
        color: isDark.value ? '#9ca3af' : '#4b5563',
        fontSize: 10,
        rotate: 45,
      },
      axisLine: {
        lineStyle: { color: isDark.value ? '#374151' : '#e5e7eb' },
      },
      axisTick: {
        lineStyle: { color: isDark.value ? '#374151' : '#e5e7eb' },
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: isDark.value ? '#9ca3af' : '#4b5563',
        fontSize: 10,
      },
      axisLine: {
        lineStyle: { color: isDark.value ? '#374151' : '#e5e7eb' },
      },
      splitLine: {
        lineStyle: { color: isDark.value ? '#374151' : '#e5e7eb' },
      },
    },
    visualMap: {
      min: 0,
      max: maxValue,
      inRange: {
        color: ['#ebedf0', '#fcd34d', '#5470c6', '#91cc7d', '#fac858', '#e74c3c'],
      },
      text: ['0', '1-2', '3-5', '6-10', '11-20', '21-50', '50+'],
      textStyle: {
        color: isDark.value ? '#fff' : '#111',
      },
    },
    series: [
      {
        type: 'heatmap',
        data: props.data.map(d => [d.date, d.count]),
        label: {
          show: false,
        },
        itemStyle: {
          borderColor: isDark.value ? '#374151' : '#e5e7eb',
          borderWidth: 1,
        },
      },
    ],
  };
});
</script>

<template>
  <div class="w-full h-full min-h-[250px]">
    <VChart v-if="data && data.length" :option="option" autoresize class="w-full h-full" />
    <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">暂无数据</div>
  </div>
</template>
