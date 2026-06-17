<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { RunsService, EcusService } from '@/api/generated';
import type { RunDetailResponse, TelemetryStateEntry } from '@/api/generated';
import Button from 'primevue/button';
import Select from 'primevue/select';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Decimation
} from 'chart.js';
import { LineChart, Play, Pause, RefreshCw, AlertTriangle, ArrowLeft, Cpu } from 'lucide-vue-next';

// Register Chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Decimation
);

const route = useRoute();
const router = useRouter();

const runId = ref<string>('');
const runDetail = ref<RunDetailResponse | null>(null);
const telemetryData = ref<TelemetryStateEntry[]>([]);
const loading = ref(false);
const errorMsg = ref('');
const limit = ref<number>(500);

// Polling/Refresh config
const isAutoRefresh = ref(false);
let refreshInterval: number | null = null;

// Available limit options
const limitOptions = [
  { label: 'Latest 100 pts', value: 100 },
  { label: 'Latest 500 pts', value: 500 },
  { label: 'Latest 1000 pts', value: 1000 },
  { label: 'Latest 2000 pts', value: 2000 }
];

const loadRunInfo = async (targetRunId: string) => {
  if (targetRunId === 'latest') {
    loading.value = true;
    try {
      const runs = await RunsService.listRuns();
      if (runs.length > 0) {
        // Find first active run, or fall back to the most recent run
        const active = runs.find(r => r.status === 'active');
        const latest = active || runs[0];
        router.replace({ name: 'telemetry', params: { runId: latest.id } });
        return;
      } else {
        errorMsg.value = 'No runs found in database. Start a run first.';
        loading.value = false;
        return;
      }
    } catch (err: any) {
      errorMsg.value = err.message || 'Failed to list runs';
      loading.value = false;
      return;
    }
  }

  runId.value = targetRunId;
  try {
    // There is no GET /api/runs/{run_id} directly, but we can look it up from GET /api/runs
    const list = await RunsService.listRuns();
    const found = list.find(r => r.id === targetRunId);
    if (found) {
      runDetail.value = found;
      if (found.status === 'active') {
        isAutoRefresh.value = true;
      }
    } else {
      errorMsg.value = 'Engine run not found';
    }
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to fetch run details';
  }
};

const loadTelemetry = async () => {
  if (!runId.value || runId.value === 'latest') return;
  errorMsg.value = '';
  try {
    const data = await RunsService.getTelemetry({
      runId: runId.value,
      limit: limit.value
    });
    // Sort by ECU collected monotonic time ascending
    telemetryData.value = data.sort((a, b) => a.ecu_collected_at_us - b.ecu_collected_at_us);
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to fetch telemetry';
  }
};

const triggerRefresh = async () => {
  await loadTelemetry();
  // Reload run metadata in case status changed
  if (runId.value) {
    const list = await RunsService.listRuns();
    const found = list.find(r => r.id === runId.value);
    if (found) {
      runDetail.value = found;
      if (found.status !== 'active') {
        isAutoRefresh.value = false;
      }
    }
  }
};

// Start or stop refresh polling
const toggleAutoRefresh = () => {
  isAutoRefresh.value = !isAutoRefresh.value;
};

watch(isAutoRefresh, (val) => {
  if (val) {
    refreshInterval = window.setInterval(triggerRefresh, 1500);
  } else {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }
});

// Chart.js Data Computations
const chartTimeLabels = computed(() => {
  return telemetryData.value.map(t => {
    // Show ECU monotonic time in seconds
    return (t.ecu_collected_at_us / 1000000).toFixed(2) + 's';
  });
});

const rpmChartData = computed(() => ({
  labels: chartTimeLabels.value,
  datasets: [{
    label: 'Engine RPM',
    data: telemetryData.value.map(t => t.state_json.rpm?.rpm || 0),
    borderColor: '#00f0ff',
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.1,
    fill: true
  }]
}));

const tpsChartData = computed(() => ({
  labels: chartTimeLabels.value,
  datasets: [{
    label: 'Throttle Position (TPS %)',
    data: telemetryData.value.map(t => t.state_json.tps?.pct || 0),
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.1,
    fill: true
  }]
}));

const thermalChartData = computed(() => ({
  labels: chartTimeLabels.value,
  datasets: [
    {
      label: 'EGT Temp (°C)',
      data: telemetryData.value.map(t => t.state_json.egt?.c || 0),
      borderColor: '#ef4444',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1
    },
    {
      label: 'Coolant Temp (°C)',
      data: telemetryData.value.map(t => t.state_json.water?.c || 0),
      borderColor: '#3b82f6',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1
    }
  ]
}));

const commonChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 0 }, // Off for real-time performance
  plugins: {
    legend: { labels: { color: '#94a3b8' } },
    decimation: {
      enabled: true,
      algorithm: 'lttb',
      samples: 300
    }
  },
  scales: {
    x: {
      ticks: { color: '#64748b', maxRotation: 0, autoSkip: true, autoSkipPadding: 30 },
      grid: { color: '#1e293b' }
    },
    y: {
      ticks: { color: '#94a3b8' },
      grid: { color: '#1e293b' }
    }
  }
}));

// Client-Side Transition Event scanning
interface CustomTimelineEvent {
  timeSec: number;
  type: string;
  detail: string;
  severity: 'info' | 'warn' | 'crit';
}

const extractedEvents = computed<CustomTimelineEvent[]>(() => {
  const list: CustomTimelineEvent[] = [];
  if (telemetryData.value.length < 2) return list;
  
  for (let i = 1; i < telemetryData.value.value?.length || telemetryData.value.length; i++) {
    const prev = telemetryData.value[i - 1];
    const curr = telemetryData.value[i];
    const timeSec = curr.ecu_collected_at_us / 1000000;
    
    // Map Switch transitions
    if (prev.state_json.map_switch?.request !== curr.state_json.map_switch?.request) {
      list.push({
        timeSec,
        type: 'Map Switch',
        detail: `Switched map request from [${prev.state_json.map_switch?.request}] to [${curr.state_json.map_switch?.request}]`,
        severity: 'info'
      });
    }
    
    // Quick Shifter triggers
    if (!prev.state_json.quick_shifter?.active && curr.state_json.quick_shifter?.active) {
      list.push({
        timeSec,
        type: 'Quickshifter',
        detail: 'Quick Shifter trigger activated',
        severity: 'info'
      });
    }
    
    // Thermal warning alerts
    if (curr.state_json.egt?.state !== 'Normal' && prev.state_json.egt?.state === 'Normal') {
      list.push({
        timeSec,
        type: 'EGT Alert',
        detail: `Exhaust temperature entered warning state: [${curr.state_json.egt?.state}] (${curr.state_json.egt?.c}°C)`,
        severity: 'crit'
      });
    }
    if (curr.state_json.water?.state !== 'Normal' && prev.state_json.water?.state === 'Normal') {
      list.push({
        timeSec,
        type: 'Coolant Alert',
        detail: `Water temperature entered warning state: [${curr.state_json.water?.state}] (${curr.state_json.water?.c}°C)`,
        severity: 'warn'
      });
    }
  }
  
  // Sort descending by time
  return list.sort((a, b) => b.timeSec - a.timeSec);
});

// Setup hook
const init = async (targetId: string) => {
  await loadRunInfo(targetId);
  await loadTelemetry();
};

watch(() => route.params.runId, (newId) => {
  if (newId) {
    init(newId as string);
  }
});

