<script setup lang="ts">
import { ref, onMounted } from 'vue';

const embyUrl = ref('');
const embyApiKey = ref('');
const embyUserId = ref('');
const tmdbApiKey = ref('');
const tmdbLang = ref('zh-CN');
const proxyEnabled = ref(false);
const proxyProtocol = ref('http');
const proxyHost = ref('127.0.0.1');
const proxyPort = ref('7890');
const syncCron = ref('0 */30 * * * *');

const showEmbyKey = ref(false);
const showTmdbKey = ref(false);
const copied = ref(false);
const saved = ref(false);
const saveError = ref('');
const embyTestResult = ref<null | { ok: boolean; message?: string; error?: string }>(null);
const testingEmby = ref(false);
const tmdbTestResult = ref<null | { ok: boolean; message?: string; error?: string }>(null);
const testingTmdb = ref(false);
const proxyTestResult = ref<null | { ok: boolean; message?: string; error?: string }>(null);
const testingProxy = ref(false);

const webhookUrl = ref('http://localhost:3000/webhooks/emby');

onMounted(async () => {
  try {
    // 先尝试从后端获取设置
    const res = await fetch('/api/settings');
    if (res.ok) {
      const d = await res.json();
      embyUrl.value = d.EMBY_URL || '';
      embyApiKey.value = d.EMBY_API_KEY || '';
      embyUserId.value = d.EMBY_USER_ID || '';
      tmdbApiKey.value = d.TMDB_API_KEY || '';
      tmdbLang.value = d.TMDB_LANGUAGE || 'zh-CN';
      proxyEnabled.value = d.PROXY_ENABLED === true;
      proxyProtocol.value = d.PROXY_PROTOCOL || 'http';
      proxyHost.value = d.PROXY_HOST || '127.0.0.1';
      proxyPort.value = d.PROXY_PORT || '7890';
      syncCron.value = d.SYNC_CRON || '0 */30 * * * *';
      if (d.EMBY_URL) {
        webhookUrl.value = `${window.location.protocol}//${window.location.hostname}:3000/webhooks/emby`;
      }
    } else {
      // 后端获取失败，从本地存储读取
      const localSettings = localStorage.getItem('embyflow-settings');
      if (localSettings) {
        try {
          const d = JSON.parse(localSettings);
          embyUrl.value = d.EMBY_URL || '';
          embyApiKey.value = d.EMBY_API_KEY || '';
          embyUserId.value = d.EMBY_USER_ID || '';
          tmdbApiKey.value = d.TMDB_API_KEY || '';
          tmdbLang.value = d.TMDB_LANGUAGE || 'zh-CN';
          proxyEnabled.value = d.PROXY_ENABLED === true;
          proxyProtocol.value = d.PROXY_PROTOCOL || 'http';
          proxyHost.value = d.PROXY_HOST || '127.0.0.1';
          proxyPort.value = d.PROXY_PORT || '7890';
          syncCron.value = d.SYNC_CRON || '0 */30 * * * *';
          if (d.EMBY_URL) {
            webhookUrl.value = `${window.location.protocol}//${window.location.hostname}:3000/webhooks/emby`;
          }
        } catch {}
      }
    }
  } catch {
    // 网络错误，从本地存储读取
    const localSettings = localStorage.getItem('embyflow-settings');
    if (localSettings) {
      try {
        const d = JSON.parse(localSettings);
        embyUrl.value = d.EMBY_URL || '';
        embyApiKey.value = d.EMBY_API_KEY || '';
        embyUserId.value = d.EMBY_USER_ID || '';
        tmdbApiKey.value = d.TMDB_API_KEY || '';
        tmdbLang.value = d.TMDB_LANGUAGE || 'zh-CN';
        proxyEnabled.value = d.PROXY_ENABLED === true;
        proxyProtocol.value = d.PROXY_PROTOCOL || 'http';
        proxyHost.value = d.PROXY_HOST || '127.0.0.1';
        proxyPort.value = d.PROXY_PORT || '7890';
        syncCron.value = d.SYNC_CRON || '0 */30 * * * *';
        if (d.EMBY_URL) {
          webhookUrl.value = `${window.location.protocol}//${window.location.hostname}:3000/webhooks/emby`;
        }
      } catch {}
    }
  }
});

