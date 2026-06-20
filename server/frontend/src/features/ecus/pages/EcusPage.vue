<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { EcusService } from '@/api/generated';
import type { EcuResponse } from '@/api/generated';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import { Cpu, Plus, RefreshCw, Layers } from 'lucide-vue-next';

const router = useRouter();
const ecus = ref<EcuResponse[]>([]);
const loading = ref(false);
const errorMsg = ref('');

// Registration Dialog
const showRegisterDialog = ref(false);
const registerSerial = ref('');
const registerHwRev = ref('');
const registerLoading = ref(false);

const loadEcus = async () => {
  loading.value = true;
  errorMsg.value = '';
  try {
    ecus.value = await EcusService.listEcus();
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to fetch ECUs';
  } finally {
    loading.value = false;
  }
};

const handleRegister = async () => {
  if (!registerSerial.value || !registerHwRev.value) return;
  registerLoading.value = true;
  errorMsg.value = '';
  try {
    await EcusService.registerEcu({
      serial_number: registerSerial.value,
      hardware_revision: registerHwRev.value
    });
    showRegisterDialog.value = false;
    registerSerial.value = '';
    registerHwRev.value = '';
    await loadEcus();
  } catch (err: any) {
    errorMsg.value = err.body?.detail || err.message || 'Failed to register ECU';
  } finally {
    registerLoading.value = false;
  }
};

const viewRuns = (serial: string) => {
  router.push({ name: 'runs', query: { ecu_serial: serial } });
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString();
};

onMounted(() => {
  loadEcus();
});
</script>

<template>
  <div class="ecus-page">
    <div class="header-bar">
      <div class="title-section">
        <Cpu :size="28" class="text-primary glow-text" />
        <h2>Registered ECUs</h2>
      </div>
      <div class="actions">
        <Button severity="secondary" rounded @click="loadEcus" :disabled="loading" class="btn-refresh">
          <RefreshCw :size="16" :class="{ 'spin-anim': loading }" />
        </Button>
        <Button @click="showRegisterDialog = true" class="btn-primary">
          <Plus :size="18" />
          <span>Register ECU</span>
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
      <DataTable :value="ecus" :loading="loading" class="custom-table" responsiveLayout="scroll">
        <template #empty>
          <div class="empty-state">
            <Cpu :size="48" class="text-muted" />
            <p>No registered ECUs found. Register an ECU to get started.</p>
          </div>
        </template>
        <Column field="serial_number" header="Serial Number">
          <template #body="{ data }">
            <span class="font-mono text-primary font-semibold">{{ data.serial_number }}</span>
          </template>
        </Column>
        <Column field="hardware_revision" header="Hardware Revision">
          <template #body="{ data }">
            <span class="badge badge-ended">{{ data.hardware_revision }}</span>
          </template>
        </Column>
        <Column field="created_at" header="Registered At">
          <template #body="{ data }">
            {{ formatDate(data.created_at) }}
          </template>
        </Column>
        <Column header="Actions" class="actions-col">
          <template #body="{ data }">
            <div class="row-actions">
              <Button severity="secondary" size="small" @click="viewRuns(data.serial_number)" class="btn-table">
                <Layers :size="14" />
                <span>Runs</span>
              </Button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Register ECU Dialog -->
    <Dialog v-model:visible="showRegisterDialog" modal header="Register New ECU" :style="{ width: '400px' }">
      <div class="form-container">
        <div class="form-group">
          <label for="serial">Serial Number</label>
          <InputText id="serial" v-model="registerSerial" placeholder="e.g. ECU-32-0051" class="w-full glow-border" />
        </div>
        <div class="form-group">
          <label for="hw">Hardware Revision</label>
          <InputText id="hw" v-model="registerHwRev" placeholder="e.g. RevB-4" class="w-full glow-border" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showRegisterDialog = false" />
        <Button label="Register" :loading="registerLoading" @click="handleRegister" class="btn-primary" />
      </template>
    </Dialog>
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

.text-primary {
  color: var(--color-primary);
}

.text-muted {
  color: var(--text-muted);
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

/* Dialog Styling */
.form-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.5rem 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.w-full {
  width: 100%;
}
</style>