onMounted(() => {
  const initialId = route.params.runId as string || 'latest';
  init(initialId);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<template>
  <div class="telemetry-page">
    <!-- Header Back Navigation -->
    <div class="top-nav">
      <router-link to="/runs" class="btn-back">
        <ArrowLeft :size="16" />
        <span>Back to Runs</span>
      </router-link>
    </div>

    <!-- Main Header -->
    <div class="header-bar">
      <div class="title-section">
        <LineChart :size="28" class="text-primary glow-text" />
        <h2>Run Telemetry Viewer</h2>
      </div>
      
      <div class="controls-panel" v-if="runDetail">
        <Select
          v-model="limit"
          :options="limitOptions"
          optionLabel="label"
          optionValue="value"
          @change="loadTelemetry"
          class="limit-select glow-border"
        />
        
        <Button
          v-if="runDetail.status === 'active'"
          :severity="isAutoRefresh ? 'danger' : 'success'"
          @click="toggleAutoRefresh"
          class="btn-refresh-toggle"
        >
          <component :is="isAutoRefresh ? Pause : Play" :size="16" />
          <span>{{ isAutoRefresh ? 'Pause Live' : 'Resume Live' }}</span>
        </Button>
        
        <Button severity="secondary" rounded @click="triggerRefresh" :disabled="loading" class="btn-refresh">
          <RefreshCw :size="16" :class="{ 'spin-anim': loading }" />
        </Button>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="errorMsg" class="error-banner">
      <span>{{ errorMsg }}</span>
      <button @click="errorMsg = ''">&times;</button>
    </div>

    <!-- Metadata Details -->
    <div class="meta-row" v-if="runDetail">
      <div class="meta-card">
        <span class="meta-label">RUN ID</span>
        <span class="meta-val font-mono">{{ runDetail.id.substring(0, 18) }}...</span>
      </div>
      <div class="meta-card">
        <span class="meta-label">STATUS</span>
        <span :class="['badge', `badge-${runDetail.status}`]">{{ runDetail.status }}</span>
      </div>
      <div class="meta-card">
        <span class="meta-label">FIRMWARE</span>
        <span class="meta-val font-mono">{{ runDetail.firmware_version || 'N/A' }}</span>
      </div>
      <div class="meta-card">
        <span class="meta-label">ENGINE MAP</span>
        <span class="meta-val font-mono">{{ runDetail.map_version || 'N/A' }}</span>
      </div>
      <div class="meta-card">
        <span class="meta-label">TOTAL FRAMES</span>
        <span class="meta-val font-mono">{{ runDetail.batch_count }}</span>
      </div>
    </div>

    <!-- Telemetry Empty State -->
    <div v-if="telemetryData.length === 0 && !loading" class="empty-state-card">
      <AlertTriangle :size="36" class="text-warning" />
      <p>No telemetry frames received for this run yet. Run your vehicle simulator to send data.</p>
    </div>

    <!-- Charts Workspace -->
    <div class="charts-workspace" v-else>
      <div class="chart-container-large">
        <h3>Engine Speed (RPM)</h3>
        <div class="chart-wrapper">
          <Line :data="rpmChartData" :options="commonChartOptions" />
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-container-half">
          <h3>Throttle Position (TPS)</h3>
          <div class="chart-wrapper">
            <Line :data="tpsChartData" :options="commonChartOptions" />
          </div>
        </div>
        <div class="chart-container-half">
          <h3>Thermals (EGT & Coolant)</h3>
          <div class="chart-wrapper">
            <Line :data="thermalChartData" :options="commonChartOptions" />
          </div>
        </div>
      </div>

      <!-- Events Timeline -->
      <div class="events-card">
        <h3>State Event Logs</h3>
        <div class="events-list">
          <div v-if="extractedEvents.length === 0" class="events-empty">
            No state changes or warnings detected in this segment.
          </div>
          <div
            v-else
            v-for="(event, idx) in extractedEvents"
            :key="idx"
            :class="['event-row', `severity-${event.severity}`]"
          >
            <span class="event-time font-mono">T+{{ event.timeSec.toFixed(2) }}s</span>
            <span class="event-type">{{ event.type }}</span>
            <span class="event-detail">{{ event.detail }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.top-nav {
  margin-bottom: 1rem;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: color 0.15s ease;
}

.btn-back:hover {
  color: var(--color-primary);
}

.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.title-section h2 {
  font-weight: 700;
  font-size: 1.5rem;
}

.controls-panel {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.limit-select {
  background-color: var(--bg-surface) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 6px;
  color: var(--text-primary);
  width: 170px;
}

.btn-refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
}

.btn-refresh-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spin-anim {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-banner {
  background-color: rgba(239, 68, 68, 0.15);
  border: 1px solid var(--color-danger);
  color: #fca5a5;
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.error-banner button {
  background: none;
  border: none;
  color: inherit;
  font-size: 1.25rem;
  cursor: pointer;
  line-height: 1;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 2rem;
}

.meta-card {
  flex: 1;
  min-width: 150px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.meta-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.meta-val {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-state-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--text-secondary);
}

.empty-state-card p {
  margin-top: 1rem;
  max-width: 380px;
}

.charts-workspace {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.chart-container-large,
.chart-container-half {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
}

.chart-container-large h3,
.chart-container-half h3,
.events-card h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 1.25rem;
  border-left: 3px solid var(--color-primary);
  padding-left: 0.5rem;
}

.chart-wrapper {
  position: relative;
  height: 250px;
  width: 100%;
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

@media (max-width: 1024px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}

.events-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
}

.events-list {
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.events-empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.event-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.65rem 1rem;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.02);
  border-left: 3px solid transparent;
  font-size: 0.85rem;
}

.event-time {
  color: var(--text-muted);
  font-size: 0.75rem;
  width: 60px;
}

.event-type {
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  font-size: 0.75rem;
  width: 100px;
}

.event-detail {
  color: var(--text-primary);
  flex: 1;
}

.severity-info {
  border-left-color: var(--color-primary);
  background-color: rgba(0, 240, 255, 0.02);
}

.severity-warn {
  border-left-color: var(--color-warning);
  background-color: rgba(245, 158, 11, 0.02);
  color: #fde047;
}

.severity-crit {
  border-left-color: var(--color-danger);
  background-color: rgba(239, 68, 68, 0.02);
  color: #fca5a5;
}

.font-mono {
  font-family: 'Courier New', Courier, monospace;
}

.text-xs {
  font-size: 0.75rem;
}

.text-warning {
  color: var(--color-warning);
}
</style>