async function saveSettings() {
  saveError.value = '';
  try {
    const settingsData = {
      EMBY_URL: embyUrl.value,
      EMBY_API_KEY: embyApiKey.value,
      EMBY_USER_ID: embyUserId.value,
      TMDB_API_KEY: tmdbApiKey.value,
      TMDB_LANGUAGE: tmdbLang.value,
      PROXY_ENABLED: proxyEnabled.value,
      PROXY_PROTOCOL: proxyProtocol.value,
      PROXY_HOST: proxyHost.value,
      PROXY_PORT: proxyPort.value,
      SYNC_CRON: syncCron.value,
    };
    
    // 尝试保存到后端
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsData),
    });
    
    if (res.ok) {
      saved.value = true;
      setTimeout(() => (saved.value = false), 3000);
    } else {
      // 后端保存失败，尝试保存到本地存储
      localStorage.setItem('embyflow-settings', JSON.stringify(settingsData));
      saved.value = true;
      setTimeout(() => (saved.value = false), 3000);
    }
  } catch {
    // 网络错误，保存到本地存储
    const settingsData = {
      EMBY_URL: embyUrl.value,
      EMBY_API_KEY: embyApiKey.value,
      EMBY_USER_ID: embyUserId.value,
      TMDB_API_KEY: tmdbApiKey.value,
      TMDB_LANGUAGE: tmdbLang.value,
      PROXY_ENABLED: proxyEnabled.value,
      PROXY_PROTOCOL: proxyProtocol.value,
      PROXY_HOST: proxyHost.value,
      PROXY_PORT: proxyPort.value,
      SYNC_CRON: syncCron.value,
    };
    localStorage.setItem('embyflow-settings', JSON.stringify(settingsData));
    saved.value = true;
    setTimeout(() => (saved.value = false), 3000);
  }
}

