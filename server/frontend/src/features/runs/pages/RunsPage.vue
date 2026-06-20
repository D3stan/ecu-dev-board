<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { RunsService, EcusService } from '@/api/generated';
import type { RunDetailResponse } from '@/api/generated';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import { Activity, StopCircle, RefreshCw, LineChart } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();

const runs = ref<RunDetailResponse[]>([]);
const filteredRuns = ref<RunDetailResponse[]>([]);
const loading = ref(false);
const errorMsg = ref('');
let pollInterval: number | null = null;

const loadRuns = async () => {
  // Only set main loading first time
  if (runs.value.length === 0) loading.value = true;
  errorMsg.value = '';
  try {
    const list = await RunsService.listRuns();
    runs.value = list;
    applyFilter();
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to fetch engine runs';
  } finally {
    loading.value = false;
  }
};

const applyFilter = () => {
  const ecuSerial = route.query.ecu_serial as string;
  if (ecuSerial) {
    // We need to look up ECU serials. To keep it simple: we can filter by matching serials.
    // If the backend list_runs supported filtering by ecu_serial directly, that'd be cool.
    // But list_runs supports filtering by ecu_id.
    // Let's load the ECUs to map serial -> id first if necessary, or just do client-side filtering if we fetch ECU info.
    // Let's filter runs where we can look up the ECU. Wait! EcuResponse has serial_number.
    // Let's resolve the ecu_id from serial_number.
    fetchEcuAndFilter(ecuSerial);
  } else {
    filteredRuns.value = runs.value;
  }
};

const fetchEcuAndFilter = async (serial: string) => {
  try {
    const ecus = await EcusService.listEcus();
    const ecu = ecus.find(e => e.serial_number === serial);
    if (ecu) {
      filteredRuns.value = runs.value.filter(r => r.ecu_id === ecu.id);
    } else {
      filteredRuns.value = [];
    }
  } catch (err) {
    filteredRuns.value = runs.value; // Fallback
  }
};

const handleEndRun = async (runId: string) => {
  errorMsg.value = '';
  try {
    await RunsService.endRun(runId);
    await loadRuns();
  } catch (err: any) {
    errorMsg.value = err.body?.detail || err.message || 'Failed to end engine run';
  }
};

const viewTelemetry = (runId: string) => {
  router.push({ name: 'telemetry', params: { runId } });
};

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString();
};

const formatDuration = (startStr: string, endStr: string | null | undefined) => {
  const start = new Date(startStr).getTime();
  const end = endStr ? new Date(endStr).getTime() : Date.now();
  const diffMs = end - start;
  if (diffMs < 0) return '0s';
  const secs = Math.floor(diffMs / 1000);
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
};

// Re-apply filter if route query changes
watch(() => route.query.ecu_serial, () => {
  applyFilter();
});

onMounted(() => {
  loadRuns();
  pollInterval = window.setInterval(loadRuns, 5000); // Poll runs every 5 seconds
});

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});
</script>

<template>
  <div class="runs-page">
    <div class="header-bar">
      <div class="title-section">
        <Activity :size="28" class="text-success glow-text" />
        <h2>Engine Runs</h2>
        <span v-if="route.query.ecu_serial" class="filter-indicator">
          filtered by ECU: <strong>{{ route.query.ecu_serial }}</strong>
          <button @click="router.push({ name: 'runs' })">&times;</button>
        </span>
      </div>
      <div class="actions">
        <Button severity="secondary" rounded @click="loadRuns" :disabled="loading" class="btn-refresh">
          <RefreshCw :size="16" :class="{ 'spin-anim': loading }" />
        </Button>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="errorMsg" class="error-banner">
      <span>{{ errorMsg }}</span>
      <button @click="errorMsg = ''">&times;</button>
    </div>

    <!-- Data Grid -->
    <div class="grid-card">
      <DataTable :value="filteredRuns" :loading="loading" class="custom-table" responsiveLayout="scroll">
        <template #empty>
          <div class="empty-state">
            <Activity :size="48" class="text-muted" />
            <p>No runs recorded. Connect an ECU client to record telemetry.</p>
          </div>
        </template>
        <Column field="id" header="Run ID">
          <template #body="{ data }">
            <span class="font-mono text-muted text-xs" :title="data.id">{{ data.id.substring(0, 8) }}...</span>
          </template>
        </Column>
        <Column field="status" header="Status">
          <template #body="{ data }">
            <span :class="['badge', `badge-${data.status}`]">
              <span class="dot"></span>
              {{ data.status }}
            </span>
          </template>
        </Column>
        <Column field="firmware_version" header="Firmware">
          <template #body="{ data }">
            <span class="font-mono text-xs">{{ data.firmware_version || 'N/A' }}</span>
          </template>
        </Column>
        <Column field="map_version" header="Engine Map">
          <template #body="{ data }">
            <span class="font-mono text-xs">{{ data.map_version || 'N/A' }}</span>
          </template>
        </Column>
        <Column field="batch_count" header="Telemetry Frames">
          <template #body="{ data }">
            <span class="font-semibold text-primary font-mono">{{ data.batch_count }}</span>
          </template>
        </Column>
        <Column header="Duration">
          <template #body="{ data }">
            {{ formatDuration(data.started_at, data.ended_at) }}
          </template>
        </Column>
        <Column field="started_at" header="Started At">
          <template #body="{ data }">
            {{ formatDate(data.started_at) }}
          </template>
        </Column>
        <Column header="Actions" class="actions-col">
          <template #body="{ data }">
            <div class="row-actions">
              <Button severity="secondary" size="small" @click="viewTelemetry(data.id)" class="btn-table btn-primary-table">
                <LineChart :size="14" />
                <span>Telemetry</span>
              </Button>
              <Button v-if="data.status === 'active'" severity="danger" size="small" @click="handleEndRun(data.id)" class="btn-table">
                <StopCircle :size="14" />
                <span>End Run</span>
              </Button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
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

.filter-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background-color: rgba(0, 240, 255, 0.1);
  border: 1px solid rgba(0, 240, 255, 0.2);
  color: var(--color-primary);
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.8rem;
  margin-left: 0.75rem;
}

.filter-indicator button {
  background: none;
  border: none;
  color: inherit;
  font-size: 1.1rem;
  cursor: pointer;
  line-height: 1;
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
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

.grid-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--text-secondary);
}

.empty-state p {
  margin-top: 1rem;
  max-width: 320px;
}

.font-mono {
  font-family: 'Courier New', Courier, monospace;
}

.text-xs {
  font-size: 0.75rem;
}

.text-success {
  color: var(--color-success);
}

.text-primary {
  color: var(--color-primary);
}

.text-muted {
  color: var(--text-muted);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
  margin-right: 0.25rem;
}

.row-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-table {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
}

.btn-primary-table {
  background-color: rgba(0, 240, 255, 0.1) !important;
  border-color: rgba(0, 240, 255, 0.3) !important;
  color: var(--color-primary) !important;
}

.btn-primary-table:hover {
  background-color: var(--color-primary) !important;
  color: black !important;
}
</style>
