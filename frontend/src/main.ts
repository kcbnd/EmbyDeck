import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import App from './App.vue';
import router from './router';
import '@/assets/index.css';

// 注册 ECharts 组件
use([CanvasRenderer, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent]);

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.component('VChart', VChart);
app.mount('#app');
