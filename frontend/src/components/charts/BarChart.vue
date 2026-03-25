<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore } from '@/stores/theme';
import VChart from 'vue-echarts';
import type { EChartsOption } from 'echarts/core';

const props = defineProps<{
  data: { name: string; value: number }[];
  title?: string;
}>();

const themeStore = useThemeStore();
const isDark = computed(() => themeStore.isDark);

const option = computed<EChartsOption>(() => {
  if (!props.data || props.data.length === 0) return {};

  const names = props.data.map(d => d.name);
  const values = props.data.map(d => d.value);
  const maxValue = Math.max(...values, 1);

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
      data: names,
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
    series: [
      {
        name: props.title || '数值',
        type: 'bar',
        data: values,
        itemStyle: {
          color: '#8b5cf6',
          borderRadius: [4, 4, 0],
        },
        label: {
          show: true,
          position: 'top',
          color: isDark.value ? '#fff' : '#111',
          fontSize: 12,
          fontWeight: 'bold',
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
