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
    legend: {
      orient: 'vertical',
      right: '10%',
      top: 'center',
      textStyle: {
        color: isDark.value ? '#d1d5db' : '#4b5563',
      },
    },
    series: [
      {
        name: props.title || '数值',
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: {
          color: '#8b5cf6',
        },
        lineStyle: {
          color: '#8b5cf6',
          width: 2,
        },
        areaStyle: {
          color: 'rgba(139, 92, 246, 0.2)',
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
