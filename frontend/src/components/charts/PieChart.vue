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

  const colors = [
    '#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', 
    '#ef4444', '#f97316', '#06b6d4', '#84cc16',
    '#14b8a6', '#f43f5e', '#a855f7', '#6366f1'
  ];

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
        name: props.title || '分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: isDark.value ? '#1f2937' : '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}: {d} ({c}%)',
          color: isDark.value ? '#fff' : '#111',
        },
        labelLine: {
          show: true,
          length: 10,
          length2: 10,
        },
        data: props.data.map((d, index) => ({
          value: d.value,
          name: d.name,
          itemStyle: {
            color: colors[index % colors.length],
          },
        })),
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
