import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, HeatmapChart, PieChart, BarChart } from 'echarts/charts';
import VChart from 'vue-echarts';
import App from './App.vue';
import router from './router';
import '@/assets/index.css';

use([CanvasRenderer, LineChart, HeatmapChart, PieChart, BarChart]);

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.component('VChart', VChart);
app.mount('#app');