function copyWebhook() {
  navigator.clipboard.writeText(webhookUrl.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

async function testEmby() {
  testingEmby.value = true;
  embyTestResult.value = null;
  try {
    const res = await fetch('/api/settings/test-emby');
    embyTestResult.value = await res.json();
  } catch { embyTestResult.value = { ok: false, error: '网络错误' }; }
  finally { testingEmby.value = false; }
}

async function testTmdb() {
  testingTmdb.value = true;
  tmdbTestResult.value = null;
  try {
    const res = await fetch('/api/settings/test-tmdb');
    tmdbTestResult.value = await res.json();
  } catch { tmdbTestResult.value = { ok: false, error: '网络错误' }; }
  finally { testingTmdb.value = false; }
}

async function testProxy() {
  testingProxy.value = true;
  proxyTestResult.value = null;
  try {
    const res = await fetch('/api/settings/test-proxy');
    proxyTestResult.value = await res.json();
  } catch { proxyTestResult.value = { ok: false, error: '网络错误' }; }
  finally { testingProxy.value = false; }
}
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6 pb-12">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">系统设置</h1>

    <!-- ① Emby 服务器配置 -->
    <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span class="font-bold text-gray-900 dark:text-white flex items-center gap-2">🖥️ Emby 服务器配置</span>
        <div class="flex items-center gap-2">
          <span v-if="embyTestResult" class="text-xs font-medium" :class="embyTestResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'">{{ embyTestResult.ok ? embyTestResult.message : embyTestResult.error }}</span>
          <button @click="testEmby" :disabled="testingEmby" class="text-xs px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50">{{ testingEmby ? '测试中...' : '测试连接' }}</button>
        </div>
      </div>
      <div class="p-6 space-y-4">
        <div class="grid sm:grid-cols-3 gap-2 items-center">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">服务器地址</label>
          <input v-model="embyUrl" type="text" placeholder="http://192.168.1.x:8096"
            class="sm:col-span-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition" />
        </div>
        <div class="grid sm:grid-cols-3 gap-2 items-center">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
          <div class="sm:col-span-2 relative">
            <input v-model="embyApiKey" :type="showEmbyKey ? 'text' : 'password'" placeholder="xxxxxxxx-xxxx"
              class="w-full px-3 py-2 pr-16 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition" />
            <button @click="showEmbyKey = !showEmbyKey" class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">{{ showEmbyKey ? '隐藏' : '显示' }}</button>
          </div>
        </div>
        <div class="grid sm:grid-cols-3 gap-2 items-center">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">用户 ID</label>
          <input v-model="embyUserId" type="text" placeholder="Emby 用户 ID"
            class="sm:col-span-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition" />
        </div>
      </div>
    </section>

    <!-- ② TMDB 配置 -->
    <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span class="font-bold text-gray-900 dark:text-white flex items-center gap-2">🎬 TMDB 配置</span>
        <div class="flex items-center gap-2">
          <span v-if="tmdbTestResult" class="text-xs font-medium" :class="tmdbTestResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'">{{ tmdbTestResult.ok ? tmdbTestResult.message : tmdbTestResult.error }}</span>
          <button @click="testTmdb" :disabled="testingTmdb" class="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50">{{ testingTmdb ? '测试中...' : '测试连接' }}</button>
        </div>
      </div>
      <div class="p-6 space-y-4">
        <div class="grid sm:grid-cols-3 gap-2 items-center">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
          <div class="sm:col-span-2 relative">
            <input v-model="tmdbApiKey" :type="showTmdbKey ? 'text' : 'password'" placeholder="TMDB API Key"
              class="w-full px-3 py-2 pr-16 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition" />
            <button @click="showTmdbKey = !showTmdbKey" class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">{{ showTmdbKey ? '隐藏' : '显示' }}</button>
          </div>
        </div>
        <div class="grid sm:grid-cols-3 gap-2 items-center">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">语言偏好</label>
          <select v-model="tmdbLang" class="sm:col-span-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition">
            <option value="zh-CN">简体中文</option>
            <option value="zh-TW">繁体中文</option>
            <option value="en-US">English</option>
            <option value="ja-JP">日本語</option>
          </select>
        </div>
      </div>
    </section>

    <!-- ③ 网络代理配置 -->
    <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span class="font-bold text-gray-900 dark:text-white flex items-center gap-2">🌐 网络代理配置</span>
        <div class="flex items-center gap-3">
          <span v-if="proxyTestResult !== null" class="text-xs font-medium" :class="proxyTestResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'">
            {{ proxyTestResult.ok ? proxyTestResult.message : proxyTestResult.error }}
          </span>
          <button @click="testProxy" :disabled="testingProxy"
            class="text-xs px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50">
            {{ testingProxy ? '检测中...' : '测试代理' }}
          </button>
        </div>
      </div>
      <div class="p-6 space-y-4">
        <div class="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">启用代理</label>
          <button @click="proxyEnabled = !proxyEnabled"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            :class="proxyEnabled ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'">
            <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
              :class="proxyEnabled ? 'translate-x-6' : 'translate-x-1'"></span>
          </button>
        </div>
        <div class="grid sm:grid-cols-3 gap-2 items-center">
          <label class="text-sm font-medium" :class="proxyEnabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'">协议</label>
          <select v-model="proxyProtocol" :disabled="!proxyEnabled"
            class="sm:col-span-2 px-3 py-2 rounded-lg border text-sm outline-none transition"
            :class="proxyEnabled ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'">
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
            <option value="socks5">SOCKS5</option>
          </select>
        </div>
        <div class="grid sm:grid-cols-3 gap-2 items-center">
          <label class="text-sm font-medium" :class="proxyEnabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'">地址</label>
          <input v-model="proxyHost" :disabled="!proxyEnabled" placeholder="127.0.0.1" type="text"
            class="sm:col-span-2 px-3 py-2 rounded-lg border text-sm outline-none transition"
            :class="proxyEnabled ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'" />
        </div>
        <div class="grid sm:grid-cols-3 gap-2 items-center">
          <label class="text-sm font-medium" :class="proxyEnabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'">端口</label>
          <input v-model="proxyPort" :disabled="!proxyEnabled" placeholder="7890" type="text"
            class="sm:col-span-2 px-3 py-2 rounded-lg border text-sm outline-none transition"
            :class="proxyEnabled ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'" />
        </div>
      </div>
    </section>

    <!-- ④ 同步设置 -->
    <section class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <span class="font-bold text-gray-900 dark:text-white flex items-center gap-2">🔄 同步设置</span>
      </div>
      <div class="p-6 space-y-4">
        <div class="grid sm:grid-cols-3 gap-2 items-center">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">同步频率 (CRON)</label>
          <select v-model="syncCron" class="sm:col-span-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition">
            <option value="0 */15 * * * *">每 15 分钟</option>
            <option value="0 */30 * * * *">每 30 分钟</option>
            <option value="0 0 * * * *">每小时</option>
            <option value="0 0 */6 * * *">每 6 小时</option>
            <option value="0 0 0 * * *">每天</option>
          </select>
        </div>
        <div class="grid sm:grid-cols-3 gap-2 items-start">
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Webhook 地址</label>
            <p class="text-xs text-gray-400">在 Emby 插件中配置此地址</p>
          </div>
          <div class="sm:col-span-2 flex gap-2">
            <input :value="webhookUrl" readonly type="text"
              class="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 font-mono outline-none" />
            <button @click="copyWebhook"
              class="shrink-0 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              {{ copied ? '✓' : '复制' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 保存按钮 -->
    <div class="flex items-center justify-end gap-3">
      <span v-if="saveError" class="text-sm text-red-500">{{ saveError }}</span>
      <button @click="saveSettings"
        class="px-6 py-2.5 rounded-lg font-medium text-white transition-colors shadow-sm"
        :class="saved ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'">
        {{ saved ? '✓ 已保存' : '保存设置' }}
      </button>
    </div>
  </div>
</template>
