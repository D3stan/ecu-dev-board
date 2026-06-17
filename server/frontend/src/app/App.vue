<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { Cpu, Activity, LineChart, Shield, ShieldAlert } from 'lucide-vue-next';

const route = useRoute();
const isServerHealthy = ref<boolean | null>(null);
let healthInterval: number | null = null;

const checkHealth = async () => {
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      isServerHealthy.value = data.status === 'healthy';
    } else {
      isServerHealthy.value = false;
    }
  } catch (err) {
    isServerHealthy.value = false;
  }
};

onMounted(() => {
  checkHealth();
  healthInterval = window.setInterval(checkHealth, 10000);
});

onUnmounted(() => {
  if (healthInterval) clearInterval(healthInterval);
});
</script>

<template>
  <div class="dashboard-container">
    <!-- Sidebar Navigation -->
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-icon">🏎️</span>
        <h1 class="brand-title glow-text">ECU Twin</h1>
      </div>
      
      <nav class="nav-menu">
        <router-link to="/ecus" class="nav-item" :class="{ active: route.path.startsWith('/ecus') }">
          <Cpu :size="20" />
          <span>ECUs Dashboard</span>
        </router-link>
        
        <router-link to="/runs" class="nav-item" :class="{ active: route.path.startsWith('/runs') && !route.path.includes('/telemetry') }">
          <Activity :size="20" />
          <span>Engine Runs</span>
        </router-link>
        
        <router-link to="/runs/latest/telemetry" class="nav-item" :class="{ active: route.path.includes('/telemetry') }">
          <LineChart :size="20" />
          <span>Telemetry Viewer</span>
        </router-link>
      </nav>
      
      <!-- Connection Status indicator at bottom -->
      <div class="status-footer">
        <div v-if="isServerHealthy === true" class="status-indicator online">
          <Shield :size="16" />
          <span>System Online</span>
        </div>
        <div v-else-if="isServerHealthy === false" class="status-indicator offline">
          <ShieldAlert :size="16" />
          <span>System Offline</span>
        </div>
        <div v-else class="status-indicator checking">
          <span class="spinner"></span>
          <span>Connecting...</span>
        </div>
      </div>
    </aside>

    <!-- Main Content Panel -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is={Component} :key="route.fullPath" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style scoped>
.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 2.5rem;
  padding: 0.5rem 0.25rem;
}

.brand-icon {
  font-size: 1.75rem;
}

.brand-title {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--color-primary);
  text-transform: uppercase;
}

.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s ease-in-out;
  border: 1px solid transparent;
}

.nav-item:hover {
  color: var(--text-primary);
  background-color: rgba(255, 255, 255, 0.03);
}

.nav-item.active {
  color: var(--color-primary);
  background-color: rgba(0, 240, 255, 0.05);
  border-color: rgba(0, 240, 255, 0.15);
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.02);
}

.status-footer {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-indicator.online {
  color: var(--color-success);
}

.status-indicator.offline {
  color: var(--color-danger);
}

.status-indicator.checking {
  color: var(--text-secondary);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Page transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
