import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import StatsView from '@/views/StatsView.vue';
import SettingsView from '@/views/SettingsView.vue';
import LogsView from '@/views/LogsView.vue';

const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/stats', name: 'stats', component: StatsView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/logs', name: 'logs', component: LogsView },
  ],
});

export default router;
